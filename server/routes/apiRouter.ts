import express from 'express';
import path from 'path';
import fs from 'fs';
import { agentOrchestrator } from '../agent/agentLoop.js';
import { FileTools } from '../tools/fileTools.js';
import { CommandTools } from '../tools/commandTools.js';
import { GitTools } from '../tools/gitTools.js';
import { providerRegistry } from '../providers/providerRegistry.js';
import { auditLogger } from '../logger/auditLogger.js';
import { SafetyGuard } from '../security/safetyGuard.js';

export const apiRouter = express.Router();

// Helper to resolve workspace path
function resolveWorkspace(inputPath?: string): string {
  if (!inputPath || inputPath.trim() === '') {
    return path.resolve(process.cwd(), 'sample_projects/MiAplicacion');
  }
  // If absolute path
  if (path.isAbsolute(inputPath)) {
    return path.resolve(inputPath);
  }
  return path.resolve(process.cwd(), inputPath);
}

// Test Brain Endpoint
apiRouter.post('/test-brain', async (req, res) => {
  try {
    const brain = providerRegistry.getActiveBrain();
    const decision = await brain.ask(req.body);
    res.json({ success: true, decision });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Get Workspace Overview (File Tree & Git)
apiRouter.get('/workspace', async (req, res) => {
  try {
    const rawPath = req.query.projectRoot as string;
    const projectRoot = resolveWorkspace(rawPath);

    if (!fs.existsSync(projectRoot)) {
      return res.status(404).json({
        error: `La carpeta "${projectRoot}" no existe en el sistema.`,
        projectRoot,
      });
    }

    const treeRes = await FileTools.listDirectory(projectRoot, '', 3);
    const gitStatus = await GitTools.getStatus(projectRoot);

    res.json({
      projectRoot,
      folderName: path.basename(projectRoot),
      tree: treeRes.tree,
      git: gitStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Read File
apiRouter.get('/file', async (req, res) => {
  try {
    const projectRoot = resolveWorkspace(req.query.projectRoot as string);
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Falta parámetro path' });

    const fileRes = await FileTools.readFile(projectRoot, filePath);
    if (!fileRes.success) {
      return res.status(404).json({ error: fileRes.error });
    }
    res.json({ path: filePath, content: fileRes.content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Write / Save File
apiRouter.post('/file', async (req, res) => {
  try {
    const { projectRoot: rawRoot, path: filePath, content } = req.body;
    const projectRoot = resolveWorkspace(rawRoot);
    if (!filePath) return res.status(400).json({ error: 'Falta parámetro path' });

    const writeRes = await FileTools.writeFile(projectRoot, filePath, content ?? '');
    if (!writeRes.success) {
      return res.status(400).json({ error: writeRes.error });
    }
    res.json({ success: true, diff: writeRes.diff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Git Status & Diff
apiRouter.get('/git/status', async (req, res) => {
  try {
    const projectRoot = resolveWorkspace(req.query.projectRoot as string);
    const status = await GitTools.getStatus(projectRoot);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/git/diff', async (req, res) => {
  try {
    const projectRoot = resolveWorkspace(req.query.projectRoot as string);
    const diff = await GitTools.getDiff(projectRoot);
    res.json(diff);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Execute Command directly in terminal
apiRouter.post('/command', async (req, res) => {
  try {
    const { projectRoot: rawRoot, command } = req.body;
    const projectRoot = resolveWorkspace(rawRoot);
    if (!command) return res.status(400).json({ error: 'Falta parámetro command' });

    const result = await CommandTools.execute(projectRoot, command);
    auditLogger.log('TOOL_INVOKED', `Comando ejecutado manualmente: ${command}`, result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Start Agent Run
apiRouter.post('/agent/run', async (req, res) => {
  try {
    const { userInstruction, projectRoot: rawRoot, safetyMode } = req.body;
    if (!userInstruction) {
      return res.status(400).json({ error: 'Falta la instrucción del usuario' });
    }
    const projectRoot = resolveWorkspace(rawRoot);
    const runState = agentOrchestrator.createRun(userInstruction, projectRoot, safetyMode || 'safe');
    
    res.json({
      runId: runState.id,
      status: runState.status,
      memory: runState.memory.getState(),
      history: runState.history,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Step Agent Run
apiRouter.post('/agent/step', async (req, res) => {
  try {
    const { runId } = req.body;
    if (!runId) return res.status(400).json({ error: 'Falta runId' });

    const runState = await agentOrchestrator.step(runId);
    res.json({
      runId: runState.id,
      status: runState.status,
      currentTurn: runState.currentTurn,
      currentDecision: runState.currentDecision,
      currentAction: runState.currentAction,
      lastResult: runState.lastResult,
      pendingConfirmation: runState.pendingConfirmation,
      userQuestion: runState.userQuestion,
      memory: runState.memory.getState(),
      history: runState.history,
      planApproved: runState.planApproved,
      finalSummary: runState.finalSummary,
      error: runState.error,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7.1. Answer User Question
apiRouter.post('/agent/answer', (req, res) => {
  try {
    const { runId, answer } = req.body;
    if (!runId || answer === undefined) return res.status(400).json({ error: 'Faltan parámetros' });
    const runState = agentOrchestrator.answerUserQuestion(runId, String(answer));
    res.json({
      runId: runState.id,
      status: runState.status,
      history: runState.history,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Approve Plan
apiRouter.post('/agent/approve-plan', (req, res) => {
  try {
    const { runId } = req.body;
    const runState = agentOrchestrator.approvePlan(runId);
    res.json({
      runId: runState.id,
      status: runState.status,
      planApproved: runState.planApproved,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Approve Destructive Action
apiRouter.post('/agent/approve-action', async (req, res) => {
  try {
    const { runId, confirmationId } = req.body;
    const runState = await agentOrchestrator.approveConfirmation(runId, confirmationId);
    res.json({
      runId: runState.id,
      status: runState.status,
      lastResult: runState.lastResult,
      memory: runState.memory.getState(),
      history: runState.history,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Reject Destructive Action
apiRouter.post('/agent/reject-action', (req, res) => {
  try {
    const { runId, confirmationId, reason } = req.body;
    const runState = agentOrchestrator.rejectConfirmation(runId, confirmationId, reason);
    res.json({
      runId: runState.id,
      status: runState.status,
      memory: runState.memory.getState(),
      history: runState.history,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Stop Agent Run
apiRouter.post('/agent/stop', (req, res) => {
  try {
    const { runId } = req.body;
    const runState = agentOrchestrator.stopRun(runId);
    res.json({ runId: runState.id, status: runState.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Audit Logs
apiRouter.get('/agent/logs', (req, res) => {
  res.json({ logs: auditLogger.getLogs() });
});

apiRouter.post('/agent/logs/clear', (req, res) => {
  auditLogger.clear();
  res.json({ success: true });
});

// 13. Providers Management
apiRouter.get('/providers', (req, res) => {
  res.json({
    providers: providerRegistry.listProviders(),
    activeProvider: providerRegistry.getActiveProvider(),
  });
});

apiRouter.post('/providers/select', (req, res) => {
  const { providerId } = req.body;
  const ok = providerRegistry.setActiveProvider(providerId);
  if (ok) {
    auditLogger.log('USER_PROMPT', `Proveedor de IA cambiado a: ${providerId}`);
    res.json({ success: true, activeProvider: providerRegistry.getActiveProvider() });
  } else {
    res.status(400).json({ error: `Proveedor "${providerId}" no encontrado.` });
  }
});

apiRouter.post('/providers/config', (req, res) => {
  const { providerId, baseUrl, apiKey, model } = req.body;
  providerRegistry.updateProviderConfig(providerId, { baseUrl, apiKey, model });
  res.json({ success: true });
});
