import { AuditLogEntry } from '../types.js';

export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private listeners: Array<(entry: AuditLogEntry) => void> = [];

  public log(type: AuditLogEntry['type'], message: string, details?: any): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    };
    this.logs.push(entry);
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Audit listener error:', err);
      }
    });
    return entry;
  }

  public getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  public subscribe(fn: (entry: AuditLogEntry) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public clear() {
    this.logs = [];
  }
}

export const auditLogger = new AuditLogger();
