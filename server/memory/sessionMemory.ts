import { PlanStep, SessionMemoryState } from '../types.js';

export class SessionMemory {
  private inspectedFiles: Set<string> = new Set();
  private modifiedFiles: Set<string> = new Set();
  private executedCommands: Array<{ command: string; exitCode: number; success: boolean }> = [];
  private errorsEncountered: string[] = [];
  private correctionsAttempted: string[] = [];
  private currentPlan: PlanStep[] = [];
  private goal: string = '';

  constructor(goal: string = '') {
    this.goal = goal;
  }

  public setGoal(goal: string) {
    this.goal = goal;
  }

  public recordFileInspected(filePath: string) {
    this.inspectedFiles.add(filePath);
  }

  public recordFileModified(filePath: string) {
    this.modifiedFiles.add(filePath);
  }

  public recordCommand(command: string, exitCode: number, success: boolean) {
    this.executedCommands.push({ command, exitCode, success });
  }

  public recordError(errorText: string) {
    if (!this.errorsEncountered.includes(errorText)) {
      this.errorsEncountered.push(errorText);
    }
  }

  public recordCorrection(attempt: string) {
    this.correctionsAttempted.push(attempt);
  }

  public setPlan(steps: Array<{ id: number; title: string; description: string }>) {
    this.currentPlan = steps.map((s, idx) => ({
      ...s,
      status: idx === 0 ? 'in_progress' : 'pending',
    }));
  }

  public updateStepStatus(stepId: number, status: PlanStep['status']) {
    const step = this.currentPlan.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
    }
  }

  public advanceStep() {
    const inProgIndex = this.currentPlan.findIndex((s) => s.status === 'in_progress');
    if (inProgIndex !== -1) {
      this.currentPlan[inProgIndex].status = 'completed';
      if (inProgIndex + 1 < this.currentPlan.length) {
        this.currentPlan[inProgIndex + 1].status = 'in_progress';
      }
    }
  }

  public getState(): SessionMemoryState {
    return {
      inspectedFiles: Array.from(this.inspectedFiles),
      modifiedFiles: Array.from(this.modifiedFiles),
      executedCommands: [...this.executedCommands],
      errorsEncountered: [...this.errorsEncountered],
      correctionsAttempted: [...this.correctionsAttempted],
      currentPlan: [...this.currentPlan],
      goal: this.goal,
    };
  }

  public clear() {
    this.inspectedFiles.clear();
    this.modifiedFiles.clear();
    this.executedCommands = [];
    this.errorsEncountered = [];
    this.correctionsAttempted = [];
    this.currentPlan = [];
    this.goal = '';
  }

  /**
   * Formats a concise summary of the memory for injection into agent context prompt.
   */
  public toPromptContext(): string {
    const lines: string[] = [];
    if (this.goal) lines.push(`OBJETIVO ACTUAL: "${this.goal}"`);
    if (this.currentPlan.length > 0) {
      lines.push('PLAN ACTUAL:');
      this.currentPlan.forEach((s) => {
        const mark = s.status === 'completed' ? '[✓]' : s.status === 'in_progress' ? '[▶]' : '[ ]';
        lines.push(`  ${mark} Paso ${s.id}: ${s.title} (${s.description})`);
      });
    }
    if (this.inspectedFiles.size > 0) {
      lines.push(`ARCHIVOS INSPECCIONADOS: ${Array.from(this.inspectedFiles).join(', ')}`);
    }
    if (this.modifiedFiles.size > 0) {
      lines.push(`ARCHIVOS MODIFICADOS HASTA AHORA: ${Array.from(this.modifiedFiles).join(', ')}`);
    }
    if (this.executedCommands.length > 0) {
      const lastCmds = this.executedCommands.slice(-4).map((c) => `"${c.command}" (código ${c.exitCode})`);
      lines.push(`ÚLTIMOS COMANDOS: ${lastCmds.join('; ')}`);
    }
    if (this.errorsEncountered.length > 0) {
      const recentErrors = this.errorsEncountered.slice(-3);
      lines.push(`ERRORES RECIENTES ENCONTRADOS:\n${recentErrors.map((e) => `  - ${e.slice(0, 200)}`).join('\n')}`);
    }
    return lines.join('\n');
  }
}
