import React, { useState } from 'react';
import {
  ListChecks,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileCode,
  Terminal,
  FileEdit,
  Trash2,
  GitCommit,
  Check,
  Sparkles,
  ShieldAlert,
  BrainCircuit,
  Cpu,
  MessageSquare,
  Send,
} from 'lucide-react';
import { AgentRunState } from '../types.js';

interface PlanAndHistoryProps {
  currentRun?: AgentRunState;
  onApprovePlan: () => void;
  onApproveAction: (confirmationId: string) => void;
  onRejectAction: (confirmationId: string, reason: string) => void;
  onAnswerQuestion?: (answer: string) => void;
}

export const PlanAndHistory: React.FC<PlanAndHistoryProps> = ({
  currentRun,
  onApprovePlan,
  onApproveAction,
  onRejectAction,
  onAnswerQuestion,
}) => {
  const [userAnswer, setUserAnswer] = useState('');

  if (!currentRun) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-500 text-center">
        <div className="w-12 h-12 rounded-xl bg-neutral-800/80 flex items-center justify-center mb-3 text-neutral-400 border border-neutral-700/50">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-300 mb-1">
          Ninguna tarea en ejecución
        </h3>
        <p className="text-xs max-w-sm text-neutral-500">
          Ingresa una instrucción arriba y presiona "Iniciar Agente". El Brain analizará el requerimiento, decidirá qué herramientas solicitar a la máquina y resolverá la tarea paso a paso.
        </p>
      </div>
    );
  }

  const plan = currentRun.memory.currentPlan;
  const isWaitingPlan = currentRun.status === 'waiting_plan_approval';
  const pendingConf = currentRun.pendingConfirmation;
  const isWaitingUser = currentRun.status === 'waiting_user_input';

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'read_file':
        return <FileCode className="w-4 h-4 text-sky-400" />;
      case 'write_file':
      case 'edit_file':
        return <FileEdit className="w-4 h-4 text-amber-400" />;
      case 'delete_file':
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      case 'run_command':
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case 'git_commit':
      case 'git_status':
      case 'git_diff':
        return <GitCommit className="w-4 h-4 text-purple-400" />;
      default:
        return <Cpu className="w-4 h-4 text-indigo-400" />;
    }
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userAnswer.trim() && onAnswerQuestion) {
      onAnswerQuestion(userAnswer.trim());
      setUserAnswer('');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
      {/* 1. Plan Section */}
      {plan.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-neutral-200 text-xs uppercase tracking-wider">
                Plan del Brain
              </span>
            </div>
            {isWaitingPlan && (
              <span className="text-[11px] font-medium text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 animate-pulse">
                Aprobación Requerida
              </span>
            )}
          </div>

          <div className="space-y-2">
            {plan.map((step) => {
              const isDone = step.status === 'completed';
              const isInProg = step.status === 'in_progress';
              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors ${
                    isDone
                      ? 'bg-neutral-950/40 border-neutral-800/80 text-neutral-400'
                      : isInProg
                      ? 'bg-sky-950/30 border-sky-800/50 text-neutral-100 shadow-sm'
                      : 'bg-neutral-950/20 border-neutral-800/40 text-neutral-400'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : isInProg ? (
                      <Clock className="w-4 h-4 text-sky-400 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-neutral-600 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                        {step.id}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs flex items-center gap-2">
                      <span className={isDone ? 'line-through text-neutral-500' : 'text-neutral-200'}>
                        {step.title}
                      </span>
                    </div>
                    {step.description && (
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plan Approval Banner */}
          {isWaitingPlan && (
            <div className="mt-3 p-3 bg-amber-950/40 border border-amber-700/60 rounded-lg flex items-center justify-between gap-3">
              <div className="text-amber-200 text-xs">
                <span className="font-semibold block">El Brain ha formulado el plan anterior.</span>
                <span className="text-[11px] text-amber-300/80">
                  Revísalo antes de autorizar a la máquina para aplicar modificaciones de archivos.
                </span>
              </div>
              <button
                onClick={onApprovePlan}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition-colors shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aprobar Plan y Continuar</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. User Input Request (ask_user decision) */}
      {isWaitingUser && currentRun.userQuestion && (
        <div className="bg-sky-950/40 border border-sky-600/70 rounded-xl p-4 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-sky-200 mb-1">
                El Brain necesita información adicional:
              </h4>
              <p className="text-xs text-neutral-200 bg-neutral-950/70 p-2.5 rounded-lg border border-neutral-800 font-medium">
                "{currentRun.userQuestion}"
              </p>
              <form onSubmit={handleAnswerSubmit} className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-sky-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!userAnswer.trim()}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Send className="w-3 h-3" />
                  <span>Responder</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. Security Pending Confirmation Banner */}
      {pendingConf && (
        <div className="bg-rose-950/50 border border-rose-600/70 rounded-xl p-4 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-rose-200">
                  Confirmación de Seguridad Requerida
                </h4>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700">
                  Severidad: {pendingConf.severity}
                </span>
              </div>
              <p className="text-xs text-rose-300 mt-1">{pendingConf.reason}</p>

              <div className="mt-2.5 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 font-mono text-[11px] text-neutral-300 overflow-x-auto">
                <div>
                  <span className="text-neutral-500">Herramienta: </span>
                  <span className="text-amber-400 font-bold">{pendingConf.action.action}</span>
                </div>
                {pendingConf.action.path && (
                  <div>
                    <span className="text-neutral-500">Archivo: </span>
                    <span className="text-neutral-200">{pendingConf.action.path}</span>
                  </div>
                )}
                {pendingConf.action.command && (
                  <div>
                    <span className="text-neutral-500">Comando: </span>
                    <span className="text-emerald-400">{pendingConf.action.command}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => onRejectAction(pendingConf.id, 'Cancelado por el usuario')}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition-colors"
                >
                  Rechazar Acción
                </button>
                <button
                  onClick={() => onApproveAction(pendingConf.id)}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aprobar y Ejecutar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Final Summary Card */}
      {currentRun.finalSummary && (
        <div className="bg-emerald-950/40 border border-emerald-600/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <h4 className="font-bold text-sm text-emerald-200">
              Resumen Final del Brain
            </h4>
          </div>
          <p className="text-neutral-200 text-xs leading-relaxed whitespace-pre-wrap">
            {currentRun.finalSummary}
          </p>

          <div className="mt-3 pt-3 border-t border-emerald-800/40 grid grid-cols-2 gap-2 text-[11px] text-neutral-300">
            <div className="bg-neutral-900/60 p-2 rounded border border-neutral-800">
              <span className="text-neutral-400 block text-[10px]">Archivos modificados:</span>
              <span className="font-semibold text-emerald-300 font-mono">
                {currentRun.memory.modifiedFiles.length > 0
                  ? currentRun.memory.modifiedFiles.join(', ')
                  : 'Ninguno'}
              </span>
            </div>
            <div className="bg-neutral-900/60 p-2 rounded border border-neutral-800">
              <span className="text-neutral-400 block text-[10px]">Herramientas invocadas:</span>
              <span className="font-semibold text-emerald-300 font-mono">
                {currentRun.history.filter((h) => h.role === 'tool').length} ejecuciones
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Chronological Stream: BRAIN DECISION vs MACHINE RESULT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-400">
            Ciclo de Ejecución ({currentRun.history.length} eventos)
          </h4>
        </div>

        {currentRun.history.map((item, idx) => {
          if (item.role === 'user') {
            return (
              <div
                key={idx}
                className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex items-start gap-2.5"
              >
                <div className="w-6 h-6 rounded-md bg-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-xs shrink-0">
                  U
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-neutral-400">
                    Instrucción del Usuario:
                  </div>
                  <div className="text-neutral-100 text-xs mt-0.5">{item.result}</div>
                </div>
              </div>
            );
          }

          if (item.role === 'agent') {
            const toolName = item.decision?.type === 'tool' ? item.decision.tool : item.action?.action || 'razonamiento';
            const reason = item.thought || item.decision?.reason;
            const args = item.decision?.arguments || item.action;

            return (
              <div
                key={idx}
                className="bg-neutral-900/90 p-3.5 rounded-xl border border-purple-500/30 space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 font-mono tracking-wide">
                      <BrainCircuit className="w-3 h-3 text-purple-400" />
                      BRAIN DECISION
                    </span>
                    <span className="text-neutral-500">→</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-xs text-neutral-200">
                      {getToolIcon(toolName || '')}
                      <span>{toolName}</span>
                    </div>
                  </div>
                </div>

                {reason && (
                  <div className="text-neutral-300 text-xs bg-purple-950/20 p-2.5 rounded-lg border border-purple-900/40 leading-relaxed">
                    <span className="font-semibold text-purple-300">Razonamiento: </span>
                    {reason}
                  </div>
                )}

                {args && Object.keys(args).length > 0 && (
                  <div className="bg-neutral-950/80 p-2 rounded border border-neutral-800 font-mono text-[10px] text-neutral-400 overflow-x-auto">
                    <span className="text-neutral-500">Argumentos: </span>
                    <span className="text-neutral-300">{JSON.stringify(args)}</span>
                  </div>
                )}
              </div>
            );
          }

          if (item.role === 'tool') {
            const hasError = !!item.error;
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs font-mono ml-4 ${
                  hasError
                    ? 'bg-rose-950/30 border-rose-600/50 text-rose-200'
                    : 'bg-neutral-950 border-emerald-600/30 text-neutral-200 shadow-inner'
                }`}
              >
                <div className="flex items-center justify-between font-sans mb-1.5">
                  <span
                    className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 font-mono tracking-wide ${
                      hasError
                        ? 'bg-rose-900/40 text-rose-300 border border-rose-700/60'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                    }`}
                  >
                    <Cpu className="w-3 h-3 text-emerald-400" />
                    MACHINE RESULT
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {hasError ? 'Error en ejecución' : 'Completado con éxito'}
                  </span>
                </div>

                <div className="overflow-x-auto whitespace-pre-wrap max-h-48 text-[11px] text-neutral-300 leading-relaxed bg-neutral-900/60 p-2 rounded border border-neutral-800/80">
                  {hasError ? item.error : item.result || '(Completado)'}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};
