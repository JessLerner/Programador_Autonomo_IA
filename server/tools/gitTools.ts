import fs from 'fs';
import path from 'path';
import { CommandTools } from './commandTools.js';
import { GitRepoStatus } from '../types.js';

export class GitTools {
  public static async isGitRepo(projectRoot: string): Promise<boolean> {
    const gitDir = path.join(projectRoot, '.git');
    if (fs.existsSync(gitDir)) return true;

    const res = await CommandTools.execute(projectRoot, 'git rev-parse --is-inside-work-tree', 5000);
    return res.success && res.stdout.includes('true');
  }

  public static async getStatus(projectRoot: string): Promise<GitRepoStatus> {
    const isRepo = await this.isGitRepo(projectRoot);
    if (!isRepo) {
      return {
        isGitRepo: false,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
      };
    }

    // Branch
    const branchRes = await CommandTools.execute(projectRoot, 'git branch --show-current', 5000);
    const branch = branchRes.stdout.trim() || 'HEAD';

    // Status porcelain
    const statusRes = await CommandTools.execute(projectRoot, 'git status --porcelain', 5000);
    const modifiedFiles: string[] = [];
    const stagedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    if (statusRes.stdout) {
      const lines = statusRes.stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const code = line.slice(0, 2);
        const file = line.slice(3).trim();

        if (code.includes('?')) {
          untrackedFiles.push(file);
        } else {
          if (code[0] !== ' ' && code[0] !== '?') stagedFiles.push(file);
          if (code[1] !== ' ' && code[1] !== '?') modifiedFiles.push(file);
        }
      }
    }

    // Diff
    const diffRes = await CommandTools.execute(projectRoot, 'git diff', 8000);

    return {
      isGitRepo: true,
      currentBranch: branch,
      clean: modifiedFiles.length === 0 && stagedFiles.length === 0 && untrackedFiles.length === 0,
      modifiedFiles,
      stagedFiles,
      untrackedFiles,
      recentDiff: diffRes.stdout || '',
    };
  }

  public static async getDiff(projectRoot: string): Promise<{ success: boolean; diff: string; error?: string }> {
    const isRepo = await this.isGitRepo(projectRoot);
    if (!isRepo) {
      return { success: false, diff: '', error: 'El proyecto actual no es un repositorio Git.' };
    }
    const res = await CommandTools.execute(projectRoot, 'git diff', 8000);
    return { success: res.success, diff: res.stdout, error: res.stderr };
  }

  public static async commit(projectRoot: string, message: string): Promise<{ success: boolean; output: string; error?: string }> {
    const isRepo = await this.isGitRepo(projectRoot);
    if (!isRepo) {
      return { success: false, output: '', error: 'El proyecto actual no es un repositorio Git.' };
    }
    // Add all modified tracked files and commit
    await CommandTools.execute(projectRoot, 'git add -u', 5000);
    const safeMessage = message.replace(/"/g, '\\"');
    const res = await CommandTools.execute(projectRoot, `git commit -m "${safeMessage}"`, 8000);
    return {
      success: res.success,
      output: res.combinedOutput,
      error: res.success ? undefined : res.stderr,
    };
  }
}
