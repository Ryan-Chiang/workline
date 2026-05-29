import test from 'node:test';
import assert from 'node:assert/strict';

import {
  boundedContextAgentTaskGuidance,
  finalReportEvidenceGuidance,
  outcomeAgentTaskGuidance,
  transactionalAgentTaskGuidance,
  workTopicAgentTaskGuidance,
} from '../src/weekly-guidance.ts';
import { renderWeeklySkillMarkdown } from '../src/weekly-skill-template.ts';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function section(markdown: string, heading: string): string {
  const pattern = new RegExp(`^## ${escapeRegex(heading)}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm');
  const match = markdown.match(pattern);
  assert.ok(match, `missing section: ${heading}`);
  return match[1] ?? '';
}

test('workline skill template renders trigger metadata without workflow shortcuts', () => {
  const markdown = renderWeeklySkillMarkdown();

  assert.match(markdown, /^---\nname: workline\n/m);
  assert.match(markdown, /description: Use when the user asks for workline/);
  assert.match(markdown, /\$workline/);
  assert.match(markdown, /\/workline/);
  assert.match(markdown, /Workline report/);
  assert.match(markdown, /workline summary/);
  assert.match(markdown, /本周周报/);
  assert.doesNotMatch(markdown.split('---')[1] ?? '', /Run `workline/);
});

test('workline skill template renders explicit harness contract layers', () => {
  const markdown = renderWeeklySkillMarkdown();

  assert.match(markdown, /## Available Local Tools/);
  assert.match(markdown, /## Context Policy/);
  assert.match(markdown, /## Operating Loop/);
  assert.match(markdown, /## Permission and Action Boundaries/);
  assert.match(markdown, /## Judgment Rules/);
  assert.match(markdown, /## Identity and Naming/);
  assert.match(markdown, /## Output Contract/);
  assert.doesNotMatch(markdown, /^## Harness$/m);
  assert.doesNotMatch(markdown, /^## Guardrails$/m);
  assert.doesNotMatch(markdown, /^## Reasoning Frame$/m);
  assert.match(markdown, /Agent-facing adapter/);
  assert.match(markdown, /local fact\/context engine/);
  assert.match(markdown, /Treat the context as an evidence pack, not as a draft report/);
  assert.match(markdown, /final-report decision/);
  assert.match(markdown, /whether to include a candidate claim or outcome/);
  assert.match(markdown, /what topic name or display name to use/);
  assert.match(markdown, /whether to include an evidence reference/);
  assert.match(markdown, /whether to exclude a fact/);
  assert.doesNotMatch(markdown, /## Procedure/);
  assert.doesNotMatch(markdown, /Then render the rest of the final report as Markdown following this logical structure/);
  assert.doesNotMatch(markdown, /"overview": "overall summary"/);
});

test('workline skill tools layer is pure and constraints live in explicit layers', () => {
  const markdown = renderWeeklySkillMarkdown();
  const tools = section(markdown, 'Available Local Tools');
  const boundaries = section(markdown, 'Permission and Action Boundaries');
  const context = section(markdown, 'Context Policy');
  const output = section(markdown, 'Output Contract');

  assert.match(tools, /path-only/);
  assert.match(tools, /workline --context --print-output-path/);
  assert.doesNotMatch(tools, /workline weekly --context --print-output-path/);
  assert.doesNotMatch(tools, /workline --format agent-context --print-output-path/);
  assert.match(tools, /bounded\/summarized/);
  assert.match(tools, /potentially large\/raw/);
  assert.doesNotMatch(tools, /external LLM provider|cloud service|display name|transactional work|Do not infer|Do not call/i);
  assert.match(context, /actual context cost as unknown until content is observed/);
  assert.match(context, /Expand only the smallest evidence needed/);
  assert.match(boundaries, /MVP stays local/);
  assert.match(boundaries, /does not require a cloud service/);
  assert.match(boundaries, /external LLM provider/);
  assert.match(output, /Do not include raw `Thought`, `Action`, or `Observation` labels/);
  assert.match(output, /tool-use traces/);
  assert.match(output, /evidence-expansion decisions/);
  assert.match(output, /Treat the generated agent-context file as an intermediate artifact/);
  assert.match(output, /After the final Markdown report is written successfully, delete the generated agent-context file/);
  assert.match(output, /Do not present the generated agent-context path as a default user-facing deliverable/);
});

test('workline skill forbids fact summaries in the final-report flow', () => {
  const markdown = renderWeeklySkillMarkdown();
  const tools = section(markdown, 'Available Local Tools');
  const output = section(markdown, 'Output Contract');

  assert.doesNotMatch(tools, /workline --facts/);
  assert.doesNotMatch(tools, /workline weekly --facts/);
  assert.match(output, /Do not run `workline --facts` for the final human-facing weekly report workflow/);
  assert.match(output, /Do not present `workline-facts-\*\.md` paths or contents as the final report/);
});

test('workline skill output contract prioritizes scanability and avoids placeholder display names', () => {
  const markdown = renderWeeklySkillMarkdown();
  const identity = section(markdown, 'Identity and Naming');
  const output = section(markdown, 'Output Contract');

  assert.match(identity, /If identity evidence is missing, conflicting, or low confidence, omit the display name/);
  assert.match(output, /Use the declared Report language for the final report title, period line, headings, and body/);
  assert.match(output, /current conversation language should be passed to `workline --context --print-output-path --report-language <language>` before context generation/);
  assert.match(markdown, /Fibonacci/);
  assert.match(output, /Do not write placeholder display names such as `你的名字`/);
  assert.match(output, /Keep the report scan-first/);
  assert.match(output, /Do not use `Overview` or `Work topics` as fixed visible section headings/);
  assert.match(output, /Use human-readable topic headings directly/);
  assert.doesNotMatch(markdown, /From \{startDate\} to \{endDate\}/);
  assert.doesNotMatch(markdown, /use `你的名字`/i);
  assert.doesNotMatch(markdown, /Use final report structure: Overview, Work topics/);
});

test('workline skill template reuses the same guidance exported for agent context', () => {
  const markdown = renderWeeklySkillMarkdown();
  const sharedGuidance = [
    ...outcomeAgentTaskGuidance,
    ...transactionalAgentTaskGuidance,
    ...workTopicAgentTaskGuidance,
    ...finalReportEvidenceGuidance,
    ...boundedContextAgentTaskGuidance,
  ];

  for (const rule of sharedGuidance) {
    assert.match(markdown, new RegExp(`^- ${escapeRegex(rule)}$`, 'm'));
  }
});
