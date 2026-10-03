import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
} from 'lucide-react';
import { FileNode } from '../types.js';

interface WorkspaceExplorerProps {
  tree?: FileNode;
  selectedFilePath?: string;
  modifiedFiles: string[];
  inspectedFiles: string[];
  onSelectFile: (filePath: string) => void;
  onCreateFile: (filePath: string) => void;
}

export const WorkspaceExplorer: React.FC<WorkspaceExplorerProps> = ({
  tree,
  selectedFilePath,
  modifiedFiles,
  inspectedFiles,
  onSelectFile,
  onCreateFile,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '.': true,
    'src': true,
    'src/components': true,
    'src/data': true,
  });
  const [filterText, setFilterText] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if (fileName.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (fileName.endsWith('.md') || fileName.endsWith('.txt')) {
      return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName('');
      setShowNewFileInput(false);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    if (filterText && !node.isDirectory && !node.name.toLowerCase().includes(filterText.toLowerCase())) {
      return null;
    }

    const isExpanded = expandedFolders[node.path] ?? depth < 1;
    const isSelected = selectedFilePath === node.path;
    const isModified = modifiedFiles.some((f) => f.includes(node.name) || node.path.includes(f));
    const isInspected = inspectedFiles.some((f) => f.includes(node.name) || node.path.includes(f));

    if (node.isDirectory) {
      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-1.5 py-1 px-2 hover:bg-neutral-800/60 rounded cursor-pointer text-neutral-300 text-xs transition-colors"
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-neutral-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-neutral-500 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
            )}
            <span className="font-medium truncate">{node.name}</span>
          </div>

          {isExpanded && node.children && (
            <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer text-xs transition-colors group select-none ${
          isSelected
            ? 'bg-neutral-800 text-emerald-300 font-medium border-l-2 border-emerald-500 pl-1.5'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
        }`}
        style={{ paddingLeft: `${depth * 14 + 18}px` }}
      >
        <div className="flex items-center gap-2 truncate">
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {isModified && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              title="Modificado por el agente o Git"
            />
          )}
          {isInspected && !isModified && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-sky-400"
              title="Inspeccionado por el agente"
            />
          )}
          {node.size !== undefined && (
            <span className="text-[10px] text-neutral-500 opacity-0 group-hover:opacity-100 font-mono">
              {(node.size / 1024).toFixed(1)}k
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-neutral-900 border-r border-neutral-800 w-64 shrink-0">
      {/* Header bar */}
      <div className="p-2.5 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Explorador de Archivos
        </span>
        <button
          onClick={() => setShowNewFileInput(!showNewFileInput)}
          title="Crear nuevo archivo"
          className="p-1 hover:text-neutral-100 text-neutral-400 rounded hover:bg-neutral-800"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New file input form */}
      {showNewFileInput && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-neutral-800 bg-neutral-950/80">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="src/ejemplo.js"
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 font-mono"
            autoFocus
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => setShowNewFileInput(false)}
              className="text-[10px] text-neutral-400 hover:text-neutral-200 px-2 py-0.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2 py-0.5 rounded"
            >
              Crear
            </button>
          </div>
        </form>
      )}

      {/* Filter / Search input */}
      <div className="p-2 border-b border-neutral-800/60">
        <div className="flex items-center gap-1.5 bg-neutral-950 px-2 py-1 rounded border border-neutral-800 text-neutral-400 text-xs">
          <Search className="w-3 h-3 text-neutral-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar archivos..."
            className="bg-transparent focus:outline-none text-neutral-200 placeholder:text-neutral-600 text-xs w-full"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="text-neutral-500 hover:text-neutral-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1.5 font-mono text-xs space-y-0.5">
        {tree ? (
          renderNode(tree, 0)
        ) : (
          <div className="p-4 text-center text-xs text-neutral-500">
            Cargando árbol de archivos...
          </div>
        )}
      </div>

      {/* Legend / Status badges */}
      <div className="p-2 border-t border-neutral-800 bg-neutral-950/40 text-[10px] text-neutral-500 flex items-center justify-around">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
          <span>Leído</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          <span>Modificado</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span>Activo</span>
        </div>
      </div>
    </div>
  );
};
