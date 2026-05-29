import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadCodexFacts } from '../src/codex.ts';

// 夹具模拟真实 .codex/sessions/YYYY/MM/DD 布局，让发现逻辑测试递归遍历而非手工文件列表。
const fixturesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'codex-sessions',
);

test('loads Codex facts, classifies App and CLI surfaces, and warns on malformed JSONL', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  assert.equal(facts.sessions.length, 7);
  assert.equal(facts.sessions.find((s) => s.id === 'app-session')?.surface, 'Codex App');
  assert.equal(facts.sessions.find((s) => s.id === 'cli-session')?.surface, 'Codex CLI');
  assert.equal(facts.sessions.find((s) => s.id === 'boundary-session')?.surface, 'Codex CLI');
  assert.equal(facts.sessions.some((s) => s.id === 'historical-session'), false);
  assert.equal(facts.warnings.length, 1);
  assert.match(facts.warnings[0], /malformed JSONL/i);
});

test('normalizes agent_message as low-confidence notes without marking it complete or in-progress', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const app = facts.sessions.find((s) => s.id === 'app-session');
  const cli = facts.sessions.find((s) => s.id === 'cli-session');

  assert.equal(app?.completed.some((item) => item.summary === 'Final reviewer note'), false);
  assert.equal(app?.inProgress.some((item) => item.summary === 'Explored parser design'), false);
  assert.equal(app?.inProgress.some((item) => item.summary === 'Confirm packaging with reviewer'), false);
  assert.deepEqual(app?.lowConfidence.map((item) => item.summary), [
    'Final reviewer note',
  ]);
  assert.deepEqual(cli?.lowConfidence.map((item) => item.summary), [
    'Second CLI observation',
  ]);
});

test('filters events by instant while respecting timezone-derived boundaries', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const boundary = facts.sessions.find((s) => s.id === 'boundary-session');

  assert.ok(boundary);
  assert.equal(boundary.completed.length, 1);
  assert.match(boundary.completed[0].summary, /included local Monday event/);
  assert.equal(boundary.inProgress.length, 0);
});

test('computes cumulative token deltas and marks missing baselines as approximate', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const app = facts.sessions.find((s) => s.id === 'app-session');
  const cli = facts.sessions.find((s) => s.id === 'cli-session');

  // app-session 有窗口前 token 基线，old-no-baseline-session 刻意没有，用来守住 approximate 契约。
  assert.deepEqual(app?.tokenUsage, {
    input_tokens: 60,
    cached_input_tokens: 20,
    output_tokens: 15,
    reasoning_output_tokens: 7,
    total_tokens: 82,
    approximate: false,
  });
  const oldNoBaseline = facts.sessions.find((s) => s.id === 'old-no-baseline-session');

  assert.equal(cli?.tokenUsage.total_tokens, 50);
  assert.equal(cli?.tokenUsage.approximate, false);
  assert.equal(oldNoBaseline?.tokenUsage.total_tokens, 64);
  assert.equal(oldNoBaseline?.tokenUsage.approximate, true);
});

test('ignores null or empty token_count payloads when choosing token baselines', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const oldNoBaseline = facts.sessions.find((s) => s.id === 'old-no-baseline-session');

  assert.deepEqual(oldNoBaseline?.tokenUsage, {
    input_tokens: 40,
    cached_input_tokens: 10,
    output_tokens: 9,
    reasoning_output_tokens: 5,
    total_tokens: 64,
    approximate: true,
  });
});

test('supports real nested token_count payload and git commit_hash repository_url keys', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const realShape = facts.sessions.find((s) => s.id === 'real-shape-session');

  assert.deepEqual(realShape?.tokenUsage, {
    input_tokens: 70,
    cached_input_tokens: 30,
    output_tokens: 15,
    reasoning_output_tokens: 8,
    total_tokens: 93,
    approximate: false,
  });
  assert.equal(realShape?.git?.repository, 'https://github.com/example/workline.git');
  assert.equal(realShape?.git?.commit, 'feedface');
});

test('preserves macOS POSIX cwd and repository paths from session metadata', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const macos = facts.sessions.find((s) => s.id === 'macos-session');

  assert.ok(macos);
  assert.equal(macos.cwd, '/Users/example/project/workline');
  assert.equal(macos.project, '/Users/example/project/workline');
  assert.equal(macos.git?.repository, '/Users/example/project/workline');
  assert.equal(macos.git?.branch, 'feature/support-macos-codex');
  assert.deepEqual(macos.completed.map((item) => item.summary), [
    'Validated macOS Codex session extraction',
  ]);
});

test('normalizes exec_command_end command arrays and parsed_cmd fallback', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const cli = facts.sessions.find((s) => s.id === 'cli-session');

  assert.deepEqual(cli?.commands.map((command) => command.command), [
    'pwsh.exe -Command node ./bin/workline.js weekly',
    'git status --short',
  ]);
});

test('extracts Codex response tool calls and patch events as structured evidence', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const session = facts.sessions.find((s) => s.id === 'tool-trace-session');

  assert.ok(session);
  assert.deepEqual(session.commands.map((command) => command.command), ['npm test']);
  assert.deepEqual(session.toolEvents?.map((event) => ({
    tool: event.tool,
    category: event.category,
    target: event.target,
  })), [
    { tool: 'apply_patch', category: 'output', target: 'docs/strategy/gtm.md' },
    { tool: 'apply_patch', category: 'output', target: 'docs/strategy/language.md' },
    { tool: 'mcp:node_repl.js', category: 'exploration', target: 'Inspect package metadata' },
    { tool: 'web_search', category: 'exploration', target: 'workline GTM strategy' },
  ]);
});

test('extracts Codex user message text for report language fallback without rendering it as work', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-codex-language-'));
  const sessionDir = path.join(tempRoot, '2026', '05', '06');
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'rollout-language.jsonl'), [
    JSON.stringify({
      timestamp: '2026-05-06T01:00:00.000Z',
      type: 'session_meta',
      payload: {
        id: 'codex-language-session',
        cwd: 'C:\\repo\\workline',
        originator: 'codex-tui',
        source: 'cli',
      },
    }),
    JSON.stringify({
      timestamp: '2026-05-06T01:05:00.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: '请用中文生成 Workline 周报。' },
        ],
      },
    }),
  ].join('\n'), 'utf8');

  const facts = await loadCodexFacts({
    codexRoot: tempRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  assert.deepEqual(facts.sessions, []);
  assert.deepEqual(facts.languageMessages?.map((message) => ({
    text: message.text,
    sourceType: message.sourceType,
  })), [
    { text: '请用中文生成 Workline 周报。', sourceType: 'codex_user' },
  ]);
});
