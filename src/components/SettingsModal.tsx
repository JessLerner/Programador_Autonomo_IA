import React, { useState } from 'react';
import { X, Cpu, ShieldCheck, Terminal, Check, Info } from 'lucide-react';
import { AIProviderItem } from '../types.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: AIProviderItem[];
  activeProviderId: string;
  onSelectProvider: (id: string) => void;
  onSaveProviderConfig: (providerId: string, config: { baseUrl?: string; apiKey?: string; model?: string }) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  providers,
  activeProviderId,
  onSelectProvider,
  onSaveProviderConfig,
}) => {
  const [selectedId, setSelectedId] = useState(activeProviderId);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434/v1');
  const [ollamaModel, setOllamaModel] = useState('codellama');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (selectedId === 'ollama') {
        await onSaveProviderConfig('ollama', {
          baseUrl: ollamaUrl,
          model: ollamaModel,
        });
      } else if (selectedId === 'openai') {
        await onSaveProviderConfig('openai', {
          apiKey: openaiKey,
          model: openaiModel,
        });
      }
      onSelectProvider(selectedId);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-neutral-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-neutral-100">
              Configuración de Proveedores de IA y Seguridad
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-1 rounded hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="font-semibold block text-neutral-300 mb-2">
              Seleccionar Proveedor Activo:
            </label>
            <div className="grid grid-cols-1 gap-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedId === p.id
                      ? 'bg-emerald-950/40 border-emerald-500/80 text-neutral-100 shadow-sm'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-200">{p.name}</span>
                    {selectedId === p.id && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Conditional settings for Ollama */}
          {selectedId === 'ollama' && (
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
              <span className="font-semibold text-neutral-300 block text-[11px]">
                Configuración de Ollama / Modelo Local:
              </span>
              <div>
                <label className="text-neutral-400 block mb-1 text-[10px]">URL Base:</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 font-mono"
                />
              </div>
              <div>
                <label className="text-neutral-400 block mb-1 text-[10px]">Nombre del Modelo:</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="codellama, llama3.2, etc."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 font-mono"
                />
              </div>
            </div>
          )}

          {/* Conditional settings for OpenAI */}
          {selectedId === 'openai' && (
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
              <span className="font-semibold text-neutral-300 block text-[11px]">
                Configuración de OpenAI:
              </span>
              <div>
                <label className="text-neutral-400 block mb-1 text-[10px]">API Key:</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 font-mono"
                />
              </div>
              <div>
                <label className="text-neutral-400 block mb-1 text-[10px]">Modelo:</label>
                <input
                  type="text"
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  placeholder="gpt-4o"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 font-mono"
                />
              </div>
            </div>
          )}

          {/* Safety reminder */}
          <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 flex items-start gap-2.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-300 block">
                Capa de Seguridad Activa:
              </span>
              <span>
                Todas las operaciones de archivos están confinadas a la carpeta seleccionada. Los comandos destructivos y eliminación de archivos requieren confirmación manual en Modo Seguro.
              </span>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <span>Guardar y Aplicar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
