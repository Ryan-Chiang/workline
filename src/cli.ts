import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadClaudeFacts } from './claude.ts';
import { loadCodexFacts } from './codex.ts';
import { getReportLanguageDecision, parseReportLanguageOverride } from './locale.ts';
import { renderWeeklyAgentContext, renderWeeklyFactSummary } from './report.ts';
import { installWeeklySkill, parseSkillTarget } from './skills.ts';
import { formatFilenameDate, getDefaultTimezone, getDefaultWeeklyWindow } from './time.ts';
import { loadWorkspaceFacts } from './workspace.ts';

type WeeklyOutputMode = 'facts' | 'agent-context';

type CliOptions = {
  command?: string;
  since?: string;
  until?: string;
  timezone?: string;
  codexRoot?: string;
  claudeRoot?: string;
  output?: string;
  format?: string;
  context?: boolean;
  facts?: boolean;
  printOutputPath?: boolean;
  target?: string;
  reportLanguage?: string;
};

// CLI 参数解析刻意保持小而直白，方便审计行为，也避免新增依赖扩大插件表面积。
function parseArgs(args: string[]): CliOptions {
  const [first] = args;
  const hasCommand = first !== undefined && !first.startsWith('--');
  const rest = hasCommand ? args.slice(1) : args;
  const options: CliOptions = hasCommand ? { command: first } : {};
  const valueOptions = new Set(['--since', '--until', '--timezone', '--codex-root', '--claude-root', '--output', '--format', '--target', '--report-language']);

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    if (arg === '--print-output-path') {
      options.printOutputPath = true;
      continue;
    }

    if (arg === '--context') {
      options.context = true;
      continue;
    }

    if (arg === '--facts') {
      options.facts = true;
      continue;
    }

    if (!valueOptions.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }

    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;

    if (arg === '--since') {
      options.since = value;
    } else if (arg === '--until') {
      options.until = value;
    } else if (arg === '--timezone') {
      options.timezone = value;
    } else if (arg === '--codex-root') {
      options.codexRoot = value;
    } else if (arg === '--claude-root') {
      options.claudeRoot = value;
    } else if (arg === '--output') {
      options.output = value;
    } else if (arg === '--format') {
      options.format = value;
    } else if (arg === '--target') {
      options.target = value;
    } else if (arg === '--report-language') {
      options.reportLanguage = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

// 入参日期按 instant 解析；timezone 只用于默认周期、展示文本和输出文件名。
function parseDate(value: string | undefined, label: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return date;
}

function parseFormat(value: string): WeeklyOutputMode {
  if (value === 'report') {
    return 'facts';
  }
  if (value === 'agent-context') {
    return 'agent-context';
  }
  throw new Error(`Invalid --format: ${value}`);
}

function weeklyOutputMode(options: CliOptions): WeeklyOutputMode {
  if (options.context && options.facts) {
    throw new Error('Cannot combine --context and --facts');
  }
  if (options.context && options.format) {
    throw new Error('Cannot combine --context and --format');
  }
  if (options.facts && options.format) {
    throw new Error('Cannot combine --facts and --format');
  }
  if (options.context) {
    return 'agent-context';
  }
  if (options.facts) {
    return 'facts';
  }
  if (!options.format) {
    throw new Error('workline needs an explicit output layer when run directly. Use $workline or /workline for the final weekly report, workline --context for Agent context, or workline --facts for fact summary.');
  }
  return parseFormat(options.format);
}

function userHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
}

function expandHomePath(value: string): string {
  if (value === '~') {
    return userHome();
  }
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(userHome(), value.slice(2));
  }
  return value;
}

function defaultCodexRoot(): string {
  const codexHome = process.env.CODEX_HOME;
  if (codexHome?.trim()) {
    return path.join(expandHomePath(codexHome), 'sessions');
  }
  return path.join(userHome(), '.codex', 'sessions');
}

function resolveCodexRoot(value: string | undefined): string {
  return value ? expandHomePath(value) : defaultCodexRoot();
}

function defaultClaudeRoot(): string {
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  if (claudeConfigDir?.trim()) {
    return path.join(expandHomePath(claudeConfigDir), 'projects');
  }
  return path.join(userHome(), '.claude', 'projects');
}

function resolveClaudeRoot(value: string | undefined): string {
  return value ? expandHomePath(value) : defaultClaudeRoot();
}

// 默认报告路径使用本地日期而非 UTC 日期，确保 Asia/Shanghai 周一零点窗口命名符合直觉。
function reportOutputPath(since: Date, until: Date, timezone: string): string {
  const startDate = formatFilenameDate(since, timezone);
  const endDate = formatFilenameDate(until, timezone);
  return path.join(process.cwd(), 'output', `workline-${startDate}-${endDate}.md`);
}

function factSummaryOutputPath(since: Date, until: Date, timezone: string): string {
  const startDate = formatFilenameDate(since, timezone);
  const endDate = formatFilenameDate(until, timezone);
  return path.join(process.cwd(), 'output', `workline-facts-${startDate}-${endDate}.md`);
}

function agentContextOutputPath(since: Date, until: Date, timezone: string): string {
  const startDate = formatFilenameDate(since, timezone);
  const endDate = formatFilenameDate(until, timezone);
  return path.join(process.cwd(), 'output', `workline-context-${startDate}-${endDate}.md`);
}

// weekly 只提取并包装本地事实；最终叙事可以是确定性报告，也可以交给当前模型读取上下文。
async function runWeekly(options: CliOptions): Promise<void> {
  const timezone = options.timezone ?? getDefaultTimezone();
  const outputMode = weeklyOutputMode(options);
  const explicitReportLanguage = options.reportLanguage === undefined
    ? undefined
    : parseReportLanguageOverride(options.reportLanguage);
  if (options.reportLanguage !== undefined && !explicitReportLanguage) {
    throw new Error(`Invalid --report-language: ${options.reportLanguage}`);
  }
  const defaults = getDefaultWeeklyWindow(timezone);
  const since = parseDate(options.since, '--since') ?? defaults.since;
  const until = parseDate(options.until, '--until') ?? defaults.until;
  const codexRoot = resolveCodexRoot(options.codexRoot);
  const claudeRoot = resolveClaudeRoot(options.claudeRoot);
  const generatedAt = new Date();
  const codexFacts = await loadCodexFacts({ codexRoot, since, until });
  const claudeFacts = await loadClaudeFacts({ claudeRoot, since, until });
  const workspaceFacts = await loadWorkspaceFacts({ cwd: process.cwd(), now: generatedAt });
  const facts = {
    sessions: [...codexFacts.sessions, ...claudeFacts.sessions, ...workspaceFacts.sessions],
    warnings: [...codexFacts.warnings, ...claudeFacts.warnings, ...workspaceFacts.warnings],
    languageMessages: [
      ...(codexFacts.languageMessages ?? []),
      ...(claudeFacts.languageMessages ?? []),
    ],
  };
  const reportLanguageDecision = getReportLanguageDecision({
    explicitLanguage: explicitReportLanguage,
    userMessages: facts.languageMessages,
    timezone,
  });
  const finalReportPath = path.resolve(reportOutputPath(since, until, timezone));
  const markdown = outputMode === 'agent-context' ? renderWeeklyAgentContext(facts, {
    since,
    until,
    timezone,
    generatedAt,
    finalReportPath,
    reportLanguage: reportLanguageDecision.language,
    reportLanguageSource: reportLanguageDecision.source,
    reportLanguageConfidence: reportLanguageDecision.confidence,
  }) : renderWeeklyFactSummary(facts, {
    since,
    until,
    timezone,
    generatedAt,
    reportLanguage: reportLanguageDecision.language,
    reportLanguageSource: reportLanguageDecision.source,
    reportLanguageConfidence: reportLanguageDecision.confidence,
  });

  const defaultOutputPath = outputMode === 'agent-context'
    ? agentContextOutputPath(since, until, timezone)
    : factSummaryOutputPath(since, until, timezone);
  const outputPath = path.resolve(options.output ?? defaultOutputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, 'utf8');
  if (options.printOutputPath) {
    process.stdout.write(`${outputPath}\n`);
  }
}

// install-skill 写入用户级 skill，让 Codex 和 Claude 复用同一条本地事实提取命令。
async function runInstallSkill(options: CliOptions): Promise<void> {
  const target = parseSkillTarget(options.target);
  const installed = await installWeeklySkill(target);
  for (const item of installed) {
    process.stdout.write(`Installed workline skill for ${item.target}: ${path.join(item.path, 'SKILL.md')}\n`);
  }
}

// main 导出给测试使用并保持低副作用；只有可执行 shim 读取 process.argv 并处理 stderr。
export async function main(args: string[]): Promise<void> {
  const options = parseArgs(args);
  if (!options.command) {
    await runWeekly(options);
    return;
  }

  if (options.command === 'weekly') {
    throw new Error('workline weekly has been renamed. Use $workline or /workline for the final weekly report, workline --context for Agent context, or workline --facts for fact summary.');
  }

  if (options.command === 'install-skill') {
    await runInstallSkill(options);
    return;
  }

  throw new Error('Usage: workline [--since <instant>] [--until <instant>] [--timezone <iana>] [--codex-root <path>] [--claude-root <path>] [--output <path>] [--facts|--context] [--format report|agent-context] [--report-language <locale>] [--print-output-path]\n       workline install-skill [--target codex|claude|both]');
}
