import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { AgentFacts, SessionFacts } from './types.ts';

const execFileAsync = promisify(execFile);

type LoadWorkspaceFactsOptions = {
  cwd: string;
  now?: Date;
};

type DirtyFile = {
  status: string;
  relativePath: string;
};

const emptyTokenUsage = {
  input_tokens: 0,
  cached_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
  total_tokens: 0,
  approximate: false,
};

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
  return result.stdout.trim();
}

async function gitRoot(cwd: string): Promise<string | undefined> {
  try {
    return await git(cwd, ['rev-parse', '--show-toplevel']);
  } catch {
    return undefined;
  }
}

async function gitPrefix(cwd: string): Promise<string> {
  try {
    return await git(cwd, ['rev-parse', '--show-prefix']);
  } catch {
    return '';
  }
}

function displayRoot(cwd: string, prefix: string): string {
  const segments = prefix.split('/').filter(Boolean);
  return path.resolve(cwd, ...segments.map(() => '..'));
}

function parsePorcelainLine(line: string): DirtyFile | undefined {
  if (line.length < 4) {
    return undefined;
  }

  const status = line.slice(0, 2).trim() || line.slice(0, 2);
  const rawPath = line.slice(3);
  const relativePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) ?? rawPath : rawPath;
  if (!relativePath.trim()) {
    return undefined;
  }

  return {
    status,
    relativePath: relativePath.replace(/^"|"$/g, ''),
  };
}

function isDocumentCandidate(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return /\.mdx?$/i.test(normalized) || /^AGENTS\.md$/i.test(normalized) || /^README\.md$/i.test(normalized);
}

function heading(pattern: RegExp, content: string): string | undefined {
  const match = content.match(pattern);
  return match?.[1]?.trim();
}

function sectionHeadings(content: string): string[] {
  return [...content.matchAll(/^##\s+(.+)$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 4);
}

function themes(content: string, relativePath: string): string[] {
  const haystack = `${relativePath}\n${content}`;
  const found: string[] = [];
  const add = (label: string, pattern: RegExp): void => {
    if (pattern.test(haystack)) {
      found.push(label);
    }
  };

  add('Build in public', /build\s+in\s+public/i);
  add('GTM', /\bGTM\b|go[- ]?to[- ]?market|获客|上市策略/i);
  add('pricing', /pricing|packaging|freemium|free local|定价|收费|免费增值/i);
  add('language', /language|语言|中文|英文|双语/i);
  add('strategy', /strategy|定位|策略/i);

  return found.slice(0, 5);
}

function statusLabel(status: string): string {
  if (status === '??') {
    return 'untracked';
  }
  if (status.includes('M')) {
    return 'modified';
  }
  if (status.includes('A')) {
    return 'added';
  }
  if (status.includes('D')) {
    return 'deleted';
  }
  return status.toLowerCase();
}

function documentSummary(file: DirtyFile, content: string): string {
  const title = heading(/^#\s+(.+)$/m, content);
  const sections = sectionHeadings(content);
  const foundThemes = themes(content, file.relativePath);
  const parts = [
    `Workspace draft document: ${file.relativePath.replace(/\\/g, '/')} (${statusLabel(file.status)})`,
  ];

  if (title) {
    parts.push(`title=${title}`);
  }
  if (sections.length > 0) {
    parts.push(`sections=${sections.join(', ')}`);
  }
  if (foundThemes.length > 0) {
    parts.push(`themes=${foundThemes.join(', ')}`);
  }

  return parts.join('; ');
}

function workspaceSession(root: string, file: DirtyFile, evidenceFile: string, summary: string, time: Date): SessionFacts {
  return {
    id: `workspace:${file.relativePath.replace(/\\/g, '/')}`,
    cwd: root,
    project: root,
    surface: 'Workspace',
    source: 'workspace',
    originator: 'git status',
    evidenceFile,
    completed: [],
    inProgress: [{
      summary,
      time,
      evidenceFile,
      sourceType: 'task_started',
    }],
    lowConfidence: [],
    commands: [],
    tokenUsage: { ...emptyTokenUsage },
  };
}

export async function loadWorkspaceFacts(options: LoadWorkspaceFactsOptions): Promise<AgentFacts> {
  const root = await gitRoot(options.cwd);
  if (!root) {
    return { sessions: [], warnings: [] };
  }

  const evidenceRoot = displayRoot(options.cwd, await gitPrefix(options.cwd));
  const status = await git(root, ['status', '--porcelain=v1', '-uall']);
  const dirtyFiles = status
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parsePorcelainLine)
    .filter((file): file is DirtyFile => file !== undefined)
    .filter((file) => !file.status.includes('D'))
    .filter((file) => isDocumentCandidate(file.relativePath));

  const sessions: SessionFacts[] = [];
  const warnings: string[] = [];
  const time = options.now ?? new Date();

  for (const file of dirtyFiles) {
    const evidenceFile = path.resolve(evidenceRoot, file.relativePath);
    try {
      const content = await fs.readFile(evidenceFile, 'utf8');
      sessions.push(workspaceSession(evidenceRoot, file, evidenceFile, documentSummary(file, content), time));
    } catch (error) {
      warnings.push(`Workspace document evidence skipped at ${evidenceFile}: ${(error as Error).message}`);
    }
  }

  return { sessions, warnings };
}
