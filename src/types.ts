export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: FileNode[];
}

export interface GitRepoStatus {
  isGitRepo: boolean;
  currentBranch?: string;
  clean?: boolean;
  modifiedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  recentDiff?: string;
}

export interface PlanStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface BrainDecision {
  type: 'tool' | 'complete' | 'ask_user';
  tool?: string;
  arguments?: Record<string, unknown>;
  summary?: string;
  question?: string;
  reason?: string;
}

export interface AgentAction {
  action: string;
  path?: string;
  content?: string;
  old_str?: string;
  new_str?: string;
  startLine?: number;
  endLine?: number;
  command?: string;
  query?: string;
  message?: string;
  plan?: Array<{ id: number; title: string; description: string }>;
  summary?: string;
  thought?: string;
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  diff?: string;
  requiresConfirmation?: boolean;
  confirmationReason?: string;
}

export interface PendingConfirmation {
  id: string;
  action: AgentAction;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  type: 'USER_PROMPT' | 'AGENT_THOUGHT' | 'PLAN_CREATED' | 'TOOL_INVOKED' | 'TOOL_RESULT' | 'ERROR_DETECTED' | 'CORRECTION_ATTEMPT' | 'USER_CONFIRMATION' | 'TASK_COMPLETED';
  message: string;
  details?: any;
}

export interface SessionMemoryState {
  inspectedFiles: string[];
  modifiedFiles: string[];
  executedCommands: Array<{ command: string; exitCode: number; success: boolean }>;
  errorsEncountered: string[];
  correctionsAttempted: string[];
  currentPlan: PlanStep[];
  goal: string;
}

export interface TurnHistoryItem {
  role: 'user' | 'agent' | 'tool';
  action?: AgentAction;
  decision?: BrainDecision;
  result?: string;
  thought?: string;
  error?: string;
}

export interface AgentRunState {
  runId: string;
  status: 'idle' | 'running' | 'waiting_plan_approval' | 'waiting_confirmation' | 'waiting_user_input' | 'completed' | 'error' | 'stopped';
  currentTurn: number;
  currentDecision?: BrainDecision;
  currentAction?: AgentAction;
  lastResult?: ActionResult;
  pendingConfirmation?: PendingConfirmation;
  userQuestion?: string;
  memory: SessionMemoryState;
  history: TurnHistoryItem[];
  planApproved: boolean;
  finalSummary?: string;
  error?: string;
}

export interface AIProviderItem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}
