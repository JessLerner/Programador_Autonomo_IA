import path from 'path';
import { AgentAction } from '../types.js';

export interface SafetyCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
  resolvedPath?: string;
}

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[fq]\s+\/[fq]/i,
  /\brmdir\s+\/s/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-fdx\b/i,
  /\bgit\s+push\s+.*--force\b/i,
  /\bdrop\s+database\b/i,
  /\bdrop\s+table\b/i,
  /:(){ :|:& };:/, // Fork bomb
];

const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,
  /id_rsa/i,
  /credentials\.json/i,
  /\.git\//i,
  /\.ssh/i,
  /secrets?\./i
];

export class SafetyGuard {
  /**
   * Resolves and verifies that a target path stays safely within the project root.
   * Uses path.relative to prevent prefix-collision attacks.
   */
  public static resolveSafePath(projectRoot: string, targetPath: string): { safe: boolean; fullPath: string; error?: string } {
    const normalizedRoot = path.resolve(projectRoot);
    const resolvedPath = path.resolve(normalizedRoot, targetPath);

    // Confinement check using path.relative
    const rel = path.relative(normalizedRoot, resolvedPath);
    const isContained = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));

    if (!isContained) {
      return {
        safe: false,
        fullPath: resolvedPath,
        error: `Acceso denegado: El archivo "${targetPath}" se encuentra fuera del workspace autorizado (${projectRoot}).`,
      };
    }

    return { safe: true, fullPath: resolvedPath };
  }

  /**
   * Assesses whether an action is safe or requires user confirmation.
   */
  public static assessAction(
    action: AgentAction,
    projectRoot: string,
    safetyMode: 'safe' | 'autopilot' = 'safe'
  ): SafetyCheckResult {
    // 1. Path confinement check for file operations
    if (action.path) {
      const pathCheck = this.resolveSafePath(projectRoot, action.path);
      if (!pathCheck.safe) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: pathCheck.error,
        };
      }

      // Check for sensitive files
      const relPath = path.relative(projectRoot, pathCheck.fullPath);
      for (const pattern of SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(relPath)) {
          return {
            allowed: true,
            requiresConfirmation: true,
            severity: 'high',
            reason: `Modificación de archivo sensible detectada: ${relPath}`,
            resolvedPath: pathCheck.fullPath,
          };
        }
      }
    }

    // 2. Destructive file operations
    if (action.action === 'delete_file') {
      if (safetyMode === 'safe') {
        return {
          allowed: true,
          requiresConfirmation: true,
          severity: 'high',
          reason: `Eliminación de archivo: ${action.path}. Requiere aprobación explícita.`,
        };
      }
    }

    // 3. Command execution checks
    if (action.action === 'run_command' && action.command) {
      const cmd = action.command.trim();
      for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        if (pattern.test(cmd)) {
          return {
            allowed: true,
            requiresConfirmation: true,
            severity: 'high',
            reason: `Comando potencialmente destructivo detectado: "${cmd}". Requiere confirmación obligatoria.`,
          };
        }
      }

      // In safe mode, commands that modify git state destructively require confirmation
      if (safetyMode === 'safe' && /git\s+(checkout\s+\.|restore\s+\.|branch\s+-D)/i.test(cmd)) {
        return {
          allowed: true,
          requiresConfirmation: true,
          severity: 'medium',
          reason: `Operación Git que puede descartar cambios: "${cmd}"`,
        };
      }
    }

    // 4. Git commit in safe mode can be confirmed if configured
    if (action.action === 'git_commit' && safetyMode === 'safe') {
      return {
        allowed: true,
        requiresConfirmation: true,
        severity: 'low',
        reason: `Crear commit en Git: "${action.message || 'Actualización de agente'}"`,
      };
    }

    return { allowed: true, requiresConfirmation: false };
  }
}
