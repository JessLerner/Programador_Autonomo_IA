import { GitRepoStatus, SessionMemoryState } from '../types.js';

export type DecisionType = 'tool' | 'complete' | 'ask_user';

export interface ToolDecision {
  type: 'tool';
  tool: string;
  arguments: Record<string, unknown>;
  reason?: string;
}

export interface CompleteDecision {
  type: 'complete';
  summary: string;
  reason?: string;
}

export interface AskUserDecision {
  type: 'ask_user';
  question: string;
  reason?: string;
}

export type BrainDecision = ToolDecision | CompleteDecision | AskUserDecision;

export interface CompactToolEvent {
  step: number;
  tool: string;
  arguments: Record<string, unknown>;
  reason?: string;
  success: boolean;
  outputSnippet: string;
  error?: string;
  exitCode?: number;
}

export interface AgentContext {
  userRequest: string;
  workspace: {
    root: string;
    folderName: string;
    projectInfo?: string;
    topLevelFiles?: string[];
  };
  memory: SessionMemoryState;
  toolHistory: CompactToolEvent[];
  gitState?: GitRepoStatus;
  lastError?: string;
}

export interface Brain {
  id: string;
  name: string;
  description: string;
  ask(context: AgentContext): Promise<BrainDecision>;
}
