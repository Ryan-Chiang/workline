// 提取、渲染和 CLI 编排共享的数据形状；本文件不放运行逻辑，保持模块边界清晰。
export type TokenFields = {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
};

export type TokenUsage = TokenFields & {
  approximate: boolean;
};

// 命令证据和工作事项分开建模；验证命令通常只是支撑成果，不等同于成果本身。
export type CommandEvidence = {
  command: string;
  exitCode?: number;
  time: Date;
  evidenceFile: string;
};

export type ToolEventCategory = 'exploration' | 'output' | 'planning';

export type ToolEvidence = {
  tool: string;
  category: ToolEventCategory;
  target: string;
  time: Date;
  evidenceFile: string;
};

export type LanguageMessage = {
  text: string;
  time: Date;
  evidenceFile: string;
  sourceType: 'codex_user' | 'claude_user';
};

// 工作事项保留来源事件类型，避免渲染层把低置信度 Agent 对话提升成已完成成果。
export type WorkItem = {
  summary: string;
  time: Date;
  evidenceFile: string;
  sourceType?: 'task_started' | 'agent_message' | 'task_complete' | 'claude_assistant' | 'claude_summary';
};

// SessionFacts 是本地证据的归一化单元；原始 Codex JSONL 的形状差异在进入报告前消化。
export type SessionFacts = {
  id: string;
  cwd: string;
  project: string;
  surface: string;
  source: string;
  originator: string;
  startedAt?: Date;
  cliVersion?: string;
  git?: {
    branch?: string;
    repository?: string;
    commit?: string;
  };
  evidenceFile: string;
  completed: WorkItem[];
  inProgress: WorkItem[];
  lowConfidence: WorkItem[];
  commands: CommandEvidence[];
  toolEvents?: ToolEvidence[];
  tokenUsage: TokenUsage;
};

// AgentFacts 同时携带可用会话和警告；坏行只降低置信度，不应中断整个报告周期。
export type AgentFacts = {
  sessions: SessionFacts[];
  warnings: string[];
  languageMessages?: LanguageMessage[];
};

export type CodexFacts = AgentFacts;

export type LoadCodexFactsOptions = {
  codexRoot: string;
  since: Date;
  until: Date;
};

export type ReportWindow = {
  since: Date;
  until: Date;
  timezone: string;
  generatedAt: Date;
  reportLanguage?: import('./locale.ts').ReportLanguage;
  reportLanguageSource?: import('./locale.ts').ReportLanguageSource;
  reportLanguageConfidence?: import('./locale.ts').ReportLanguageConfidence;
};

export type AgentContextWindow = ReportWindow & {
  finalReportPath: string;
};
