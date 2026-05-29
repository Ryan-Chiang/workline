import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadClaudeFacts } from '../src/claude.ts';

const fixturesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'claude-projects',
);

test('loads Claude Code facts from nested project transcripts', async () => {
  const facts = await loadClaudeFacts({
    claudeRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  assert.equal(facts.sessions.length, 4);
  assert.equal(facts.warnings.length, 1);
  assert.match(facts.warnings[0], /Malformed Claude Code JSONL skipped/);

  const win = facts.sessions.find((session) => session.id === 'claude-win-session');
  assert.ok(win);
  assert.equal(win.cwd, 'C:\\Users\\Example\\project\\workline');
  assert.equal(win.project, 'C:\\Users\\Example\\project\\workline');
  assert.equal(win.surface, 'Claude Code');
  assert.equal(win.source, 'claude');
  assert.equal(win.originator, 'Claude Code');
  assert.equal(win.cliVersion, '2.1.0');
  assert.equal(win.git?.branch, 'feature/claude-code-data-source');
  assert.deepEqual(win.completed, []);
  assert.deepEqual(win.lowConfidence.map((item) => item.summary), [
    'Implemented Claude Code parser draft.',
  ]);
  assert.deepEqual(win.commands.map((command) => command.command), [
    'npm test',
    'git status --short',
  ]);
  assert.equal(win.commands.find((command) => command.command === 'git status --short')?.exitCode, 0);
});

test('extracts Claude Code non-Bash tool events as structured evidence', async () => {
  const facts = await loadClaudeFacts({
    claudeRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const session = facts.sessions.find((item) => item.id === 'claude-file-tools-session');

  assert.ok(session);
  assert.deepEqual(session.toolEvents?.map((event) => ({
    tool: event.tool,
    category: event.category,
    target: event.target,
  })), [
    { tool: 'Read', category: 'exploration', target: 'src/pages/CustomerCheckin.vue' },
    { tool: 'Edit', category: 'output', target: 'src/pages/CustomerCheckin.vue' },
    { tool: 'MultiEdit', category: 'output', target: 'src/pages/CustomerCheckin.vue' },
    { tool: 'Write', category: 'output', target: 'src/api/checkin.js' },
    { tool: 'Glob', category: 'exploration', target: 'src/**/*.vue' },
    { tool: 'TodoWrite', category: 'planning', target: 'todo list' },
  ]);
  assert.deepEqual(session.commands.map((command) => command.command), ['npm run dev']);
});

test('preserves POSIX paths and filters Claude Code events by report window', async () => {
  const facts = await loadClaudeFacts({
    claudeRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const posix = facts.sessions.find((session) => session.id === 'claude-posix-session');

  assert.ok(posix);
  assert.equal(posix.cwd, '/Users/example/project/workline');
  assert.equal(posix.project, '/Users/example/project/workline');
  assert.deepEqual(posix.lowConfidence.map((item) => item.summary), [
    'Reviewed POSIX Claude Code history support.',
  ]);
});

test('missing Claude Code history root returns empty facts', async () => {
  const facts = await loadClaudeFacts({
    claudeRoot: path.join(fixturesRoot, 'missing'),
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  assert.deepEqual(facts, { sessions: [], warnings: [] });
});

test('extracts Claude user message text for report language fallback and skips tool-only user rows', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-claude-language-'));
  const sessionDir = path.join(tempRoot, 'C--repo-workline');
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'language.jsonl'), [
    JSON.stringify({
      type: 'user',
      sessionId: 'claude-language-session',
      cwd: 'C:\\repo\\workline',
      timestamp: '2026-05-06T01:00:00.000Z',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: '请继续用中文整理报告。' },
        ],
      },
    }),
    JSON.stringify({
      type: 'user',
      sessionId: 'claude-language-session',
      cwd: 'C:\\repo\\workline',
      timestamp: '2026-05-06T01:05:00.000Z',
      toolUseResult: {
        command: 'git status --short',
        exitCode: 0,
      },
    }),
  ].join('\n'), 'utf8');

  const facts = await loadClaudeFacts({
    claudeRoot: tempRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  assert.deepEqual(facts.sessions.map((session) => ({
    completed: session.completed,
    inProgress: session.inProgress,
    lowConfidence: session.lowConfidence,
    commands: session.commands.map((command) => command.command),
  })), [{
    completed: [],
    inProgress: [],
    lowConfidence: [],
    commands: ['git status --short'],
  }]);
  assert.deepEqual(facts.languageMessages?.map((message) => ({
    text: message.text,
    sourceType: message.sourceType,
  })), [
    { text: '请继续用中文整理报告。', sourceType: 'claude_user' },
  ]);
});
