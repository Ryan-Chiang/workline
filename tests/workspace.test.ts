import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { loadWorkspaceFacts } from '../src/workspace.ts';

function git(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('loads dirty strategy documents as in-progress workspace evidence', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-workspace-'));
  git(repo, ['init']);
  fs.mkdirSync(path.join(repo, 'docs', 'strategy'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs', 'strategy', 'workline-gtm.md'), [
    '# Workline Positioning and GTM Direction',
    '',
    '## Core Judgment',
    '',
    'Workline should use semi-open Build in public.',
    '',
    '## Pricing and Packaging',
    '',
    'Use local-first freemium.',
    '',
    '## Language Strategy',
    '',
    'Chinese reports should stay readable.',
  ].join('\n'), 'utf8');

  const facts = await loadWorkspaceFacts({ cwd: repo });

  assert.equal(facts.warnings.length, 0);
  assert.equal(facts.sessions.length, 1);
  const [session] = facts.sessions;
  assert.equal(session.source, 'workspace');
  assert.equal(session.surface, 'Workspace');
  assert.equal(session.inProgress.length, 1);
  assert.match(session.inProgress[0].summary, /Workspace draft document/);
  assert.match(session.inProgress[0].summary, /workline-gtm\.md/);
  assert.match(session.inProgress[0].summary, /Workline Positioning and GTM Direction/);
  assert.match(session.inProgress[0].summary, /themes=Build in public, GTM, pricing, language/);
  assert.equal(session.evidenceFile, path.join(repo, 'docs', 'strategy', 'workline-gtm.md'));
});

test('returns no workspace facts outside a git repository', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workline-no-git-'));
  const facts = await loadWorkspaceFacts({ cwd: directory });

  assert.deepEqual(facts.sessions, []);
  assert.deepEqual(facts.warnings, []);
});
