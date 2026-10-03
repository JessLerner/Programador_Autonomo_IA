import { AgentAction, ActionResult, PendingConfirmation } from '../types.js';
import { SafetyGuard } from '../security/safetyGuard.js';
import { FileTools } from './fileTools.js';
import { CommandTools } from './commandTools.js';
import { GitTools } from './gitTools.js';
import { SessionMemory } from '../memory/sessionMemory.js';
import { auditLogger } from '../logger/auditLogger.js';

export class ToolDispatcher {
  private pendingConfirmations: Map<string, PendingConfirmation> = new Map();

  public getPendingConfirmations(): PendingConfirmation[] {
    return Array.from(this.pendingConfirmations.values());
  }

  public getPending(id: string): PendingConfirmation | undefined {
    return this.pendingConfirmations.get(id);
  }

  public clearPending(id: string) {
    this.pendingConfirmations.delete(id);
  }

  /**
   * Executes a requested tool action on the local machine with safety validations.
   */
  public async dispatch(
    projectRoot: string,
    action: AgentAction,
    memory: SessionMemory,
    safetyMode: 'safe' | 'autopilot' = 'safe',
    skipConfirmationCheck: boolean = false
  ): Promise<ActionResult> {
    const toolName = action.action || (action as any).tool;

    // Normalize action object
    const normalizedAction: AgentAction = {
      ...action,
      action: toolName,
    };

    // 1. Safety assessment
    if (!skipConfirmationCheck) {
      const assessment = SafetyGuard.assessAction(normalizedAction, projectRoot, safetyMode);
      if (!assessment.allowed) {
        auditLogger.log('ERROR_DETECTED', `Acción bloqueada por seguridad: ${assessment.reason}`, normalizedAction);
        return {
          success: false,
          output: '',
          error: assessment.reason,
        };
      }

      if (assessment.requiresConfirmation) {
        const id = `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const pending: PendingConfirmation = {
          id,
          action: normalizedAction,
          reason: assessment.reason || 'Esta acción requiere confirmación del usuario.',
          severity: assessment.severity || 'medium',
          timestamp: Date.now(),
        };
        this.pendingConfirmations.set(id, pending);
        auditLogger.log('USER_CONFIRMATION', `Solicitud de confirmación requerida: ${pending.reason}`, pending);
        return {
          success: false,
          output: '',
          requiresConfirmation: true,
          confirmationReason: pending.reason,
          error: `Acción en pausa: esperando confirmación del usuario (${id}).`,
        };
      }
    }

    auditLogger.log('TOOL_INVOKED', `[MACHINE] Ejecutando: ${toolName}`, normalizedAction);

    // 2. Real local tool execution switch
    switch (toolName) {
      case 'plan': {
        const plan = normalizedAction.plan || (normalizedAction as any).steps;
        if (plan && Array.isArray(plan)) {
          memory.setPlan(plan);
          auditLogger.log('PLAN_CREATED', `Plan registrado con ${plan.length} pasos.`, plan);
          return {
            success: true,
            output: `Plan registrado exitosamente con ${plan.length} pasos.`,
          };
        }
        return { success: false, output: '', error: 'Formato de plan inválido: se esperaba array de pasos.' };
      }

      case 'read_file': {
        const filePath = normalizedAction.path || (normalizedAction as any).filePath;
        if (!filePath) return { success: false, output: '', error: 'Falta parámetro "path".' };
        
        const startLine = normalizedAction.startLine ? Number(normalizedAction.startLine) : undefined;
        const endLine = normalizedAction.endLine ? Number(normalizedAction.endLine) : undefined;

        const res = await FileTools.readFile(projectRoot, filePath, startLine, endLine);
        if (res.success && res.content !== undefined) {
          memory.recordFileInspected(filePath);
          const rangeInfo = startLine || endLine ? ` (líneas ${startLine || 1}..${endLine || res.totalLines})` : '';
          auditLogger.log('TOOL_RESULT', `Archivo leído: ${filePath}${rangeInfo} (${res.content.length} caracteres)`);
          return { success: true, output: res.content };
        }
        return { success: false, output: '', error: res.error };
      }

      case 'write_file': {
        const filePath = normalizedAction.path || (normalizedAction as any).filePath;
        const content = normalizedAction.content !== undefined ? normalizedAction.content : (normalizedAction as any).fileContent;
        if (!filePath || content === undefined) {
          return { success: false, output: '', error: 'Faltan parámetros requeridos "path" o "content".' };
        }
        const res = await FileTools.writeFile(projectRoot, filePath, String(content));
        if (res.success) {
          memory.recordFileModified(filePath);
          auditLogger.log('TOOL_RESULT', `Archivo escrito: ${filePath}`, { diff: res.diff });
          return {
            success: true,
            output: `Archivo "${filePath}" guardado exitosamente.`,
            diff: res.diff,
          };
        }
        return { success: false, output: '', error: res.error };
      }

      case 'edit_file': {
        const filePath = normalizedAction.path || (normalizedAction as any).filePath;
        const oldStr = normalizedAction.old_str ?? (normalizedAction as any).oldStr;
        const newStr = normalizedAction.new_str ?? (normalizedAction as any).newStr;
        if (!filePath || oldStr === undefined || newStr === undefined) {
          return { success: false, output: '', error: 'Faltan parámetros "path", "old_str" o "new_str".' };
        }
        const res = await FileTools.editFile(projectRoot, filePath, String(oldStr), String(newStr));
        if (res.success) {
          memory.recordFileModified(filePath);
          auditLogger.log('TOOL_RESULT', `Archivo editado: ${filePath}`, { diff: res.diff });
          return {
            success: true,
            output: `Archivo "${filePath}" modificado exitosamente.`,
            diff: res.diff,
          };
        }
        return { success: false, output: '', error: res.error };
      }

      case 'delete_file': {
        const filePath = normalizedAction.path || (normalizedAction as any).filePath;
        if (!filePath) return { success: false, output: '', error: 'Falta parámetro "path".' };
        const res = await FileTools.deleteFile(projectRoot, filePath);
        if (res.success) {
          memory.recordFileModified(filePath);
          auditLogger.log('TOOL_RESULT', `Archivo eliminado: ${filePath}`);
          return { success: true, output: `Archivo "${filePath}" eliminado exitosamente.` };
        }
        return { success: false, output: '', error: res.error };
      }

      case 'list_directory': {
        const dirPath = normalizedAction.path || (normalizedAction as any).dirPath || '';
        const res = await FileTools.listDirectory(projectRoot, dirPath, 2);
        if (res.success && res.tree) {
          auditLogger.log('TOOL_RESULT', `Directorio listado: ${dirPath || '.'}`);
          return {
            success: true,
            output: JSON.stringify(res.tree, null, 2),
          };
        }
        return { success: false, output: '', error: res.error };
      }

      case 'search_files': {
        const query = normalizedAction.query || (normalizedAction as any).searchTerm;
        const subPath = normalizedAction.path || (normalizedAction as any).subPath || '';
        if (!query) return { success: false, output: '', error: 'Falta parámetro "query".' };
        const res = await FileTools.searchFiles(projectRoot, String(query), String(subPath));
        if (res.success && res.matches) {
          auditLogger.log('TOOL_RESULT', `Búsqueda "${query}": ${res.matches.length} coincidencias`);
          return {
            success: true,
            output: res.matches.length > 0
              ? res.matches.map((m) => `${m.file}:${m.line} -> ${m.preview}`).join('\n')
              : `No se encontraron coincidencias para "${query}".`,
          };
        }
        return { success: false, output: '', error: res.error };
      }

      case 'run_command': {
        const cmd = normalizedAction.command || (normalizedAction as any).cmd;
        if (!cmd) return { success: false, output: '', error: 'Falta parámetro "command".' };
        const res = await CommandTools.execute(projectRoot, String(cmd));
        memory.recordCommand(String(cmd), res.exitCode, res.success);

        if (!res.success) {
          const errSnippet = res.stderr || res.combinedOutput;
          memory.recordError(`Error en comando "${cmd}": ${errSnippet}`);
          auditLogger.log('ERROR_DETECTED', `Comando falló con código ${res.exitCode}: ${cmd}`, res);
        } else {
          auditLogger.log('TOOL_RESULT', `Comando ejecutado con éxito: ${cmd}`, res);
        }

        return {
          success: res.success,
          output: res.combinedOutput,
          exitCode: res.exitCode,
          error: res.success ? undefined : `Comando falló (código ${res.exitCode}): ${res.stderr || res.combinedOutput}`,
        };
      }

      case 'git_status': {
        const status = await GitTools.getStatus(projectRoot);
        auditLogger.log('TOOL_RESULT', `Estado de Git consultado (rama: ${status.currentBranch || 'N/A'})`);
        return {
          success: true,
          output: JSON.stringify(status, null, 2),
        };
      }

      case 'git_diff': {
        const res = await GitTools.getDiff(projectRoot);
        auditLogger.log('TOOL_RESULT', `Git diff consultado (${res.diff ? res.diff.length : 0} bytes)`);
        return {
          success: res.success,
          output: res.diff || '(Sin diferencias en Git)',
          error: res.error,
        };
      }

      case 'git_commit': {
        const msg = normalizedAction.message || (normalizedAction as any).commitMessage;
        if (!msg) return { success: false, output: '', error: 'Falta mensaje de commit.' };
        const res = await GitTools.commit(projectRoot, String(msg));
        if (res.success) {
          auditLogger.log('TOOL_RESULT', `Commit realizado: "${msg}"`);
          return { success: true, output: res.output };
        }
        return { success: false, output: '', error: res.error };
      }

      case 'complete': {
        const summary = normalizedAction.summary || 'Tarea finalizada.';
        auditLogger.log('TASK_COMPLETED', summary);
        return {
          success: true,
          output: summary,
        };
      }

      default:
        return {
          success: false,
          output: '',
          error: `Herramienta desconocida: "${toolName}". Las herramientas permitidas son: list_directory, search_files, read_file, write_file, edit_file, delete_file, run_command, git_status, git_diff, git_commit.`,
        };
    }
  }
}
