import fs from 'fs';
import path from 'path';
import {
  AgentAction,
  ActionResult,
  PendingConfirmation,
  TurnHistoryItem,
} from '../types.js';
import {
  Brain,
  BrainDecision,
  AgentContext,
  CompactToolEvent,
} from '../brain/brainInterface.js';
import { SessionMemory } from '../memory/sessionMemory.js';
import { ToolDispatcher } from '../tools/toolDispatcher.js';
import { GitTools } from '../tools/gitTools.js';
import { providerRegistry } from '../providers/providerRegistry.js';
import { auditLogger } from '../logger/auditLogger.js';

export type AgentStatus =
  | 'idle'
  | 'running'
  | 'waiting_plan_approval'
  | 'waiting_confirmation'
  | 'waiting_user_input'
  | 'completed'
  | 'error'
  | 'stopped';

export interface AgentRunState {
  id: string;
  status: AgentStatus;
  userInstruction: string;
  projectRoot: string;
  safetyMode: 'safe' | 'autopilot';
  currentTurn: number;
  maxTurns: number;
  consecutiveFailures: number;
  memory: SessionMemory;
  toolHistory: CompactToolEvent[];
  history: TurnHistoryItem[];
  currentDecision?: BrainDecision;
  currentAction?: AgentAction;
  lastResult?: ActionResult;
  pendingConfirmation?: PendingConfirmation;
  userQuestion?: string;
  planApproved: boolean;
  finalSummary?: string;
  error?: string;
}

export class AgentOrchestrator {
  private runs: Map<string, AgentRunState> = new Map();
  public toolDispatcher: ToolDispatcher = new ToolDispatcher();

  public createRun(
    userInstruction: string,
    projectRoot: string,
    safetyMode: 'safe' | 'autopilot' = 'safe'
  ): AgentRunState {
    const id = `run-${Date.now()}`;
    const memory = new SessionMemory(userInstruction);

    const state: AgentRunState = {
      id,
      status: 'idle',
      userInstruction,
      projectRoot,
      safetyMode,
      currentTurn: 0,
      maxTurns: 20,
      consecutiveFailures: 0,
      memory,
      toolHistory: [],
      history: [{ role: 'user', result: userInstruction }],
      planApproved: false,
    };

    this.runs.set(id, state);
    auditLogger.log('USER_PROMPT', `Nueva tarea iniciada: "${userInstruction}"`, { projectRoot, safetyMode });
    return state;
  }

  public getRun(id: string): AgentRunState | undefined {
    return this.runs.get(id);
  }

  /**
   * Executes a single cycle:
   * Build minimal context -> Brain.ask() -> ToolDispatcher -> update context
   */
  public async step(runId: string): Promise<AgentRunState> {
    const state = this.runs.get(runId);
    if (!state) throw new Error(`Run ${runId} no encontrado.`);

    if (
      state.status === 'completed' ||
      state.status === 'error' ||
      state.status === 'stopped' ||
      state.status === 'waiting_user_input'
    ) {
      return state;
    }

    state.status = 'running';
    state.currentTurn++;

    // Safety checks against runaway loops
    if (state.currentTurn > state.maxTurns) {
      state.status = 'error';
      state.error = `Límite máximo de iteraciones alcanzado (${state.maxTurns} pasos) para prevenir bucles.`;
      auditLogger.log('ERROR_DETECTED', state.error);
      return state;
    }

    if (state.consecutiveFailures >= 4) {
      state.status = 'error';
      state.error = 'El agente se pausó tras 4 fallos consecutivos de herramientas para permitir revisión.';
      auditLogger.log('ERROR_DETECTED', state.error);
      return state;
    }

    try {
      // 1. Build minimal initial context (never dumps whole repository)
      let topLevelFiles: string[] = [];
      try {
        const entries = await fs.promises.readdir(state.projectRoot, { withFileTypes: true });
        topLevelFiles = entries
          .filter((e) => e.name !== 'node_modules' && e.name !== '.git')
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .slice(0, 25);
      } catch {}

      let gitState = undefined;
      try {
        gitState = await GitTools.getStatus(state.projectRoot);
      } catch {}

      const agentContext: AgentContext = {
        userRequest: state.userInstruction,
        workspace: {
          root: state.projectRoot,
          folderName: path.basename(state.projectRoot),
          topLevelFiles,
        },
        memory: state.memory.getState(),
        toolHistory: state.toolHistory,
        gitState,
        lastError: state.lastResult?.error,
      };

      // 2. Ask the Brain
      const brain: Brain = providerRegistry.getActiveBrain();
      auditLogger.log('AGENT_THOUGHT', `[BRAIN] Consultando a ${brain.name} (Paso ${state.currentTurn})...`);

      const decision: BrainDecision = await brain.ask(agentContext);
      state.currentDecision = decision;

      // 3. Handle Decision Types
      if (decision.type === 'complete') {
        state.status = 'completed';
        state.finalSummary = decision.summary || 'Tarea finalizada con éxito.';
        state.history.push({
          role: 'agent',
          decision,
          thought: decision.reason || 'Tarea completada.',
        });
        state.history.push({ role: 'tool', result: state.finalSummary });
        auditLogger.log('TASK_COMPLETED', `[BRAIN] Tarea completada: ${state.finalSummary}`);
        return state;
      }

      if (decision.type === 'ask_user') {
        state.status = 'waiting_user_input';
        state.userQuestion = decision.question;
        state.history.push({
          role: 'agent',
          decision,
          thought: decision.reason || 'Requiere aclaración del usuario.',
        });
        auditLogger.log('USER_CONFIRMATION', `[BRAIN] Pregunta al usuario: ${decision.question}`);
        return state;
      }

      if (decision.type === 'tool') {
        const toolAction: AgentAction = {
          action: decision.tool,
          ...decision.arguments,
          thought: decision.reason,
        };
        state.currentAction = toolAction;

        auditLogger.log(
          'AGENT_THOUGHT',
          `[BRAIN DECISION] Solicita herramienta "${decision.tool}"`,
          { arguments: decision.arguments, reason: decision.reason }
        );

        // 4. Local execution via ToolDispatcher
        const result = await this.toolDispatcher.dispatch(
          state.projectRoot,
          toolAction,
          state.memory,
          state.safetyMode
        );
        state.lastResult = result;

        // If safety guard requests approval
        if (result.requiresConfirmation) {
          state.status = 'waiting_confirmation';
          state.pendingConfirmation = this.toolDispatcher
            .getPendingConfirmations()
            .find((p) => p.action.action === toolAction.action);
          return state;
        }

        // Track tool success / failure
        if (result.success) {
          state.consecutiveFailures = 0;
        } else {
          state.consecutiveFailures++;
        }

        // Record compact tool event for next Brain context
        const compactEvent: CompactToolEvent = {
          step: state.currentTurn,
          tool: decision.tool,
          arguments: decision.arguments,
          reason: decision.reason,
          success: result.success,
          outputSnippet: result.output ? result.output.slice(0, 1000) : '',
          error: result.error,
          exitCode: result.exitCode,
        };
        state.toolHistory.push(compactEvent);

        // Record in conversation history for the UI
        state.history.push({
          role: 'agent',
          decision,
          action: toolAction,
          thought: decision.reason,
        });
        state.history.push({
          role: 'tool',
          result: result.output,
          error: result.error,
        });

        // Special case: if tool was plan and safe mode is active, check plan approval
        if (decision.tool === 'plan' && state.safetyMode === 'safe' && !state.planApproved) {
          state.status = 'waiting_plan_approval';
          return state;
        }

        return state;
      }

      throw new Error(`Tipo de decisión desconocido: ${(decision as any).type}`);
    } catch (err: any) {
      state.status = 'error';
      state.error = `Error en el ciclo del agente: ${err.message}`;
      auditLogger.log('ERROR_DETECTED', state.error);
      return state;
    }
  }

  public approvePlan(runId: string): AgentRunState {
    const state = this.runs.get(runId);
    if (!state) throw new Error('Run no encontrado');
    state.planApproved = true;
    state.status = 'idle';
    auditLogger.log('USER_CONFIRMATION', 'Plan de trabajo aprobado por el usuario.');
    return state;
  }

  public async approveConfirmation(runId: string, confirmationId: string): Promise<AgentRunState> {
    const state = this.runs.get(runId);
    if (!state) throw new Error('Run no encontrado');

    const pending = this.toolDispatcher.getPending(confirmationId);
    if (!pending) throw new Error('Confirmación pendiente no encontrada');

    auditLogger.log('USER_CONFIRMATION', `[USER] Aprobó acción destructiva: ${pending.action.action}`, pending.action);

    // Execute with skipConfirmationCheck: true
    const result = await this.toolDispatcher.dispatch(
      state.projectRoot,
      pending.action,
      state.memory,
      state.safetyMode,
      true
    );

    this.toolDispatcher.clearPending(confirmationId);
    state.pendingConfirmation = undefined;
    state.lastResult = result;
    state.status = 'idle';

    if (result.success) {
      state.consecutiveFailures = 0;
    } else {
      state.consecutiveFailures++;
    }

    state.toolHistory.push({
      step: state.currentTurn,
      tool: pending.action.action,
      arguments: pending.action,
      success: result.success,
      outputSnippet: result.output ? result.output.slice(0, 1000) : '',
      error: result.error,
      exitCode: result.exitCode,
    });

    state.history.push({
      role: 'tool',
      result: result.output,
      error: result.error,
    });

    return state;
  }

  public rejectConfirmation(runId: string, confirmationId: string, reason: string): AgentRunState {
    const state = this.runs.get(runId);
    if (!state) throw new Error('Run no encontrado');

    this.toolDispatcher.clearPending(confirmationId);
    state.pendingConfirmation = undefined;
    state.status = 'idle';

    const rejectionMsg = `Acción rechazada por el usuario: ${reason || 'Cancelado por el usuario'}`;
    auditLogger.log('USER_CONFIRMATION', rejectionMsg);

    state.toolHistory.push({
      step: state.currentTurn,
      tool: 'rejected_by_user',
      arguments: {},
      success: false,
      outputSnippet: '',
      error: rejectionMsg,
    });

    state.history.push({
      role: 'tool',
      error: rejectionMsg,
    });
    state.memory.recordError(rejectionMsg);

    return state;
  }

  public answerUserQuestion(runId: string, answer: string): AgentRunState {
    const state = this.runs.get(runId);
    if (!state) throw new Error('Run no encontrado');

    state.status = 'idle';
    state.userQuestion = undefined;
    state.history.push({
      role: 'user',
      result: `Respuesta del usuario: ${answer}`,
    });
    auditLogger.log('USER_PROMPT', `Respuesta del usuario: ${answer}`);
    return state;
  }

  public stopRun(runId: string): AgentRunState {
    const state = this.runs.get(runId);
    if (state) {
      state.status = 'stopped';
      auditLogger.log('TASK_COMPLETED', 'Agente detenido manualmente por el usuario.');
    }
    return state!;
  }
}

export const agentOrchestrator = new AgentOrchestrator();
