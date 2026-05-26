import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
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

  assert.equal(facts.sessions.length, 3);
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
