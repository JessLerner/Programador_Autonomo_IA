import React, { useState } from 'react';
import {
  FolderGit2,
  Terminal,
  ShieldCheck,
  Zap,
  Settings,
  FolderOpen,
  Cpu,
  RefreshCw,
  GitBranch,
} from 'lucide-react';
import { GitRepoStatus, AIProviderItem } from '../types.js';

interface HeaderProps {
  projectRoot: string;
  folderName: string;
  gitStatus?: GitRepoStatus;
  providers: AIProviderItem[];
  safetyMode: 'safe' | 'autopilot';
  onSelectProject: (path: string) => void;
  onSelectProvider: (providerId: string) => void;
  onToggleSafetyMode: () => void;
  onOpenSettings: () => void;
  onRefreshWorkspace: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  projectRoot,
  folderName,
  gitStatus,
  providers,
  safetyMode,
  onSelectProject,
  onSelectProvider,
  onToggleSafetyMode,
  onOpenSettings,
  onRefreshWorkspace,
  isRefreshing,
}) => {
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [customPath, setCustomPath] = useState(projectRoot);

  const activeProvider = providers.find((p) => p.isActive) || providers[0];

  const handleCustomPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPath.trim()) {
      onSelectProject(customPath.trim());
      setShowFolderInput(false);
    }
  };

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 text-neutral-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-inner">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide text-neutral-100">LOCAL CODEX</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Windows Agent
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-tight">
            Agente autónomo de programación local
          </p>
        </div>
      </div>

      {/* Project Selector & Path Bar */}
      <div className="flex items-center gap-2 bg-neutral-950/70 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-300">
        <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        {showFolderInput ? (
          <form onSubmit={handleCustomPathSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="C:\Proyectos\MiApp o ruta relativa"
              className="bg-neutral-900 text-neutral-100 text-xs px-2 py-0.5 rounded border border-neutral-700 focus:outline-none focus:border-emerald-500 w-64 font-mono"
              autoFocus
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-2 py-0.5 rounded font-medium"
            >
              Abrir
            </button>
            <button
              type="button"
              onClick={() => setShowFolderInput(false)}
              className="text-neutral-400 hover:text-neutral-200 text-[11px] px-1"
            >
              ✕
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 text-[11px]">Proyecto:</span>
            <span className="font-semibold text-neutral-200">{folderName}</span>
            <span
              className="font-mono text-[11px] text-neutral-400 truncate max-w-[220px] cursor-pointer hover:text-neutral-200 hover:underline"
              title={projectRoot}
              onClick={() => {
                setCustomPath(projectRoot);
                setShowFolderInput(true);
              }}
            >
              {projectRoot}
            </span>
            <button
              onClick={() => {
                setCustomPath(projectRoot);
                setShowFolderInput(true);
              }}
              title="Cambiar carpeta de proyecto"
              className="text-neutral-400 hover:text-emerald-400 text-[11px] px-1 py-0.5 rounded hover:bg-neutral-800"
            >
              Cambiar...
            </button>
          </div>
        )}

        <button
          onClick={onRefreshWorkspace}
          disabled={isRefreshing}
          title="Actualizar árbol y estado del proyecto"
          className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Git Status Badge */}
      <div className="flex items-center gap-1.5 text-xs">
        {gitStatus?.isGitRepo ? (
          <div className="flex items-center gap-1.5 bg-neutral-950 px-2 py-1 rounded-md border border-neutral-800 text-neutral-300">
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-[11px] text-neutral-200">
              {gitStatus.currentBranch || 'main'}
            </span>
            {gitStatus.modifiedFiles.length > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                {gitStatus.modifiedFiles.length} modif.
              </span>
            )}
            {gitStatus.clean && (
              <span className="text-[10px] text-emerald-400 font-mono">limpio</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-neutral-950/50 px-2 py-1 rounded-md border border-neutral-800 text-neutral-500 text-[11px]">
            <FolderGit2 className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sin Git</span>
          </div>
        )}
      </div>

      {/* Right Controls: Provider & Safety Mode */}
      <div className="flex items-center gap-2">
        {/* AI Provider Switcher */}
        <div className="flex items-center gap-1.5 bg-neutral-950 px-2 py-1 rounded-lg border border-neutral-800">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <select
            value={activeProvider?.id}
            onChange={(e) => onSelectProvider(e.target.value)}
            className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer pr-1"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} className="bg-neutral-900 text-neutral-200">
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={onOpenSettings}
            title="Configurar proveedores de IA (Ollama, OpenAI, Gemini)"
            className="p-1 hover:text-neutral-100 text-neutral-400 rounded hover:bg-neutral-800"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Safety Mode Toggle */}
        <button
          onClick={onToggleSafetyMode}
          title={
            safetyMode === 'safe'
              ? 'Modo Seguro activado: Requiere confirmación para planes y acciones destructivas (recomendado).'
              : 'Modo Autopilot activado: El agente ejecuta acciones de forma autónoma sin pedir confirmación.'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            safetyMode === 'safe'
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/60'
              : 'bg-amber-950/60 border-amber-600/50 text-amber-300 hover:bg-amber-900/60'
          }`}
        >
          {safetyMode === 'safe' ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Modo Seguro</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Autopilot</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
