import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

import type {
  CodexFacts,
  LoadCodexFactsOptions,
  SessionFacts,
  TokenFields,
  TokenUsage,
} from './types.ts';

type RawLine = {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

// 提取阶段暂存 token 样本；只有读完整个会话并确定报告窗口后，才能计算周期用量。
type MutableSession = Omit<SessionFacts, 'tokenUsage'> & {
  tokenSamples: Array<{ time: Date; tokens: TokenFields }>;
  hasWindowTokenFact: boolean;
};

const emptyTokens = (): TokenFields => ({
  input_tokens: 0,
  cached_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
  total_tokens: 0,
});

function numberField(payload: Record<string, unknown>, field: keyof TokenFields): number {
  const value = payload[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function objectField(payload: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
  const value = payload[field];
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

// Codex 历史上既在 payload 根部，也在 info.total_token_usage 下输出 token 数据；两种都支持以保留旧日志证据。
function extractTokens(payload: Record<string, unknown>): TokenFields | undefined {
  const tokenPayload = objectField(objectField(payload, 'info') ?? {}, 'total_token_usage') ?? payload;
  const tokenFields: Array<keyof TokenFields> = [
    'input_tokens',
    'cached_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'total_tokens',
  ];

  if (!tokenFields.some((field) => typeof tokenPayload[field] === 'number' && Number.isFinite(tokenPayload[field]))) {
    return undefined;
  }

  return {
    input_tokens: numberField(tokenPayload, 'input_tokens'),
    cached_input_tokens: numberField(tokenPayload, 'cached_input_tokens'),
    output_tokens: numberField(tokenPayload, 'output_tokens'),
    reasoning_output_tokens: numberField(tokenPayload, 'reasoning_output_tokens'),
    total_tokens: numberField(tokenPayload, 'total_tokens'),
  };
}

function subtractTokens(after: TokenFields, before: TokenFields): TokenFields {
  return {
    input_tokens: Math.max(0, after.input_tokens - before.input_tokens),
    cached_input_tokens: Math.max(0, after.cached_input_tokens - before.cached_input_tokens),
    output_tokens: Math.max(0, after.output_tokens - before.output_tokens),
    reasoning_output_tokens: Math.max(0, after.reasoning_output_tokens - before.reasoning_output_tokens),
    total_tokens: Math.max(0, after.total_tokens - before.total_tokens),
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function classifySurface(originator: string, source: string): string {
  if (originator === 'Codex Desktop') {
    return 'Codex App';
  }
  if (originator === 'codex-tui' || originator === 'codex_exec' || source === 'cli') {
    return 'Codex CLI';
  }
  return originator || source || 'Unknown';
}

// session_meta 是 cwd、surface 和 git 身份的稳定来源；未知字段在这里保守归一化，不留给后续推断。
function sessionFromMeta(payload: Record<string, unknown>, evidenceFile: string, startedAt?: Date): MutableSession {
  const git = typeof payload.git === 'object' && payload.git ? payload.git as Record<string, unknown> : {};
  const source = stringField(payload.source) ?? 'Unknown';
  const originator = stringField(payload.originator) ?? '';
  const cwd = stringField(payload.cwd) ?? stringField(payload.project) ?? 'Unknown project';
  const id = stringField(payload.id) ?? stringField(payload.session_id) ?? `${evidenceFile}:${cwd}`;

  return {
    id,
    cwd,
    project: cwd,
    surface: classifySurface(originator, source),
    source,
    originator,
    startedAt,
    cliVersion: stringField(payload.cli_version),
    git: {
      branch: stringField(git.branch) ?? stringField(payload.git_branch),
      repository: stringField(git.repository) ?? stringField(git.repository_url) ?? stringField(payload.git_repository),
      commit: stringField(git.commit) ?? stringField(git.commit_hash) ?? stringField(payload.git_commit),
    },
    evidenceFile,
    completed: [],
    inProgress: [],
    lowConfidence: [],
    commands: [],
    tokenSamples: [],
    hasWindowTokenFact: false,
  };
}

function defaultSession(evidenceFile: string): MutableSession {
  return sessionFromMeta({ id: evidenceFile, cwd: 'Unknown project' }, evidenceFile);
}

// 递归发现刻意按文件名判断；目录结构会随日期和客户端变化，rollout-*.jsonl 才是稳定证据标记。
async function findRolloutFiles(root: string): Promise<string[]> {
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
      } else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) {
        found.push(fullPath);
      }
    }
  }

  await visit(root);
  return found.sort();
}

function eventTime(line: RawLine): Date | undefined {
  const timestamp = stringField(line.timestamp);
  if (!timestamp) {
    return undefined;
  }
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const maybe = stringField(value);
    if (maybe) {
      return maybe;
    }
  }
  return undefined;
}

// 不同 Codex 客户端的命令字段形态不同；优先取最可读形式，并保留明确 fallback 便于审计。
function commandString(payload: Record<string, unknown>): string {
  const command = payload.command;
  if (typeof command === 'string' && command.trim()) {
    return command;
  }
  if (Array.isArray(command) && command.every((part) => typeof part === 'string')) {
    const joined = command.join(' ').trim();
    if (joined) {
      return joined;
    }
  }

  const parsedCmd = payload.parsed_cmd;
  if (Array.isArray(parsedCmd)) {
    for (const item of parsedCmd) {
      if (typeof item === 'object' && item !== null) {
        const cmd = stringField((item as Record<string, unknown>).cmd);
        if (cmd) {
          return cmd;
        }
      }
    }
  }

  return stringField(payload.cmd) ?? 'Unknown command';
}

// token_count 是累计样本；周期用量需要减去窗口前基线，缺少基线时显式标记近似。
function computeTokenUsage(
  samples: MutableSession['tokenSamples'],
  since: Date,
  until: Date,
  startedAt?: Date,
): TokenUsage {
  const ordered = samples
    .filter((sample) => sample.time <= until)
    .sort((left, right) => left.time.getTime() - right.time.getTime());
  const inWindow = ordered.filter((sample) => sample.time >= since);
  const lastInWindow = inWindow.at(-1);

  if (!lastInWindow) {
    return { ...emptyTokens(), approximate: false };
  }

  const baseline = ordered.filter((sample) => sample.time < since).at(-1);
  if (!baseline) {
    const startedInsideWindow = startedAt !== undefined && startedAt >= since && startedAt <= until;
    return { ...lastInWindow.tokens, approximate: !startedInsideWindow };
  }

  return { ...subtractTokens(lastInWindow.tokens, baseline.tokens), approximate: false };
}

function latestCompleted(session: MutableSession) {
  return session.completed
    .toSorted((left, right) => left.time.getTime() - right.time.getTime())
    .at(-1);
}

function latestLowConfidence(session: MutableSession) {
  const completed = latestCompleted(session);
  // 只保留完成之后最新的低置信度说明；更早的对话通常只是上下文，不是独立工作项。
  return session.lowConfidence
    .filter((item) => !completed || item.time > completed.time)
    .toSorted((left, right) => left.time.getTime() - right.time.getTime())
    .slice(-1);
}

// 对外事实提取入口。这里故意容错：坏行进入 warnings，同文件里的可用事实继续参与报告。
export async function loadCodexFacts(options: LoadCodexFactsOptions): Promise<CodexFacts> {
  const warnings: string[] = [];
  const sessions: MutableSession[] = [];
  const files = await findRolloutFiles(options.codexRoot);

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
    let session: MutableSession | undefined;

    for (const [index, lineText] of lines.entries()) {
      let raw: RawLine;
      try {
        raw = JSON.parse(lineText) as RawLine;
      } catch {
        warnings.push(`Malformed JSONL skipped at ${file}:${index + 1}`);
        continue;
      }

      if (raw.type === 'session_meta' && raw.payload) {
        session = sessionFromMeta(raw.payload, file, eventTime(raw));
        continue;
      }

      if (raw.type !== 'event_msg' || !raw.payload) {
        continue;
      }

      session ??= defaultSession(file);
      const time = eventTime(raw);
      if (!time) {
        warnings.push(`Event without valid timestamp skipped at ${file}:${index + 1}`);
        continue;
      }

      const payloadType = stringField(raw.payload.type);
      if (payloadType === 'token_count') {
        // 报告窗口外的 token 基线仍会影响增量计算，所以 token_count 必须先于普通事件窗口过滤处理。
        const tokens = extractTokens(raw.payload);
        if (!tokens) {
          continue;
        }
        session.tokenSamples.push({ time, tokens });
        if (time >= options.since && time <= options.until) {
          session.hasWindowTokenFact = true;
        }
        continue;
      }

      if (time < options.since || time > options.until) {
        continue;
      }

      if (payloadType === 'task_complete') {
        session.completed.push({
          summary: firstString(raw.payload.last_agent_message, raw.payload.summary, raw.payload.message) ?? 'Task completed',
          time,
          evidenceFile: file,
          sourceType: 'task_complete',
        });
      } else if (payloadType === 'task_started') {
        session.inProgress.push({
          summary: firstString(raw.payload.summary, raw.payload.message) ?? 'Task started',
          time,
          evidenceFile: file,
          sourceType: 'task_started',
        });
      } else if (payloadType === 'agent_message') {
        session.lowConfidence.push({
          summary: firstString(raw.payload.message, raw.payload.summary) ?? 'Agent message',
          time,
          evidenceFile: file,
          sourceType: 'agent_message',
        });
      } else if (payloadType === 'exec_command_end') {
        const exitCode = raw.payload.exit_code;
        session.commands.push({
          command: commandString(raw.payload),
          exitCode: typeof exitCode === 'number' ? exitCode : undefined,
          time,
          evidenceFile: file,
        });
      }
    }

    if (session) {
      sessions.push(session);
    }
  }

  return {
    sessions: sessions
      .map((session) => {
        const completed = latestCompleted(session);
        // 一旦会话已有完成事件，完成前的 started 和对话就不再代表当前仍在推进的状态。
        return {
          ...session,
          inProgress: session.inProgress.filter((item) => !completed || item.time > completed.time),
          lowConfidence: latestLowConfidence(session),
          tokenUsage: computeTokenUsage(session.tokenSamples, options.since, options.until, session.startedAt),
        };
      })
      .filter((session) => {
        return session.completed.length > 0 ||
          session.inProgress.length > 0 ||
          session.lowConfidence.length > 0 ||
          session.commands.length > 0 ||
          session.hasWindowTokenFact;
      })
      // 跨出模块边界前移除提取阶段临时字段，渲染层只接触公开的 SessionFacts 契约。
      .map(({ tokenSamples: _tokenSamples, hasWindowTokenFact: _hasWindowTokenFact, ...session }) => session),
    warnings,
  };
}
