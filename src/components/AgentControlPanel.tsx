import React, { useState } from 'react';
import { Play, Square, FastForward, Sparkles, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { AgentRunState } from '../types.js';

interface AgentControlPanelProps {
  currentRun?: AgentRunState;
  isRunning: boolean;
  onStartRun: (instruction: string, stepByStep: boolean) => void;
  onNextStep: () => void;
  onStopRun: () => void;
}

export const AgentControlPanel: React.FC<AgentControlPanelProps> = ({
  currentRun,
  isRunning,
  onStartRun,
  onNextStep,
  onStopRun,
}) => {
  const [instruction, setInstruction] = useState('');
  const [stepByStep, setStepByStep] = useState(false);

  const presets = [
    'Agregá un buscador por nombre de cliente en la tabla de clientes.',
    'Ejecutar las pruebas del proyecto y corregir cualquier error encontrado.',
    'Inspeccionar la arquitectura del proyecto y resumir dependencias.',
    'Agregar una columna "Teléfono" a la tabla de clientes y datos de ejemplo.',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isRunning) return;
    onStartRun(instruction.trim(), stepByStep);
  };

  const getStatusBadge = () => {
    if (!currentRun) {
      return (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
          Listo para instrucciones
        </span>
      );
    }

    switch (currentRun.status) {
      case 'running':
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-600/50 flex items-center gap-1.5 animate-pulse font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Ejecutando paso {currentRun.currentTurn} de {15}...
          </span>
        );
      case 'waiting_plan_approval':
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/50 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            Plan generado: Esperando tu aprobación
          </span>
        );
      case 'waiting_confirmation':
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600/50 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Confirmación de seguridad requerida
          </span>
        );
      case 'completed':
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Misión completada exitosamente
          </span>
        );
      case 'error':
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600/50 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Fallo en ejecución: {currentRun.error?.slice(0, 45)}...
          </span>
        );
      case 'stopped':
        return (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
            Detenido manualmente
          </span>
        );
      default:
        return (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
            En espera
          </span>
        );
    }
  };

  return (
    <div className="bg-neutral-900 border-b border-neutral-800 p-4">
      {/* Top bar with Status & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
            Instrucción al Agente:
          </span>
          {getStatusBadge()}
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-neutral-500 shrink-0">Ejemplos:</span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInstruction(preset)}
              className="px-2 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60 truncate max-w-[200px] transition-colors"
              title={preset}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Main Prompt Form */}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="relative">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={isRunning}
            placeholder='Escribe en lenguaje natural lo que el agente debe realizar en el proyecto... (ej: "Agregá un buscador por nombre de cliente en la tabla de clientes y corre las pruebas")'
            rows={2}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 font-sans transition-colors resize-none shadow-inner"
          />
          {instruction && !isRunning && (
            <button
              type="button"
              onClick={() => setInstruction('')}
              className="absolute right-3 top-3 text-xs text-neutral-500 hover:text-neutral-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Bottom Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Step-by-step toggle */}
            <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stepByStep}
                onChange={(e) => setStepByStep(e.target.checked)}
                disabled={isRunning}
                className="rounded bg-neutral-950 border-neutral-700 text-emerald-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Modo paso a paso (inspeccionar cada acción antes de la siguiente)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {/* If in step-by-step mode or paused, allow "Siguiente Paso" */}
            {currentRun && (currentRun.status === 'idle' || currentRun.status === 'waiting_plan_approval') && (
              <button
                type="button"
                onClick={onNextStep}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-sm transition-colors"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Ejecutar Siguiente Paso</span>
              </button>
            )}

            {isRunning ? (
              <button
                type="button"
                onClick={onStopRun}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Detener Agente</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!instruction.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar Agente</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
