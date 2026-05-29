import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

import type {
  AgentFacts,
  CommandEvidence,
  LanguageMessage,
  SessionFacts,
  TokenUsage,
  ToolEvidence,
  WorkItem,
} from './types.ts';

type RawClaudeLine = Record<string, unknown>;

type LoadClaudeFactsOptions = {
  claudeRoot: string;
  since: Date;
  until: Date;
};

type MutableClaudeSession = Omit<SessionFacts, 'tokenUsage'>;

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function objectField(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

function eventTime(raw: RawClaudeLine): Date | undefined {
  const timestamp = stringField(raw.timestamp);
  if (!timestamp) {
    return undefined;
  }
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function findClaudeJsonlFiles(root: string): Promise<string[]> {
  const found: string[] = [];

  async function visit(directory: string) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        found.push(fullPath);
      }
    }
  }

  await visit(root);
  return found.sort();
}

function sessionFromLine(raw: RawClaudeLine, evidenceFile: string, startedAt?: Date): MutableClaudeSession {
  const cwd = stringField(raw.cwd) ?? 'Unknown project';
  const id = stringField(raw.sessionId) ?? stringField(raw.session_id) ?? path.basename(evidenceFile, '.jsonl');
  return {
    id,
    cwd,
    project: cwd,
    surface: 'Claude Code',
    source: 'claude',
    originator: 'Claude Code',
    startedAt,
    cliVersion: stringField(raw.version) ?? stringField(raw.claudeCodeVersion),
    git: {
      branch: stringField(raw.gitBranch) ?? stringField(raw.git_branch),
      repository: stringField(raw.gitRepository) ?? stringField(raw.repository),
      commit: stringField(raw.gitCommit) ?? stringField(raw.commit),
    },
    evidenceFile,
    completed: [],
    inProgress: [],
    lowConfidence: [],
    commands: [],
    toolEvents: [],
  };
}

function textContentFromMessage(raw: RawClaudeLine): string | undefined {
  const message = objectField(raw.message);
  const content = message?.content ?? raw.content;

  if (typeof content === 'string') {
    return content.trim() || undefined;
  }

  if (!Array.isArray(content)) {
    return undefined;
  }

  const parts = content.flatMap((item) => {
    const entry = objectField(item);
    if (!entry || entry.type !== 'text') {
      return [];
    }
    const text = stringField(entry.text);
    return text ? [text] : [];
  });

  return parts.join('\n').trim() || undefined;
}

function commandFromToolUse(item: unknown): string | undefined {
  const entry = objectField(item);
  if (!entry || entry.type !== 'tool_use') {
    return undefined;
  }
  const name = stringField(entry.name)?.toLowerCase();
  if (name !== 'bash') {
    return undefined;
  }
  return stringField(objectField(entry.input)?.command);
}

function commandsFromMessage(raw: RawClaudeLine, time: Date, evidenceFile: string): CommandEvidence[] {
  const message = objectField(raw.message);
  const content = message?.content ?? raw.content;
  const commands: CommandEvidence[] = [];

  if (Array.isArray(content)) {
    for (const item of content) {
      const command = commandFromToolUse(item);
      if (command) {
        commands.push({ command, time, evidenceFile });
      }
    }
  }

  const result = objectField(raw.toolUseResult) ?? objectField(raw.tool_use_result);
  const command = stringField(result?.command) ?? stringField(objectField(result?.input)?.command);
  if (command) {
    const exitCode = result?.exitCode ?? result?.exit_code;
    commands.push({
      command,
      exitCode: typeof exitCode === 'number' ? exitCode : undefined,
      time,
      evidenceFile,
    });
  }

  return commands;
}

function toolEventCategory(tool: string): ToolEvidence['category'] | undefined {
  switch (tool.toLowerCase()) {
    case 'read':
    case 'grep':
    case 'glob':
    case 'ls':
      return 'exploration';
    case 'edit':
    case 'multiedit':
    case 'write':
      return 'output';
    case 'todowrite':
      return 'planning';
    default:
      return undefined;
  }
}

function targetFromToolInput(tool: string, input: Record<string, unknown> | undefined): string {
  const normalizedTool = tool.toLowerCase();
  if (!input) {
    return normalizedTool === 'todowrite' ? 'todo list' : 'unknown target';
  }

  const filePath = stringField(input.file_path) ?? stringField(input.filePath);
  if (filePath) {
    return filePath;
  }

  const targetPath = stringField(input.path);
  if (targetPath) {
    return targetPath;
  }

  const pattern = stringField(input.pattern);
  if (pattern) {
    return pattern;
  }

  const glob = stringField(input.glob);
  if (glob) {
    return glob;
  }

  return normalizedTool === 'todowrite' ? 'todo list' : 'unknown target';
}

function toolEventFromToolUse(item: unknown, time: Date, evidenceFile: string): ToolEvidence | undefined {
  const entry = objectField(item);
  if (!entry || entry.type !== 'tool_use') {
    return undefined;
  }

  const tool = stringField(entry.name);
  if (!tool) {
    return undefined;
  }

  const category = toolEventCategory(tool);
  if (!category) {
    return undefined;
  }

  return {
    tool,
    category,
    target: targetFromToolInput(tool, objectField(entry.input)),
    time,
    evidenceFile,
  };
}

function toolEventsFromMessage(raw: RawClaudeLine, time: Date, evidenceFile: string): ToolEvidence[] {
  const message = objectField(raw.message);
  const content = message?.content ?? raw.content;

  if (!Array.isArray(content)) {
    return [];
  }

  return content.flatMap((item) => {
    const event = toolEventFromToolUse(item, time, evidenceFile);
    return event ? [event] : [];
  });
}

function lowConfidenceFromLine(raw: RawClaudeLine, time: Date, evidenceFile: string): WorkItem | undefined {
  if (raw.type === 'summary') {
    const summary = stringField(raw.summary);
    return summary ? { summary, time, evidenceFile, sourceType: 'claude_summary' } : undefined;
  }

  if (raw.type === 'assistant') {
    const summary = textContentFromMessage(raw);
    return summary ? { summary, time, evidenceFile, sourceType: 'claude_assistant' } : undefined;
  }

  return undefined;
}

function userMessageText(raw: RawClaudeLine): string | undefined {
  const message = objectField(raw.message);
  if (raw.type !== 'user' && message?.role !== 'user') {
    return undefined;
  }
  return textContentFromMessage(raw);
}

function emptyTokenUsage(): TokenUsage {
  return {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    approximate: false,
  };
}

function latestLowConfidence(session: MutableClaudeSession): WorkItem[] {
  return session.lowConfidence
    .toSorted((left, right) => left.time.getTime() - right.time.getTime())
    .slice(-1);
}

export async function loadClaudeFacts(options: LoadClaudeFactsOptions): Promise<AgentFacts> {
  const warnings: string[] = [];
  const sessions: MutableClaudeSession[] = [];
  const languageMessages: LanguageMessage[] = [];
  const files = await findClaudeJsonlFiles(options.claudeRoot);

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
    let session: MutableClaudeSession | undefined;

    for (const [index, lineText] of lines.entries()) {
      let raw: RawClaudeLine;
      try {
        raw = JSON.parse(lineText) as RawClaudeLine;
      } catch {
        warnings.push(`Malformed Claude Code JSONL skipped at ${file}:${index + 1}`);
        continue;
      }

      const time = eventTime(raw);
      if (!time) {
        warnings.push(`Claude Code event without valid timestamp skipped at ${file}:${index + 1}`);
        continue;
      }

      session ??= sessionFromLine(raw, file, time);
      if (time < options.since || time > options.until) {
        continue;
      }

      const userText = userMessageText(raw);
      if (userText) {
        languageMessages.push({
          text: userText,
          time,
          evidenceFile: file,
          sourceType: 'claude_user',
        });
      }

      const lowConfidence = lowConfidenceFromLine(raw, time, file);
      if (lowConfidence) {
        session.lowConfidence.push(lowConfidence);
      }
      session.commands.push(...commandsFromMessage(raw, time, file));
      session.toolEvents?.push(...toolEventsFromMessage(raw, time, file));
    }

    if (session) {
      sessions.push(session);
    }
  }

  const facts: AgentFacts = {
    sessions: sessions
      .map((session) => ({ ...session, lowConfidence: latestLowConfidence(session), tokenUsage: emptyTokenUsage() }))
      .filter((session) => {
        return session.completed.length > 0 ||
          session.inProgress.length > 0 ||
          session.lowConfidence.length > 0 ||
          session.commands.length > 0 ||
          (session.toolEvents?.length ?? 0) > 0;
      }),
    warnings,
  };
  if (languageMessages.length > 0) {
    facts.languageMessages = languageMessages;
  }
  return facts;
}
