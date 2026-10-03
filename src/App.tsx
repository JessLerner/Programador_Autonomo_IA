import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.js';
import { WorkspaceExplorer } from './components/WorkspaceExplorer.js';
import { AgentControlPanel } from './components/AgentControlPanel.js';
import { PlanAndHistory } from './components/PlanAndHistory.js';
import { TabsViewer } from './components/TabsViewer.js';
import { SettingsModal } from './components/SettingsModal.js';
import {
  FileNode,
  GitRepoStatus,
  AIProviderItem,
  AgentRunState,
  AuditLogEntry,
} from './types.js';

export default function App() {
  const [projectRoot, setProjectRoot] = useState('sample_projects/MiAplicacion');
  const [folderName, setFolderName] = useState('MiAplicacion');
  const [tree, setTree] = useState<FileNode | undefined>();
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | undefined>();
  const [providers, setProviders] = useState<AIProviderItem[]>([]);
  const [safetyMode, setSafetyMode] = useState<'safe' | 'autopilot'>('safe');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Agent State
  const [currentRun, setCurrentRun] = useState<AgentRunState | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);

  // File Viewer
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | undefined>();

  // Terminal & Logs
  const [terminalHistory, setTerminalHistory] = useState<
    Array<{ command: string; output: string; exitCode: number; time: string }>
  >([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // 1. Fetch initial workspace & providers
  const fetchWorkspace = async (rootPath?: string) => {
    setIsRefreshing(true);
    try {
      const target = rootPath !== undefined ? rootPath : projectRoot;
      const res = await fetch(`/api/workspace?projectRoot=${encodeURIComponent(target)}`);
      if (res.ok) {
        const data = await res.json();
        setProjectRoot(data.projectRoot);
        setFolderName(data.folderName);
        setTree(data.tree);
        setGitStatus(data.git);
      } else {
        const errData = await res.json();
        console.error('Error cargando workspace:', errData.error);
      }
    } catch (err) {
      console.error('Fallo de red cargando workspace:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
      }
    } catch (err) {
      console.error('Error cargando proveedores:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/agent/logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Error cargando logs:', err);
    }
  };

  useEffect(() => {
    fetchWorkspace();
    fetchProviders();
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  // 2. Select / Change Project
  const handleSelectProject = (path: string) => {
    setProjectRoot(path);
    fetchWorkspace(path);
  };

  // 3. Provider Switching
  const handleSelectProvider = async (providerId: string) => {
    try {
      const res = await fetch('/api/providers/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      if (res.ok) {
        await fetchProviders();
        await fetchLogs();
      }
    } catch (err) {
      console.error('Error seleccionando proveedor:', err);
    }
  };

  const handleSaveProviderConfig = async (
    providerId: string,
    config: { baseUrl?: string; apiKey?: string; model?: string }
  ) => {
    await fetch('/api/providers/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, ...config }),
    });
  };

  // 4. File reading & saving
  const handleSelectFile = async (filePath: string) => {
    try {
      const res = await fetch(
        `/api/file?projectRoot=${encodeURIComponent(projectRoot)}&path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedFile({ path: filePath, content: data.content });
      }
    } catch (err) {
      console.error('Error leyendo archivo:', err);
    }
  };

  const handleSaveFile = async (filePath: string, content: string) => {
    try {
      const res = await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot, path: filePath, content }),
      });
      if (res.ok) {
        await fetchWorkspace();
        await fetchLogs();
      }
    } catch (err) {
      console.error('Error guardando archivo:', err);
    }
  };

  const handleCreateFile = async (filePath: string) => {
    await handleSaveFile(filePath, '// Nuevo archivo\n');
    handleSelectFile(filePath);
  };

  // 5. Terminal execution
  const handleExecuteCommand = async (command: string) => {
    const time = new Date().toLocaleTimeString();
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot, command }),
      });
      const data = await res.json();
      setTerminalHistory((prev) => [
        {
          command,
          output: data.combinedOutput || data.stdout || data.stderr || '(Sin salida)',
          exitCode: data.exitCode,
          time,
        },
        ...prev,
      ]);
      await fetchWorkspace();
      await fetchLogs();
    } catch (err: any) {
      setTerminalHistory((prev) => [
        {
          command,
          output: `Error ejecutando comando: ${err.message}`,
          exitCode: 1,
          time,
        },
        ...prev,
      ]);
    }
  };

  // 6. Agent Loop Execution
  const executeStep = async (runId: string): Promise<AgentRunState | null> => {
    try {
      const res = await fetch('/api/agent/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) throw new Error('Fallo en el paso del agente');
      const data: AgentRunState = await res.json();
      setCurrentRun(data);

      // If the action was run_command, record it in terminal history as well
      if (data.currentAction?.action === 'run_command' && data.lastResult) {
        setTerminalHistory((prev) => [
          {
            command: data.currentAction?.command || 'run_command',
            output: data.lastResult?.output || '(Sin salida)',
            exitCode: data.lastResult?.exitCode ?? 0,
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
      }

      await fetchWorkspace();
      await fetchLogs();
      return data;
    } catch (err) {
      console.error('Error en executeStep:', err);
      return null;
    }
  };

  const runAgentLoop = async (runId: string) => {
    isRunningRef.current = true;
    setIsRunning(true);

    while (isRunningRef.current) {
      const state = await executeStep(runId);
      if (!state) break;

      // Check if paused or finished
      if (
        state.status === 'waiting_plan_approval' ||
        state.status === 'waiting_confirmation' ||
        state.status === 'waiting_user_input' ||
        state.status === 'completed' ||
        state.status === 'error' ||
        state.status === 'stopped'
      ) {
        break;
      }

      // Small delay between autonomous steps for UI visual fluidity
      await new Promise((r) => setTimeout(r, 600));
    }

    isRunningRef.current = false;
    setIsRunning(false);
  };

  const handleStartRun = async (instruction: string, stepByStep: boolean) => {
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInstruction: instruction,
          projectRoot,
          safetyMode,
        }),
      });
      const data = await res.json();
      const initialRun: AgentRunState = {
        runId: data.runId,
        status: data.status,
        currentTurn: 0,
        memory: data.memory,
        history: data.history || [{ role: 'user', result: instruction }],
        planApproved: false,
      };
      setCurrentRun(initialRun);
      await fetchLogs();

      if (stepByStep) {
        await executeStep(data.runId);
      } else {
        runAgentLoop(data.runId);
      }
    } catch (err) {
      console.error('Error iniciando tarea de agente:', err);
    }
  };

  const handleNextStep = async () => {
    if (!currentRun || isRunning) return;
    setIsRunning(true);
    await executeStep(currentRun.runId);
    setIsRunning(false);
  };

  const handleStopRun = async () => {
    isRunningRef.current = false;
    setIsRunning(false);
    if (currentRun) {
      await fetch('/api/agent/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: currentRun.runId }),
      });
      await fetchLogs();
    }
  };

  const handleApprovePlan = async () => {
    if (!currentRun) return;
    await fetch('/api/agent/approve-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: currentRun.runId }),
    });
    // Resume agent loop
    runAgentLoop(currentRun.runId);
  };

  const handleApproveAction = async (confirmationId: string) => {
    if (!currentRun) return;
    const res = await fetch('/api/agent/approve-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: currentRun.runId, confirmationId }),
    });
    const data = await res.json();
    setCurrentRun(data);
    await fetchWorkspace();
    await fetchLogs();
    // Resume agent loop
    runAgentLoop(currentRun.runId);
  };

  const handleRejectAction = async (confirmationId: string, reason: string) => {
    if (!currentRun) return;
    const res = await fetch('/api/agent/reject-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: currentRun.runId, confirmationId, reason }),
    });
    const data = await res.json();
    setCurrentRun(data);
    await fetchLogs();
  };

  const handleAnswerQuestion = async (answer: string) => {
    if (!currentRun) return;
    const res = await fetch('/api/agent/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: currentRun.runId, answer }),
    });
    const data = await res.json();
    setCurrentRun((prev) => prev ? { ...prev, status: data.status, history: data.history, userQuestion: undefined } : prev);
    await fetchLogs();
    runAgentLoop(currentRun.runId);
  };

  const handleClearLogs = async () => {
    await fetch('/api/agent/logs/clear', { method: 'POST' });
    setAuditLogs([]);
  };

  const activeProvider = providers.find((p) => p.isActive);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 select-none font-sans">
      {/* 1. Header Bar */}
      <Header
        projectRoot={projectRoot}
        folderName={folderName}
        gitStatus={gitStatus}
        providers={providers}
        safetyMode={safetyMode}
        onSelectProject={handleSelectProject}
        onSelectProvider={handleSelectProvider}
        onToggleSafetyMode={() => setSafetyMode((m) => (m === 'safe' ? 'autopilot' : 'safe'))}
        onOpenSettings={() => setShowSettings(true)}
        onRefreshWorkspace={() => fetchWorkspace()}
        isRefreshing={isRefreshing}
      />

      {/* 2. Main Workstation Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Project File Tree Explorer */}
        <WorkspaceExplorer
          tree={tree}
          selectedFilePath={selectedFile?.path}
          modifiedFiles={currentRun?.memory.modifiedFiles || gitStatus?.modifiedFiles || []}
          inspectedFiles={currentRun?.memory.inspectedFiles || []}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
        />

        {/* Center: Mission Instruction & Plan / Action Feed */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-neutral-800">
          <AgentControlPanel
            currentRun={currentRun}
            isRunning={isRunning}
            onStartRun={handleStartRun}
            onNextStep={handleNextStep}
            onStopRun={handleStopRun}
          />

          <PlanAndHistory
            currentRun={currentRun}
            onApprovePlan={handleApprovePlan}
            onApproveAction={handleApproveAction}
            onRejectAction={handleRejectAction}
            onAnswerQuestion={handleAnswerQuestion}
          />
        </div>

        {/* Right: Terminal, Diff, File Editor & Audit Logs */}
        <TabsViewer
          selectedFile={selectedFile}
          modifiedFiles={currentRun?.memory.modifiedFiles || gitStatus?.modifiedFiles || []}
          gitStatus={gitStatus}
          auditLogs={auditLogs}
          terminalHistory={terminalHistory}
          onExecuteCommand={handleExecuteCommand}
          onSaveFile={handleSaveFile}
          onClearLogs={handleClearLogs}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        providers={providers}
        activeProviderId={activeProvider?.id || 'gemini'}
        onSelectProvider={handleSelectProvider}
        onSaveProviderConfig={handleSaveProviderConfig}
      />
    </div>
  );
}
