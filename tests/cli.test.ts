import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const binPath = path.join(repoRoot, 'bin', 'workline.js');
const fixturesRoot = path.join(repoRoot, 'tests', 'fixtures', 'codex-sessions');
const emptyClaudeConfigDir = path.join(os.tmpdir(), `workline-empty-claude-${process.pid}`);
// 固定 locale 敏感测试的语言环境，避免宿主机语言改变预期报告文案。
const englishEnv = {
  ...process.env,
  CLAUDE_CONFIG_DIR: emptyClaudeConfigDir,
  LC_ALL: 'en_US.UTF-8',
  LC_MESSAGES: 'en_US.UTF-8',
  LANG: 'en_US.UTF-8',
  LANGUAGE: 'en_US',
};

function writeSingleSession(root: string, id: string, cwd: string, summary: string): void {
  const sessionDir = path.join(root, '2026', '05', '05');
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, `rollout-${id}.jsonl`), [
    JSON.stringify({
      timestamp: '2026-05-05T01:00:00.000Z',
      type: 'session_meta',
      payload: {
        id,
        cwd,
        originator: 'codex-tui',
        source: 'cli',
      },
    }),
    JSON.stringify({
      timestamp: '2026-05-05T01:10:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'task_complete',
        summary,
      },
    }),
  ].join('\n'), 'utf8');
}

function writeSingleClaudeSession(root: string, id: string, cwd: string, summary: string): void {
  const sessionDir = path.join(root, cwd.replace(/[:\\/]+/g, '-'));
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, `${id}.jsonl`), JSON.stringify({
    type: 'assistant',
    sessionId: id,
    cwd,
    version: '2.1.0',
    gitBranch: 'feature/claude-code-data-source',
    timestamp: '2026-05-05T01:20:00.000Z',
    message: {
      role: 'assistant',
      model: 'claude-sonnet-4-5',
      content: [
        { type: 'text', text: summary },
        { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } },
      ],
    },
  }), 'utf8');
}

function runGit(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('workline without an output layer points users to the final-report workflow', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Use \$workline or \/workline for the final weekly report/);
  assert.match(result.stderr, /workline --context/);
  assert.match(result.stderr, /workline --facts/);
  assert.equal(fs.existsSync(path.join(tempDir, 'output')), false);
});

test('legacy weekly subcommand points users to the Workline command surface', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    'weekly',
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /workline weekly has been renamed/);
  assert.match(result.stderr, /workline --context/);
  assert.match(result.stderr, /workline --facts/);
  assert.equal(fs.existsSync(path.join(tempDir, 'output')), false);
});

test('workline --facts localizes fact summary output from system language environment', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
  ], {
    cwd: tempDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      LC_ALL: 'zh_TW.UTF-8',
      LC_MESSAGES: 'zh_TW.UTF-8',
      LANG: 'en_US.UTF-8',
      LANGUAGE: 'zh_TW',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const outputPath = path.join(tempDir, 'output', 'workline-facts-20260504-20260506.md');
  const markdown = fs.readFileSync(outputPath, 'utf8');
  assert.match(markdown, /^# Workline 週報事實摘要/m);
  assert.match(markdown, /週期: 2026-05-04 00:00:00 - 2026-05-06 20:00:00/);
  assert.match(markdown, /Completed weekly report MVP parser/);
});

test('workline defaults to CODEX_HOME sessions when codex root is not provided', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-home-'));
  const codexHome = path.join(tempHome, 'codex-home');
  writeSingleSession(
    path.join(codexHome, 'sessions'),
    'macos-codex-home-session',
    '/Users/example/project/workline',
    'Loaded macOS Codex sessions from CODEX_HOME',
  );

  const result = spawnSync(process.execPath, [
    binPath,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
  ], {
    cwd: tempDir,
    encoding: 'utf8',
    env: {
      ...englishEnv,
      CODEX_HOME: codexHome,
      HOME: tempHome,
      USERPROFILE: tempHome,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(path.join(tempDir, 'output', 'workline-facts-20260504-20260506.md'), 'utf8');
  assert.match(markdown, /Loaded macOS Codex sessions from CODEX_HOME/);
  assert.match(markdown, /## \/Users\/example\/project\/workline/);
});

test('workline expands leading tilde in --codex-root', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-home-'));
  writeSingleSession(
    path.join(tempHome, '.codex', 'sessions'),
    'macos-tilde-session',
    '/Users/example/project/tilde-work',
    'Loaded macOS Codex sessions from tilde path',
  );

  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    '~/.codex/sessions',
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
  ], {
    cwd: tempDir,
    encoding: 'utf8',
    env: {
      ...englishEnv,
      HOME: tempHome,
      USERPROFILE: tempHome,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(path.join(tempDir, 'output', 'workline-facts-20260504-20260506.md'), 'utf8');
  assert.match(markdown, /Loaded macOS Codex sessions from tilde path/);
  assert.match(markdown, /## \/Users\/example\/project\/tilde-work/);
});

test('workline combines explicit Codex and Claude Code roots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const codexRoot = path.join(tempDir, 'codex-sessions');
  const claudeRoot = path.join(tempDir, 'claude-projects');
  writeSingleSession(
    codexRoot,
    'codex-combined-session',
    'C:\\repo\\codex-work',
    'Loaded Codex work for combined report',
  );
  writeSingleClaudeSession(
    claudeRoot,
    'claude-combined-session',
    'C:\\repo\\claude-work',
    'Reviewed Claude Code work for combined report',
  );

  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    codexRoot,
    '--claude-root',
    claudeRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(path.join(tempDir, 'output', 'workline-facts-20260504-20260506.md'), 'utf8');
  assert.match(markdown, /Loaded Codex work for combined report/);
  assert.match(markdown, /Reviewed Claude Code work for combined report/);
  assert.match(markdown, /### Codex CLI/);
  assert.match(markdown, /### Claude Code/);
});

test('workline defaults Claude Code root to CLAUDE_CONFIG_DIR projects', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-home-'));
  const claudeConfigDir = path.join(tempHome, 'claude-config');
  writeSingleClaudeSession(
    path.join(claudeConfigDir, 'projects'),
    'claude-config-session',
    '/Users/example/project/claude-config-work',
    'Loaded Claude Code sessions from CLAUDE_CONFIG_DIR',
  );

  const result = spawnSync(process.execPath, [
    binPath,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
  ], {
    cwd: tempDir,
    encoding: 'utf8',
    env: {
      ...englishEnv,
      CODEX_HOME: path.join(tempHome, 'empty-codex-home'),
      CLAUDE_CONFIG_DIR: claudeConfigDir,
      HOME: tempHome,
      USERPROFILE: tempHome,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(path.join(tempDir, 'output', 'workline-facts-20260504-20260506.md'), 'utf8');
  assert.match(markdown, /Loaded Claude Code sessions from CLAUDE_CONFIG_DIR/);
  assert.match(markdown, /### Claude Code/);
});

test('workline --output writes the same Markdown to a file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const outputPath = path.join(tempDir, 'workline.md');
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
    '--output',
    outputPath,
  ], { encoding: 'utf8', env: englishEnv });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(fs.readFileSync(outputPath, 'utf8'), /# Workline Weekly Fact Summary/);
});

test('workline --facts writes a fact summary package', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--facts',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.equal(result.status, 0, result.stderr);
  const outputPath = path.join(tempDir, 'output', 'workline-facts-20260504-20260506.md');
  const markdown = fs.readFileSync(outputPath, 'utf8');
  assert.equal(result.stdout, '');
  assert.match(markdown, /# Workline Weekly Fact Summary/);
});

test('workline --context writes an agent context package', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--context',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.equal(result.status, 0, result.stderr);
  const outputPath = path.join(tempDir, 'output', 'workline-context-20260504-20260506.md');
  const finalReportPath = path.join(tempDir, 'output', 'workline-20260504-20260506.md');
  const markdown = fs.readFileSync(outputPath, 'utf8');
  assert.equal(result.stdout, '');
  assert.match(markdown, /# Workline Weekly Agent Context/);
  assert.match(markdown, new RegExp(`Final report path: ${finalReportPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(markdown, /## Evidence index/);
});

test('workline --context declares the final report language from system locale', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--context',
  ], {
    cwd: tempDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: emptyClaudeConfigDir,
      LC_ALL: 'zh_CN.UTF-8',
      LC_MESSAGES: 'zh_CN.UTF-8',
      LANG: 'en_US.UTF-8',
      LANGUAGE: 'zh_CN',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(path.join(tempDir, 'output', 'workline-context-20260504-20260506.md'), 'utf8');
  assert.match(markdown, /Report language: Simplified Chinese/);
  assert.match(markdown, /Report language source: system-locale/);
  assert.match(markdown, /Report language confidence: medium/);
  assert.match(markdown, /报告语言已解析为简体中文；使用简体中文写最终报告的标题、周期、章节名和正文/);
  assert.match(markdown, /不要把 `Overview` 或 `Work topics` 作为固定可见章节标题/);
});

test('workline --context honors explicit --report-language over locale fallback', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--context',
    '--report-language',
    'ko',
  ], {
    cwd: tempDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: emptyClaudeConfigDir,
      LC_ALL: 'zh_CN.UTF-8',
      LC_MESSAGES: 'zh_CN.UTF-8',
      LANG: 'zh_CN.UTF-8',
      LANGUAGE: 'zh_CN',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(path.join(tempDir, 'output', 'workline-context-20260504-20260506.md'), 'utf8');
  assert.match(markdown, /Report language: Korean/);
  assert.match(markdown, /Report language source: explicit/);
  assert.match(markdown, /Report language confidence: high/);
});

test('workline rejects unsupported --report-language values', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--context',
    '--report-language',
    'ru',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Invalid --report-language: ru/);
  assert.equal(fs.existsSync(path.join(tempDir, 'output')), false);
});

test('workline --context includes current workspace strategy drafts', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const emptyCodexRoot = path.join(tempDir, 'empty-codex');
  runGit(tempDir, ['init']);
  fs.mkdirSync(path.join(tempDir, 'docs', 'strategy'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'docs', 'strategy', 'workline-gtm.md'), [
    '# Workline Positioning and GTM Direction',
    '',
    '## Pricing and Packaging',
    '',
    'Use local-first freemium.',
    '',
    '## Language Strategy',
    '',
    'Chinese-first reports.',
  ].join('\n'), 'utf8');

  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    emptyCodexRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--context',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(path.join(tempDir, 'output', 'workline-context-20260504-20260506.md'), 'utf8');
  assert.match(markdown, /## Project: .*workline-/);
  assert.match(markdown, /### Surface: Workspace/);
  assert.match(markdown, /Workspace draft document: docs\/strategy\/workline-gtm\.md/);
  assert.match(markdown, /themes=GTM, pricing, language/);
  assert.match(markdown, /Workspace\/Git diff facts are included as draft or in-progress evidence/);
});

test('workline --format agent-context remains a compatibility alias for --context', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--format',
    'agent-context',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.equal(result.status, 0, result.stderr);
  const outputPath = path.join(tempDir, 'output', 'workline-context-20260504-20260506.md');
  const markdown = fs.readFileSync(outputPath, 'utf8');
  assert.equal(result.stdout, '');
  assert.match(markdown, /# Workline Weekly Agent Context/);
});

test('workline --print-output-path prints the generated file path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--since',
    '2026-05-03T16:00:00.000Z',
    '--until',
    '2026-05-06T12:00:00.000Z',
    '--timezone',
    'Asia/Shanghai',
    '--context',
    '--print-output-path',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  const outputPath = path.join(tempDir, 'output', 'workline-context-20260504-20260506.md');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), outputPath);
  assert.equal(fs.existsSync(outputPath), true);
});

test('workline output mode flags are mutually exclusive', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-'));
  const result = spawnSync(process.execPath, [
    binPath,
    '--codex-root',
    fixturesRoot,
    '--context',
    '--facts',
  ], { cwd: tempDir, encoding: 'utf8', env: englishEnv });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot combine --context and --facts/);
});

test('install-skill installs user-level Workline skills for Codex and Claude', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-home-'));
  const codexHome = path.join(tempHome, 'codex-home');
  const result = spawnSync(process.execPath, [
    binPath,
    'install-skill',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      HOME: tempHome,
      USERPROFILE: tempHome,
    },
  });

  const codexSkill = path.join(codexHome, 'skills', 'workline', 'SKILL.md');
  const claudeSkill = path.join(tempHome, '.claude', 'skills', 'workline', 'SKILL.md');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed workline skill for codex:/);
  assert.match(result.stdout, /Installed workline skill for claude:/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /name: workline/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /workline --context --print-output-path/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /workline weekly --context --print-output-path/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /workline --format agent-context --print-output-path/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Report language/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /declared Report language/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /--report-language/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Fibonacci/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /scan-first/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not use `Overview` or `Work topics` as fixed visible section headings/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /human-readable topic headings/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /outcome bullets/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /Key accomplishments/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Use human-readable topic headings directly as report sections/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not prefix topic headings with Work topic:/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not add a Key outcomes subheading/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Write the opening summary and outcomes outcome-first/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Prioritize outcomes that answer whether goals advanced, problems were solved, state changed, current capability is usable, or blockers remain/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Treat file edits, commands, configuration changes, draft documents, and validation runs as process evidence/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /If facts only support process progress or unconfirmed outcomes, use conservative wording/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /When an outcome has a clear deliverable, attach an outcome reference that helps readers access, validate, or continue the work/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Prefer references that target readers can access, such as links, PRs, remote branches, commits, document URLs, release URLs, or shared artifacts/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Use local file paths, source sessions, or command evidence only when no more generally accessible reference is available/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not use opaque internal versions or tool-specific identifiers such as Feishu revision numbers, source sessions, local-only evidence IDs, or context indexes as final-report references/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /If only opaque or inaccessible references are available, omit the reference instead of explaining that no usable link exists/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Write the final report as a human-to-human deliverable, not as Agent commentary about generation choices/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not explain omitted transactional items, missing evidence, filtering decisions, context limits, or internal reasoning in the final report/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Integrate outcome references naturally into outcome text; do not prefix them with labels such as 成果引用, 证据, Reference, Evidence, or Source unless the user explicitly asks/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Exclude pure transactional work from the final report/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /one-off reminders, scheduling, notifications, confirmations, waiting, relays, or personal-assistant actions/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not write pure transactional work into the opening summary, topic headings, or outcome bullets/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /Each work topic entry should contain only "Work topic" and "Key outcomes"/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Only include transactional process artifacts when they support a substantive outcome and have business, reuse, decision, or follow-up value/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Keep substantive work from mixed sessions and omit transactional details/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /If the reporting period only contains pure transactional interactions, say there is no substantive work progress to report/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Choose a concise human-readable work topic name/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /product or site name/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not use full local paths as final report work topic names/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /cwd, repo, branch, and file paths as source evidence/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /report display name/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /human-readable display name/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /technical username/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /remote owner/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /machine username/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /localized period line using \{startDate\} and \{endDate\}/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /From \{startDate\} to \{endDate\}/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not automatically exclude low-confidence content/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /bounded previews and omission notes/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not treat omitted details as absent/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /do not invent details beyond the visible preview/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not copy raw compact evidence IDs such as \[E1\], evidence=\[E1\], or \(evidence: \[E1\]\) into the final report/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /When final-report traceability is needed, integrate the reference naturally into the outcome text instead of exposing evidence mechanics/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Treat the generated agent-context file as an intermediate artifact/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /After the final Markdown report is written successfully, delete the generated agent-context file/);
  assert.match(fs.readFileSync(codexSkill, 'utf8'), /Do not present the generated agent-context path as a default user-facing deliverable/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /Risks and blockers/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /Suggested next steps/);
  assert.doesNotMatch(fs.readFileSync(codexSkill, 'utf8'), /Evidence appendix/);
  assert.match(fs.readFileSync(claudeSkill, 'utf8'), /name: workline/);
  assert.match(fs.readFileSync(claudeSkill, 'utf8'), /\$workline/);
  assert.match(fs.readFileSync(claudeSkill, 'utf8'), /\/workline/);
  assert.match(fs.readFileSync(claudeSkill, 'utf8'), /workline summary/);
  assert.match(fs.readFileSync(claudeSkill, 'utf8'), /\u672c\u5468\u5468\u62a5/);
});
