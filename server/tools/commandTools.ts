import { exec } from 'child_process';
import path from 'path';

export interface CommandExecutionResult {
  success: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  timedOut: boolean;
  durationMs: number;
}

export class CommandTools {
  public static async execute(
    projectRoot: string,
    command: string,
    timeoutMs: number = 30000
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const resolvedCwd = path.resolve(projectRoot);

    return new Promise((resolve) => {
      let timedOut = false;
      
      const child = exec(
        command,
        {
          cwd: resolvedCwd,
          timeout: timeoutMs,
          maxBuffer: 5 * 1024 * 1024, // 5MB buffer
          env: {
            ...process.env,
            FORCE_COLOR: '0', // Clean plain-text logs for model & UI
            CI: 'true',
          },
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;
          const exitCode = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
          timedOut = error?.killed || false;

          const combined = [stdout, stderr].filter(Boolean).join('\n').trim();

          resolve({
            success: exitCode === 0,
            command,
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            combinedOutput: combined || (exitCode === 0 ? '(Comando ejecutado con éxito sin salida de texto)' : '(Error en ejecución)'),
            timedOut,
            durationMs,
          });
        }
      );
    });
  }
}
