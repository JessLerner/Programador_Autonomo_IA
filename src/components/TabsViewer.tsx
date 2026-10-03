import React, { useState } from 'react';
import {
  Terminal as TerminalIcon,
  GitCompare,
  FileCode,
  ScrollText,
  Play,
  RotateCcw,
  Save,
  Check,
  Search,
  Copy,
} from 'lucide-react';
import { AuditLogEntry, GitRepoStatus } from '../types.js';

interface TabsViewerProps {
  selectedFile?: { path: string; content: string };
  modifiedFiles: string[];
  gitStatus?: GitRepoStatus;
  auditLogs: AuditLogEntry[];
  terminalHistory: Array<{ command: string; output: string; exitCode: number; time: string }>;
  onExecuteCommand: (command: string) => Promise<void>;
  onSaveFile: (path: string, content: string) => Promise<void>;
  onClearLogs: () => void;
}

export const TabsViewer: React.FC<TabsViewerProps> = ({
  selectedFile,
  modifiedFiles,
  gitStatus,
  auditLogs,
  terminalHistory,
  onExecuteCommand,
  onSaveFile,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'diff' | 'editor' | 'logs'>('terminal');
  const [manualCommand, setManualCommand] = useState('');
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [hasFileChanges, setHasFileChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  // Sync editor content when selectedFile changes
  React.useEffect(() => {
    if (selectedFile) {
      setFileContent(selectedFile.content);
      setHasFileChanges(false);
    }
  }, [selectedFile]);

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCommand.trim() || isExecutingCmd) return;
    setIsExecutingCmd(true);
    const cmd = manualCommand.trim();
    setManualCommand('');
    try {
      await onExecuteCommand(cmd);
    } finally {
      setIsExecutingCmd(false);
    }
  };

  const handleSaveCurrentFile = async () => {
    if (!selectedFile || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveFile(selectedFile.path, fileContent);
      setHasFileChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 1500);
  };

  const filteredLogs = auditLogs.filter(
    (l) =>
      !logFilter ||
      l.type.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.message.toLowerCase().includes(logFilter.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-neutral-900 border-t lg:border-t-0 lg:border-l border-neutral-800 min-w-0 h-full">
      {/* Tabs Bar */}
      <div className="flex items-center justify-between px-3 bg-neutral-950 border-b border-neutral-800 select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'terminal'
                ? 'border-emerald-500 text-emerald-400 bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
            {terminalHistory.length > 0 && (
              <span className="text-[10px] px-1.5 rounded-full bg-neutral-800 text-neutral-400">
                {terminalHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('diff')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'diff'
                ? 'border-emerald-500 text-emerald-400 bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Diff & Cambios</span>
            {modifiedFiles.length > 0 && (
              <span className="text-[10px] px-1.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                {modifiedFiles.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'editor'
                ? 'border-emerald-500 text-emerald-400 bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Editor</span>
            {selectedFile && (
              <span className="text-[10px] font-mono text-neutral-400 truncate max-w-[120px]">
                {selectedFile.path.split('/').pop()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400 bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Auditoría</span>
            <span className="text-[10px] px-1.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
              {auditLogs.length}
            </span>
          </button>
        </div>

        {/* Tab specific top-right actions */}
        {activeTab === 'editor' && selectedFile && (
          <button
            onClick={handleSaveCurrentFile}
            disabled={!hasFileChanges || isSaving}
            className="flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-2 py-0.5 rounded font-medium transition-colors"
          >
            <Save className="w-3 h-3" />
            <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
          </button>
        )}

        {activeTab === 'logs' && (
          <button
            onClick={onClearLogs}
            className="text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 px-2 py-0.5 rounded"
          >
            Limpiar logs
          </button>
        )}
      </div>

      {/* Tab 1: Terminal Content */}
      {activeTab === 'terminal' && (
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950 font-mono text-xs">
          {/* Quick command buttons */}
          <div className="px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-neutral-500 shrink-0">Comandos rápidos:</span>
            <button
              onClick={() => onExecuteCommand('npm test')}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
            >
              npm test
            </button>
            <button
              onClick={() => onExecuteCommand('npm run build')}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
            >
              npm run build
            </button>
            <button
              onClick={() => onExecuteCommand('git status')}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
            >
              git status
            </button>
            <button
              onClick={() => onExecuteCommand('git diff')}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
            >
              git diff
            </button>
          </div>

          {/* Terminal log output */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {terminalHistory.length === 0 ? (
              <div className="text-neutral-600 text-xs italic">
                Terminal local lista. Los comandos ejecutados por el agente o por ti aparecerán aquí.
              </div>
            ) : (
              terminalHistory.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-bold">$</span>
                      <span className="text-neutral-200 font-semibold">{item.command}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 rounded ${
                          item.exitCode === 0
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        código {item.exitCode}
                      </span>
                      <span className="text-[10px] text-neutral-500">{item.time}</span>
                    </div>
                  </div>
                  <pre className="bg-neutral-900/70 p-2.5 rounded border border-neutral-800/80 text-neutral-300 whitespace-pre-wrap leading-relaxed text-[11px] overflow-x-auto">
                    {item.output}
                  </pre>
                </div>
              ))
            )}
          </div>

          {/* Terminal Input Form */}
          <form
            onSubmit={handleCommandSubmit}
            className="p-2 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2"
          >
            <span className="text-emerald-400 font-bold px-1">$</span>
            <input
              type="text"
              value={manualCommand}
              onChange={(e) => setManualCommand(e.target.value)}
              placeholder="Ejecutar comando en la terminal local... (ej: node test.js)"
              disabled={isExecutingCmd}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={!manualCommand.trim() || isExecutingCmd}
              className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 px-3 py-1 rounded text-xs font-medium border border-neutral-700"
            >
              {isExecutingCmd ? '...' : 'Enviar'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Diff Content */}
      {activeTab === 'diff' && (
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-950 font-mono text-xs">
          {gitStatus?.recentDiff ? (
            <div className="space-y-2">
              <div className="text-[11px] text-neutral-400 mb-2 font-sans font-semibold">
                Diferencias Git detectadas en el proyecto:
              </div>
              <pre className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 text-neutral-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {gitStatus.recentDiff.split('\n').map((line, idx) => {
                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                  const isDel = line.startsWith('-') && !line.startsWith('---');
                  const isHeader = line.startsWith('diff --git') || line.startsWith('@@');
                  return (
                    <div
                      key={idx}
                      className={
                        isAdd
                          ? 'bg-emerald-950/60 text-emerald-300 px-1'
                          : isDel
                          ? 'bg-rose-950/60 text-rose-300 px-1'
                          : isHeader
                          ? 'text-sky-400 font-bold mt-2'
                          : 'text-neutral-400'
                      }
                    >
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>
          ) : modifiedFiles.length > 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <span className="text-xs font-semibold text-neutral-300 block mb-1">
                  Archivos Modificados por el Agente:
                </span>
                <ul className="list-disc list-inside text-neutral-400 space-y-1">
                  {modifiedFiles.map((f, i) => (
                    <li key={i} className="text-amber-400 font-mono">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 italic">
              No hay cambios ni diferencias pendientes en el proyecto.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Editor Content */}
      {activeTab === 'editor' && (
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
          {selectedFile ? (
            <>
              <div className="px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                <span className="font-mono text-neutral-200">{selectedFile.path}</span>
                {hasFileChanges && (
                  <span className="text-[10px] text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800">
                    Modificado
                  </span>
                )}
              </div>
              <textarea
                value={fileContent}
                onChange={(e) => {
                  setFileContent(e.target.value);
                  setHasFileChanges(true);
                }}
                className="flex-1 p-3 bg-neutral-950 font-mono text-xs text-neutral-200 focus:outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 italic text-xs">
              Selecciona un archivo del explorador a la izquierda para inspeccionar o editar su código.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Audit Logs Content */}
      {activeTab === 'logs' && (
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
          {/* Filter */}
          <div className="p-2 bg-neutral-900 border-b border-neutral-800 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              placeholder="Filtrar eventos de auditoría (ej: ERROR, TOOL_CALL)..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-neutral-500 text-center py-6 text-xs italic">
                No hay registros de auditoría que coincidan.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isError = log.type === 'ERROR_DETECTED';
                const isPlan = log.type === 'PLAN_CREATED';
                const isTool = log.type === 'TOOL_INVOKED' || log.type === 'TOOL_RESULT';
                const isUser = log.type === 'USER_PROMPT' || log.type === 'USER_CONFIRMATION';

                return (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-neutral-900 border border-neutral-800/80 space-y-1 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] text-neutral-500">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            isError
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isPlan
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : isTool
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : isUser
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {log.type}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(log, null, 2), log.id)}
                        className="text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
                        title="Copiar log en JSON"
                      >
                        {copiedLogId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    <div className="text-neutral-200 text-[11px] leading-relaxed font-sans">
                      {log.message}
                    </div>

                    {log.details && (
                      <pre className="text-[10px] text-neutral-400 bg-neutral-950 p-1.5 rounded overflow-x-auto max-h-24">
                        {typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
