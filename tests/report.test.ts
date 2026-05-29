import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { loadCodexFacts } from '../src/codex.ts';
import { renderWeeklyAgentContext, renderWeeklyFactSummary } from '../src/report.ts';
import type { CodexFacts } from '../src/types.ts';

// 常规报告使用真实夹具布局；只有上下文预算边界这种 JSONL 太冗长的场景才用合成事实。
const fixturesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'codex-sessions',
);

const boundedContextWindow = {
  since: new Date('2026-05-03T16:00:00.000Z'),
  until: new Date('2026-05-06T12:00:00.000Z'),
  timezone: 'Asia/Shanghai',
  generatedAt: new Date('2026-05-06T12:30:00.000Z'),
};

// 合成事实刻意制造长文本、多命令和证据复用，稳定覆盖 agent-context 预算规则。
function boundedContextFacts(): CodexFacts {
  const evidenceFile = 'C:\\evidence\\rollout-bounded.jsonl';
  // 尾部标记用于证明预览确实被裁剪，而不是正则刚好没匹配到。
  const longCompleted = `${'Completed bounded context details '.repeat(20)}COMPLETED_TAIL_SHOULD_NOT_RENDER`;
  const longInProgress = `${'Investigating bounded context packaging '.repeat(20)}IN_PROGRESS_TAIL_SHOULD_NOT_RENDER`;
  const longLowConfidence = `${'Agent observed bounded context risk '.repeat(20)}LOW_CONFIDENCE_TAIL_SHOULD_NOT_RENDER`;

  return {
    warnings: [],
    sessions: [{
      id: 'bounded-session',
      cwd: 'C:\\repo\\bounded',
      project: 'C:\\repo\\bounded',
      surface: 'Codex App',
      source: 'codex',
      originator: 'Codex Desktop',
      evidenceFile,
      completed: [{
        summary: longCompleted,
        time: new Date('2026-05-04T01:00:00.000Z'),
        evidenceFile,
        sourceType: 'task_complete',
      }],
      inProgress: [{
        summary: longInProgress,
        time: new Date('2026-05-04T02:00:00.000Z'),
        evidenceFile,
        sourceType: 'task_started',
      }],
      lowConfidence: [{
        summary: longLowConfidence,
        time: new Date('2026-05-04T03:00:00.000Z'),
        evidenceFile,
        sourceType: 'agent_message',
      }],
      commands: [
        // 顺序混合普通、失败、验证、git 和最近命令，用真实证据信号断言优先级选择。
        { command: 'Get-Content README.md', exitCode: 0, time: new Date('2026-05-04T04:00:00.000Z'), evidenceFile },
        { command: 'Get-ChildItem -Recurse', exitCode: 0, time: new Date('2026-05-04T04:01:00.000Z'), evidenceFile },
        { command: 'npm test', exitCode: 1, time: new Date('2026-05-04T04:02:00.000Z'), evidenceFile },
        { command: 'openspec validate "bound-weekly-agent-context" --strict', exitCode: 0, time: new Date('2026-05-04T04:03:00.000Z'), evidenceFile },
        { command: 'git status --short', exitCode: 0, time: new Date('2026-05-04T04:04:00.000Z'), evidenceFile },
        { command: 'Get-Content package.json', exitCode: 0, time: new Date('2026-05-04T04:05:00.000Z'), evidenceFile },
        { command: 'Get-Content src/report.ts', exitCode: 0, time: new Date('2026-05-04T04:06:00.000Z'), evidenceFile },
        { command: `node ./bin/workline.js --context --print-output-path ${'--verbose-detail '.repeat(30)}RECENT_COMMAND_TAIL_SHOULD_NOT_RENDER`, exitCode: 0, time: new Date('2026-05-04T04:07:00.000Z'), evidenceFile },
      ],
      tokenUsage: {
        input_tokens: 1,
        cached_input_tokens: 0,
        output_tokens: 1,
        reasoning_output_tokens: 0,
        total_tokens: 2,
        approximate: false,
      },
    }],
  };
}

function claudeToolContextFacts(): CodexFacts {
  const evidenceFile = 'C:\\evidence\\claude-file-tools.jsonl';

  return {
    warnings: [],
    sessions: [{
      id: 'claude-file-tools-session',
      cwd: 'C:\\repo\\customer-signin',
      project: 'C:\\repo\\customer-signin',
      surface: 'Claude Code',
      source: 'claude',
      originator: 'Claude Code',
      evidenceFile,
      completed: [],
      inProgress: [],
      lowConfidence: [{
        summary: 'Prepared local memory notes for the next pass.',
        time: new Date('2026-05-04T03:00:00.000Z'),
        evidenceFile,
        sourceType: 'claude_assistant',
      }],
      commands: [
        { command: 'npm run dev', exitCode: 0, time: new Date('2026-05-04T04:00:00.000Z'), evidenceFile },
      ],
      toolEvents: [
        { tool: 'Read', category: 'exploration', target: 'src/pages/CustomerCheckin.vue', time: new Date('2026-05-04T03:01:00.000Z'), evidenceFile },
        { tool: 'Edit', category: 'output', target: 'src/pages/CustomerCheckin.vue', time: new Date('2026-05-04T03:02:00.000Z'), evidenceFile },
        { tool: 'MultiEdit', category: 'output', target: 'src/pages/CustomerCheckin.vue', time: new Date('2026-05-04T03:03:00.000Z'), evidenceFile },
        { tool: 'Write', category: 'output', target: 'src/api/checkin.js', time: new Date('2026-05-04T03:04:00.000Z'), evidenceFile },
        { tool: 'Glob', category: 'exploration', target: 'src/**/*.vue', time: new Date('2026-05-04T03:05:00.000Z'), evidenceFile },
        { tool: 'TodoWrite', category: 'planning', target: 'todo list', time: new Date('2026-05-04T03:06:00.000Z'), evidenceFile },
      ],
      tokenUsage: {
        input_tokens: 1,
        cached_input_tokens: 0,
        output_tokens: 1,
        reasoning_output_tokens: 0,
        total_tokens: 2,
        approximate: false,
      },
    }],
  };
}

function qualityGateFacts(): CodexFacts {
  const workspaceEvidence = 'C:\\repo\\workline\\docs\\strategy\\workline-gtm.md';
  const commandEvidence = 'C:\\evidence\\command-heavy.jsonl';

  return {
    warnings: [],
    sessions: [{
      id: 'workspace-doc-session',
      cwd: 'C:\\repo\\workline',
      project: 'C:\\repo\\workline',
      surface: 'Workspace',
      source: 'workspace',
      originator: 'git',
      evidenceFile: workspaceEvidence,
      completed: [],
      inProgress: [{
        summary: 'Workspace draft document: docs/strategy/workline-gtm.md (untracked) headings=Workline Positioning and GTM Direction; Pricing and Packaging; Language Strategy; themes=Build in public, GTM, pricing, language',
        time: new Date('2026-05-04T03:00:00.000Z'),
        evidenceFile: workspaceEvidence,
        sourceType: 'task_started',
      }],
      lowConfidence: [],
      commands: [],
      tokenUsage: {
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
        total_tokens: 0,
        approximate: false,
      },
    }, {
      id: 'command-heavy-session',
      cwd: 'C:\\repo\\command-heavy',
      project: 'C:\\repo\\command-heavy',
      surface: 'Codex App',
      source: 'vscode',
      originator: 'Codex Desktop',
      evidenceFile: commandEvidence,
      completed: [],
      inProgress: [],
      lowConfidence: [],
      commands: Array.from({ length: 6 }, (_, index) => ({
        command: `Get-Content file-${index}.ts`,
        exitCode: 0,
        time: new Date(`2026-05-04T04:0${index}:00.000Z`),
        evidenceFile: commandEvidence,
      })),
      tokenUsage: {
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
        total_tokens: 0,
        approximate: false,
      },
    }],
  };
}

test('renders a project-first weekly fact summary with required sections', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const markdown = renderWeeklyFactSummary(facts, {
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    generatedAt: new Date('2026-05-06T12:30:00.000Z'),
  });

  assert.match(markdown, /^# Workline Weekly Fact Summary/m);
  assert.match(markdown, /Period: 2026-05-04 00:00:00 - 2026-05-06 20:00:00/);
  assert.match(markdown, /Timezone: Asia\/Shanghai/);
  assert.match(markdown, /## C:\\repo\\alpha/);
  assert.match(markdown, /## \/Users\/example\/project\/workline/);
  assert.match(markdown, /### Codex App/);
  assert.match(markdown, /### Codex CLI/);
  assert.match(markdown, /Completed work/);
  assert.match(markdown, /Command evidence/);
  assert.match(markdown, /Token usage/);
  assert.match(markdown, /Warnings and low-confidence notes/);
  assert.doesNotMatch(markdown, /C:\\repo\\historical/);
});

test('renders deterministic fact summary fixed labels in Simplified Chinese', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });

  const markdown = renderWeeklyFactSummary(facts, {
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    generatedAt: new Date('2026-05-06T12:30:00.000Z'),
    reportLanguage: 'zh-Hans',
  });

  assert.match(markdown, /^# Workline 周报事实摘要/m);
  assert.match(markdown, /周期: 2026-05-04 00:00:00 - 2026-05-06 20:00:00/);
  assert.match(markdown, /#### 已完成工作/);
  assert.match(markdown, /#### 命令证据/);
  assert.match(markdown, /## 警告和低置信度说明/);
  assert.match(markdown, /Completed weekly report MVP parser/);
});

test('renders deterministic fact summary fixed labels in Traditional Chinese, Japanese, and French', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });
  const baseWindow = {
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    generatedAt: new Date('2026-05-06T12:30:00.000Z'),
  };

  const traditional = renderWeeklyFactSummary(facts, { ...baseWindow, reportLanguage: 'zh-Hant' });
  const japanese = renderWeeklyFactSummary(facts, { ...baseWindow, reportLanguage: 'ja' });
  const french = renderWeeklyFactSummary(facts, { ...baseWindow, reportLanguage: 'fr' });

  assert.match(traditional, /^# Workline 週報事實摘要/m);
  assert.match(traditional, /#### 已完成工作/);
  assert.match(japanese, /^# Workline 週次ファクトサマリー/m);
  assert.match(japanese, /#### 完了した作業/);
  assert.match(french, /^# Synthese factuelle hebdomadaire Workline/m);
  assert.match(french, /#### Travail terminé/);
  assert.match(french, /Completed weekly report MVP parser/);
});

test('only task_complete entries are rendered as completed work', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });
  const markdown = renderWeeklyFactSummary(facts, {
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    generatedAt: new Date('2026-05-06T12:30:00.000Z'),
  });

  assert.match(markdown, /Completed weekly report MVP parser/);
  assert.match(markdown, /Agent message: Final reviewer note/);
  assert.match(markdown, /Agent message: Second CLI observation/);
  assert.match(markdown, /pwsh\.exe -Command node \.\/bin\/workline\.js weekly/);
  assert.match(markdown, /git status --short/);
  assert.doesNotMatch(markdown, /Unknown command/);
  assert.doesNotMatch(markdown, /Agent message: Explored parser design/);
  assert.doesNotMatch(markdown, /Agent message: Confirm packaging with reviewer/);
  assert.doesNotMatch(markdown, /Agent message: First CLI observation/);
});

test('keeps task_started as in-progress and keeps agent_message out of in-progress', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });
  const appSession = facts.sessions.find((session) => session.id === 'app-session');
  const cliSession = facts.sessions.find((session) => session.id === 'cli-session');

  assert.deepEqual(appSession?.inProgress.map((item) => item.summary), []);
  assert.deepEqual(cliSession?.inProgress.map((item) => item.summary), ['Check report output']);
});

test('renders an agent context package with final report path and evidence', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });
  const markdown = renderWeeklyAgentContext(facts, {
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    generatedAt: new Date('2026-05-06T12:30:00.000Z'),
    finalReportPath: 'C:\\reports\\workline.md',
  });

  assert.match(markdown, /^# Workline Weekly Agent Context/m);
  assert.match(markdown, /Final report path: C:\\reports\\workline\.md/);
  assert.match(markdown, /## Agent task/);
  assert.match(markdown, /CLI-facing evidence package for the shared Workline harness contract/);
  assert.match(markdown, /not a separate program, service, or user-visible component/);
  assert.match(markdown, /path-only/);
  assert.match(markdown, /Do not use `workline --facts` while writing the final report/);
  assert.match(markdown, /use the Final report path, not `workline-facts-\*\.md` or the generated context path/);
  assert.match(markdown, /bounded\/summarized/);
  assert.match(markdown, /local raw or potentially large/);
  assert.match(markdown, /concrete final-report decision/);
  assert.match(markdown, /whether to include a candidate claim or outcome/);
  assert.match(markdown, /what topic name or display name to use/);
  assert.match(markdown, /whether to include an evidence reference/);
  assert.match(markdown, /whether to exclude a fact/);
  assert.match(markdown, /Compress the observation into usable facts/);
  assert.match(markdown, /Do not include raw `Thought`, `Action`, or `Observation` labels/);
  assert.match(markdown, /tool-use traces/);
  assert.match(markdown, /evidence-expansion decisions/);
  assert.match(markdown, /Report language was resolved as English/);
  assert.match(markdown, /use English for the final report title, period line, headings, and body/);
  assert.match(markdown, /Start the final Markdown report with exactly two localized opening lines/);
  assert.match(markdown, /includes `\{report display name\}` only when identity evidence is reliable/);
  assert.match(markdown, /Resolve the report display name from available identity evidence/);
  assert.match(markdown, /Prefer explicit user preference and human-readable display names over technical usernames/);
  assert.match(markdown, /Omit the display name when reliable identity evidence is unavailable/);
  assert.match(markdown, /Do not infer the report display name from remote owners, repository namespaces, email prefixes, or machine usernames/);
  assert.match(markdown, /Do not write placeholder display names such as `你的名字`, `your name`, or equivalent placeholders/);
  assert.match(markdown, /Keep the final report scan-first/);
  assert.match(markdown, /do not use `Overview` or `Work topics` as fixed visible section headings/);
  assert.match(markdown, /Use human-readable topic headings directly/);
  assert.match(markdown, /Do not prefix topic headings with Work topic:/);
  assert.match(markdown, /Do not add a Key outcomes subheading/);
  assert.match(markdown, /Write the opening summary and outcomes outcome-first/);
  assert.match(markdown, /Prioritize outcomes that answer whether goals advanced, problems were solved, state changed, current capability is usable, or blockers remain/);
  assert.match(markdown, /Treat file edits, commands, configuration changes, draft documents, and validation runs as process evidence/);
  assert.match(markdown, /If facts only support process progress or unconfirmed outcomes, use conservative wording/);
  assert.match(markdown, /When an outcome has a clear deliverable, attach an outcome reference that helps readers access, validate, or continue the work/);
  assert.match(markdown, /Prefer references that target readers can access, such as links, PRs, remote branches, commits, document URLs, release URLs, or shared artifacts/);
  assert.match(markdown, /Use local file paths, source sessions, or command evidence only when no more generally accessible reference is available/);
  assert.match(markdown, /Do not use opaque internal versions or tool-specific identifiers such as Feishu revision numbers, source sessions, local-only evidence IDs, or context indexes as final-report references/);
  assert.match(markdown, /If only opaque or inaccessible references are available, omit the reference instead of explaining that no usable link exists/);
  assert.match(markdown, /Write the final report as a human-to-human deliverable, not as Agent commentary about generation choices/);
  assert.match(markdown, /Do not explain omitted transactional items, missing evidence, filtering decisions, context limits, or internal reasoning in the final report/);
  assert.match(markdown, /Integrate outcome references naturally into outcome text; do not prefix them with labels such as 成果引用, 证据, Reference, Evidence, or Source unless the user explicitly asks/);
  assert.match(markdown, /Exclude pure transactional work from the final report/);
  assert.match(markdown, /one-off reminders, scheduling, notifications, confirmations, waiting, relays, or personal-assistant actions/);
  assert.match(markdown, /Do not write pure transactional work into the opening summary, topic headings, or outcome bullets/);
  assert.match(markdown, /Only include transactional process artifacts when they support a substantive outcome and have business, reuse, decision, or follow-up value/);
  assert.match(markdown, /Keep substantive work from mixed sessions and omit transactional details/);
  assert.match(markdown, /If the reporting period only contains pure transactional interactions, say there is no substantive work progress to report/);
  assert.match(markdown, /Choose a concise human-readable work topic name/);
  assert.match(markdown, /Treat cwd, repo, branch, and file paths as source evidence and scoping signals/);
  assert.match(markdown, /Do not use full local paths as final report work topic names/);
  assert.match(markdown, /Do not automatically exclude low-confidence content/);
  assert.match(markdown, /Do not copy raw compact evidence IDs such as \[E1\], evidence=\[E1\], or \(evidence: \[E1\]\) into the final report/);
  assert.match(markdown, /When final-report traceability is needed, integrate the reference naturally into the outcome text instead of exposing evidence mechanics/);
  assert.doesNotMatch(markdown, /Use final report structure: Overview, Work topics, Work topic, Key outcomes/);
  assert.doesNotMatch(markdown, /Use final report structure: Overview, Work topics, Work topic, Key accomplishments/);
  assert.doesNotMatch(markdown, /Use these sections: Overview, Key accomplishments, In progress \/ needs confirmation, Risks and blockers, Suggested next steps, Evidence appendix/);
  assert.doesNotMatch(markdown, /From \{startDate\} to \{endDate\}/);
  assert.match(markdown, /## Project: C:\\repo\\alpha/);
  assert.match(markdown, /#### Candidate completed work/);
  assert.match(markdown, /Completed weekly report MVP parser/);
  assert.match(markdown, /#### In progress \/ needs confirmation/);
  assert.match(markdown, /Check report output/);
  assert.match(markdown, /## Warnings and low-confidence notes/);
  assert.match(markdown, /Agent message: Final reviewer note/);
  assert.match(markdown, /## Evidence index/);
  assert.match(markdown, /rollout-app\.jsonl/);
});

test('renders agent context with report language metadata and language instruction', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });
  const markdown = renderWeeklyAgentContext(facts, {
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    generatedAt: new Date('2026-05-06T12:30:00.000Z'),
    finalReportPath: 'C:\\reports\\weekly.md',
    reportLanguage: 'ko',
    reportLanguageSource: 'local-agent-history',
    reportLanguageConfidence: 'high',
  });

  assert.match(markdown, /Report language: Korean/);
  assert.match(markdown, /Report language source: local-agent-history/);
  assert.match(markdown, /Report language confidence: high/);
  assert.match(markdown, /Report language was resolved as Korean/);
  assert.match(markdown, /## 에이전트 작업/);
});

test('agent context localizes the final-report contract and forbids placeholder display names', async () => {
  const facts = await loadCodexFacts({
    codexRoot: fixturesRoot,
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
  });
  const markdown = renderWeeklyAgentContext(facts, {
    since: new Date('2026-05-03T16:00:00.000Z'),
    until: new Date('2026-05-06T12:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    generatedAt: new Date('2026-05-06T12:30:00.000Z'),
    finalReportPath: 'C:\\reports\\weekly.md',
    reportLanguage: 'zh-Hans',
  });

  assert.match(markdown, /Report language: Simplified Chinese/);
  assert.match(markdown, /报告语言已解析为简体中文；使用简体中文写最终报告的标题、周期、章节名和正文/);
  assert.match(markdown, /第一行使用 `\{report display name\} 工作推进进展`；没有可信展示名时使用 `工作推进进展`/);
  assert.match(markdown, /第二行使用 `周期：\{startDate\} 至 \{endDate\}`/);
  assert.match(markdown, /不要写 `你的名字` 或其他占位称呼/);
  assert.match(markdown, /不要把 `Overview` 或 `Work topics` 作为固定可见章节标题/);
  assert.match(markdown, /直接使用人类可读主题名作为二级标题/);
  assert.doesNotMatch(markdown, /From \{startDate\} to \{endDate\}/);
  assert.doesNotMatch(markdown, /use 你的名字/i);
  assert.doesNotMatch(markdown, /Use final report structure: Overview, Work topics/);
});

test('bounds long agent context facts with previews, compact evidence, and omission notes', () => {
  const facts = boundedContextFacts();
  const markdown = renderWeeklyAgentContext(facts, {
    ...boundedContextWindow,
    finalReportPath: 'C:\\reports\\weekly.md',
  });

  assert.match(markdown, /Completed bounded context details/);
  assert.match(markdown, /\[truncated; full text in \[E1\]\]/);
  assert.doesNotMatch(markdown, /COMPLETED_TAIL_SHOULD_NOT_RENDER/);
  assert.doesNotMatch(markdown, /IN_PROGRESS_TAIL_SHOULD_NOT_RENDER/);
  assert.doesNotMatch(markdown, /LOW_CONFIDENCE_TAIL_SHOULD_NOT_RENDER/);
  assert.match(markdown, /evidence=\[E1\]/);
  assert.match(markdown, /## Evidence index/);
  assert.match(markdown, /- \[E1\] C:\\evidence\\rollout-bounded\.jsonl/);
  assert.match(markdown, /## Context budget notes/);
  assert.match(markdown, /3 work item texts truncated; full text remains available via \[E1\]/);
});

test('prioritizes high-signal command evidence and reports omitted command counts', () => {
  const facts = boundedContextFacts();
  const markdown = renderWeeklyAgentContext(facts, {
    ...boundedContextWindow,
    finalReportPath: 'C:\\reports\\weekly.md',
  });

  assert.match(markdown, /`npm test` exit=1/);
  assert.match(markdown, /`openspec validate "bound-weekly-agent-context" --strict` exit=0/);
  assert.match(markdown, /`git status --short` exit=0/);
  assert.match(markdown, /`node \.\/bin\/workline\.js --context --print-output-path/);
  assert.match(markdown, /\[truncated; full command in \[E1\]\]/);
  assert.doesNotMatch(markdown, /RECENT_COMMAND_TAIL_SHOULD_NOT_RENDER/);
  assert.doesNotMatch(markdown, /`Get-Content README\.md`/);
  assert.match(markdown, /3 command evidence items omitted for Codex App; full commands remain available via \[E1\]/);
});

test('renders language, workspace, and anomaly quality gates in agent context', () => {
  const markdown = renderWeeklyAgentContext(qualityGateFacts(), {
    ...boundedContextWindow,
    finalReportPath: 'C:\\reports\\weekly.md',
    reportLanguage: 'zh-Hans',
  });

  assert.match(markdown, /## Quality gates/);
  assert.match(markdown, /Language quality gate: final report language is Simplified Chinese/);
  assert.match(markdown, /Use the Report language declared above; source evidence language must not override it/);
  assert.match(markdown, /Translate common English shorthand when a natural Simplified Chinese business term exists/);
  assert.match(markdown, /GTM -> 获客\/上市策略/);
  assert.match(markdown, /local-first freemium -> 本地优先的免费增值/);
  assert.match(markdown, /Workspace\/Git diff facts are included as draft or in-progress evidence/);
  assert.match(markdown, /Workspace draft evidence found in \[E\d+\]; do not report it as completed unless commit, release, or external publication evidence exists/);
  assert.match(markdown, /Anomaly gate: session=command-heavy-session has 6 command evidence items but no candidate outcome/);
});

test('summarizes Claude file tool activity and flags low-confidence edit-only sessions', () => {
  const facts = claudeToolContextFacts();
  const markdown = renderWeeklyAgentContext(facts, {
    ...boundedContextWindow,
    finalReportPath: 'C:\\reports\\weekly.md',
  });

  assert.match(markdown, /#### Tool evidence/);
  assert.match(markdown, /Claude Code tool activity: 6 events summarized \(outputs=3, exploration=2, planning=1; evidence=\[E1\]\)/);
  assert.match(markdown, /High-value edits: src\/pages\/CustomerCheckin\.vue edited 2 times; src\/api\/checkin\.js written 1 time/);
  assert.match(markdown, /Exploration: src\/pages\/CustomerCheckin\.vue read 1 time; src\/\*\*\/\*\.vue globbed 1 time/);
  assert.match(markdown, /Planning: TodoWrite updated 1 time/);
  assert.match(markdown, /Read raw evidence \[E1\] before excluding or downgrading this session because it has file edit evidence but only low-confidence narrative/);
});

test('keeps deterministic fact summary rendering unbounded and unchanged by agent context budgets', () => {
  const facts = boundedContextFacts();
  const markdown = renderWeeklyFactSummary(facts, boundedContextWindow);

  assert.match(markdown, /COMPLETED_TAIL_SHOULD_NOT_RENDER/);
  assert.match(markdown, /IN_PROGRESS_TAIL_SHOULD_NOT_RENDER/);
  assert.match(markdown, /LOW_CONFIDENCE_TAIL_SHOULD_NOT_RENDER/);
  assert.match(markdown, /RECENT_COMMAND_TAIL_SHOULD_NOT_RENDER/);
  assert.match(markdown, /evidence=C:\\evidence\\rollout-bounded\.jsonl/);
  assert.doesNotMatch(markdown, /Context budget notes/);
  assert.doesNotMatch(markdown, /\[E1\]/);
});
