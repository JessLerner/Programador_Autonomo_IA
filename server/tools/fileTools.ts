import fs from 'fs';
import path from 'path';
import { SafetyGuard } from '../security/safetyGuard.js';
import { FileNode } from '../types.js';

export class FileTools {
  /**
   * Reads a file. Supports optional startLine and endLine (1-indexed).
   */
  public static async readFile(
    projectRoot: string,
    relPath: string,
    startLine?: number,
    endLine?: number
  ): Promise<{ success: boolean; content?: string; totalLines?: number; error?: string }> {
    const check = SafetyGuard.resolveSafePath(projectRoot, relPath);
    if (!check.safe) return { success: false, error: check.error };

    try {
      if (!fs.existsSync(check.fullPath)) {
        return { success: false, error: `El archivo "${relPath}" no existe en el proyecto.` };
      }
      const stat = await fs.promises.stat(check.fullPath);
      if (stat.isDirectory()) {
        return { success: false, error: `"${relPath}" es un directorio, use list_directory.` };
      }
      const fullText = await fs.promises.readFile(check.fullPath, 'utf-8');
      const lines = fullText.split('\n');
      const totalLines = lines.length;

      // Range slicing if requested
      if (startLine !== undefined || endLine !== undefined) {
        const start = Math.max(1, startLine || 1);
        const end = Math.min(totalLines, endLine || totalLines);
        const sliced = lines.slice(start - 1, end).map((line, idx) => `${start + idx} | ${line}`).join('\n');
        return {
          success: true,
          content: sliced,
          totalLines,
        };
      }

      return { success: true, content: fullText, totalLines };
    } catch (err: any) {
      return { success: false, error: `Error al leer "${relPath}": ${err.message}` };
    }
  }

  public static async writeFile(projectRoot: string, relPath: string, content: string): Promise<{ success: boolean; diff?: string; error?: string }> {
    const check = SafetyGuard.resolveSafePath(projectRoot, relPath);
    if (!check.safe) return { success: false, error: check.error };

    try {
      const parentDir = path.dirname(check.fullPath);
      if (!fs.existsSync(parentDir)) {
        await fs.promises.mkdir(parentDir, { recursive: true });
      }

      let oldContent = '';
      if (fs.existsSync(check.fullPath)) {
        oldContent = await fs.promises.readFile(check.fullPath, 'utf-8');
      }

      await fs.promises.writeFile(check.fullPath, content, 'utf-8');
      const diff = this.generateSimpleDiff(relPath, oldContent, content);
      return { success: true, diff };
    } catch (err: any) {
      return { success: false, error: `Error al escribir en "${relPath}": ${err.message}` };
    }
  }

  public static async editFile(projectRoot: string, relPath: string, oldStr: string, newStr: string): Promise<{ success: boolean; diff?: string; error?: string }> {
    const check = SafetyGuard.resolveSafePath(projectRoot, relPath);
    if (!check.safe) return { success: false, error: check.error };

    try {
      if (!fs.existsSync(check.fullPath)) {
        return { success: false, error: `El archivo "${relPath}" no existe para editar.` };
      }
      const current = await fs.promises.readFile(check.fullPath, 'utf-8');
      if (!current.includes(oldStr)) {
        return {
          success: false,
          error: `No se encontró el bloque de texto especificado para reemplazar en "${relPath}". Asegúrese de que coincida exactamente.`,
        };
      }
      const updated = current.replace(oldStr, newStr);
      await fs.promises.writeFile(check.fullPath, updated, 'utf-8');
      const diff = this.generateSimpleDiff(relPath, current, updated);
      return { success: true, diff };
    } catch (err: any) {
      return { success: false, error: `Error editando "${relPath}": ${err.message}` };
    }
  }

  public static async deleteFile(projectRoot: string, relPath: string): Promise<{ success: boolean; error?: string }> {
    const check = SafetyGuard.resolveSafePath(projectRoot, relPath);
    if (!check.safe) return { success: false, error: check.error };

    try {
      if (!fs.existsSync(check.fullPath)) {
        return { success: false, error: `El archivo "${relPath}" no existe.` };
      }
      const stat = await fs.promises.stat(check.fullPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(check.fullPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(check.fullPath);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Error eliminando "${relPath}": ${err.message}` };
    }
  }

  public static async listDirectory(projectRoot: string, relPath: string = '', maxDepth: number = 3): Promise<{ success: boolean; tree?: FileNode; error?: string }> {
    const check = SafetyGuard.resolveSafePath(projectRoot, relPath || '.');
    if (!check.safe) return { success: false, error: check.error };

    try {
      if (!fs.existsSync(check.fullPath)) {
        return { success: false, error: `El directorio "${relPath}" no existe.` };
      }

      const buildTree = async (currentDir: string, currentDepth: number): Promise<FileNode> => {
        const name = path.basename(currentDir) || path.basename(projectRoot) || 'root';
        const relativeToRoot = path.relative(projectRoot, currentDir) || '.';
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

        const children: FileNode[] = [];
        // Skip heavy node_modules and .git internals from tree expansion, but note they exist
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') {
            children.push({
              name: entry.name,
              path: path.relative(projectRoot, path.join(currentDir, entry.name)),
              isDirectory: true,
              children: [],
            });
            continue;
          }

          const fullEntryPath = path.join(currentDir, entry.name);
          const relEntryPath = path.relative(projectRoot, fullEntryPath);

          if (entry.isDirectory()) {
            if (currentDepth < maxDepth) {
              const subTree = await buildTree(fullEntryPath, currentDepth + 1);
              children.push(subTree);
            } else {
              children.push({
                name: entry.name,
                path: relEntryPath,
                isDirectory: true,
                children: [],
              });
            }
          } else {
            let size = 0;
            try {
              const stat = await fs.promises.stat(fullEntryPath);
              size = stat.size;
            } catch {}
            children.push({
              name: entry.name,
              path: relEntryPath,
              isDirectory: false,
              size,
            });
          }
        }

        // Sort: directories first, then alphabetically
        children.sort((a, b) => {
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });

        return {
          name,
          path: relativeToRoot,
          isDirectory: true,
          children,
        };
      };

      const tree = await buildTree(check.fullPath, 1);
      return { success: true, tree };
    } catch (err: any) {
      return { success: false, error: `Error listando directorio "${relPath}": ${err.message}` };
    }
  }

  public static async searchFiles(
    projectRoot: string,
    query: string,
    subPath: string = ''
  ): Promise<{ success: boolean; matches?: Array<{ file: string; line: number; preview: string }>; error?: string }> {
    const searchTarget = path.resolve(projectRoot, subPath || '.');
    const check = SafetyGuard.resolveSafePath(projectRoot, searchTarget);
    if (!check.safe) return { success: false, error: check.error };

    try {
      const matches: Array<{ file: string; line: number; preview: string }> = [];
      const lowerQuery = query.toLowerCase();

      const walk = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            try {
              const stat = await fs.promises.stat(fullPath);
              if (stat.size > 1024 * 1024) continue; // Skip files > 1MB
              const content = await fs.promises.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(lowerQuery)) {
                  matches.push({
                    file: path.relative(projectRoot, fullPath),
                    line: i + 1,
                    preview: lines[i].trim().slice(0, 140),
                  });
                  if (matches.length >= 30) return;
                }
              }
            } catch {}
          }
        }
      };

      await walk(check.fullPath);
      return { success: true, matches };
    } catch (err: any) {
      return { success: false, error: `Error en búsqueda: ${err.message}` };
    }
  }

  public static generateSimpleDiff(filePath: string, oldStr: string, newStr: string): string {
    const oldLines = oldStr ? oldStr.split('\n') : [];
    const newLines = newStr ? newStr.split('\n') : [];
    const diffLines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

    let maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const o = oldLines[i];
      const n = newLines[i];
      if (o === undefined) {
        diffLines.push(`+ ${n}`);
      } else if (n === undefined) {
        diffLines.push(`- ${o}`);
      } else if (o !== n) {
        diffLines.push(`- ${o}`);
        diffLines.push(`+ ${n}`);
      } else if (i < 2 || i >= maxLen - 2) {
        diffLines.push(`  ${o}`);
      }
    }
    return diffLines.join('\n');
  }
}
