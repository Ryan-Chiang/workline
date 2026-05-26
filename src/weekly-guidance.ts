// 这些规则同时进入 agent-context 和 installed weekly skill；放在单处维护，避免两条用户路径漂移。
export const workTopicAgentTaskGuidance = [
  'Use human-readable topic headings directly as report sections instead of nesting them under a fixed structural label.',
  'Do not prefix topic headings with Work topic:. Do not add a Key outcomes subheading; list outcome bullets directly under each topic heading.',
  'Choose a concise human-readable work topic name for each report block that explains what this reporting period advanced.',
  'Treat cwd, repo, branch, and file paths as source evidence and scoping signals, not final report labels.',
  'Use local naming evidence when available, including repository content, product or site names, README content, package metadata, manifests, docs, page copy, branch, issue, or PR semantics.',
  'Do not use full local paths as final report work topic names; if naming evidence is insufficient or conflicting, use the least misleading concise technical name and do not invent product names or business meaning.',
];

export const outcomeAgentTaskGuidance = [
  'Write the opening summary and outcomes outcome-first: prioritize results, effects, state changes, and solved problems over activity logs.',
  'Prioritize outcomes that answer whether goals advanced, problems were solved, state changed, current capability is usable, or blockers remain.',
  'Treat file edits, commands, configuration changes, draft documents, and validation runs as process evidence or support, not default outcomes.',
  'If facts only support process progress or unconfirmed outcomes, use conservative wording with an evidence or confidence marker; do not invent business impact, user value, completion status, or solved-problem claims.',
  'When an outcome has a clear deliverable, attach an outcome reference that helps readers access, validate, or continue the work.',
  'Prefer references that target readers can access, such as links, PRs, remote branches, commits, document URLs, release URLs, or shared artifacts.',
  'Use local file paths, source sessions, or command evidence only when no more generally accessible reference is available.',
  'Do not use opaque internal versions or tool-specific identifiers such as Feishu revision numbers, source sessions, local-only evidence IDs, or context indexes as final-report references.',
  'If only opaque or inaccessible references are available, omit the reference instead of explaining that no usable link exists.',
  'Write the final report as a human-to-human deliverable, not as Agent commentary about generation choices.',
  'Do not explain omitted transactional items, missing evidence, filtering decisions, context limits, or internal reasoning in the final report.',
  'Integrate outcome references naturally into outcome text; do not prefix them with labels such as 成果引用, 证据, Reference, Evidence, or Source unless the user explicitly asks.',
  'When a process artifact itself is the deliverable, describe the outcome it enables and keep editing or command steps as evidence.',
];

export const transactionalAgentTaskGuidance = [
  'Exclude pure transactional work from the final report.',
  'Pure transactional work includes one-off reminders, scheduling, notifications, confirmations, waiting, relays, or personal-assistant actions that do not create project progress, deliverables, decisions, state changes, reusable knowledge, or collaboration outcomes.',
  'Do not write pure transactional work into the opening summary, topic headings, or outcome bullets.',
  'Only include transactional process artifacts when they support a substantive outcome and have business, reuse, decision, or follow-up value.',
  'Keep substantive work from mixed sessions and omit transactional details that do not affect understanding of the work outcome.',
  'If the reporting period only contains pure transactional interactions, say there is no substantive work progress to report; do not invent outcomes, impact, completion status, or next steps.',
];

export const boundedContextAgentTaskGuidance = [
  'This context may contain bounded previews and omission notes; use evidence references to recover details when needed.',
  'Do not treat omitted details as absent, and do not invent details beyond the visible preview.',
];

export const finalReportEvidenceGuidance = [
  'Do not copy raw compact evidence IDs such as [E1], evidence=[E1], or (evidence: [E1]) into the final report.',
  'When final-report traceability is needed, integrate the reference naturally into the outcome text instead of exposing evidence mechanics.',
];

export const weeklyHarnessToolsLayer = [
  '`workline weekly --context --print-output-path`: generates the local agent-context Markdown file and prints only that file path to stdout; treat stdout as path-only output.',
  'Pass through `--since`, `--until`, `--timezone`, `--codex-root`, or `--claude-root` when the user gives a time range, timezone, Codex sessions path, or Claude Code history path.',
  'Generated agent-context file: bounded/summarized CLI-facing evidence package for the shared weekly harness contract, containing local facts, compact evidence references, Report language, and Final report path.',
  'Evidence index: maps compact evidence references to local evidence files.',
  'Evidence files referenced by the index: local potentially large/raw evidence sources.',
];

export const weeklyHarnessContextPolicy = [
  'Treat the context as an evidence pack, not as a draft report or complete fact set.',
  'Treat actual context cost as unknown until content is observed.',
  'Start from bounded/summarized context and the evidence index.',
  'Expand only the smallest evidence needed to support, weaken, or reject a concrete final-report decision.',
  'After reading extra evidence, compress the observation into usable facts before deciding whether to continue.',
  ...boundedContextAgentTaskGuidance,
];

export const weeklyHarnessOperatingLoop = [
  'Use this internal operating loop for uncertain final-report decisions, without printing raw `Thought`, `Action`, or `Observation` labels.',
  'Frame the concrete final-report decision: whether to include a candidate claim or outcome, what topic name or display name to use, whether to include an evidence reference, or whether to exclude a fact.',
  'Identify what visible or missing evidence would support, weaken, or reject that decision.',
  'Act by reading the smallest useful bounded context or raw evidence source.',
  'Observe by compressing findings into usable facts.',
  'Decide whether to write, use conservative wording, exclude the fact, or read one more minimal evidence source.',
  'Stop expanding evidence once a conservative final-report statement is sufficiently supported.',
];

export const weeklyHarnessPermissionBoundaries = [
  'MVP stays local: use the local `workline` CLI and local evidence.',
  'The shared weekly harness contract is an internal behavior contract, not a separate program, service, config file, installed package, or user-visible component.',
  'The workflow does not require a cloud service, external LLM provider, background service, Slack collector, email collector, task manager, desktop assistant, or another runtime component.',
  'Use the current agent model to understand, classify, and write the report.',
];

export const weeklyHarnessIdentityNamingRules = [
  'Resolve the report display name from available identity evidence. Prefer explicit user preference and human-readable display names over technical usernames, logins, or handles.',
  'When online identity sources are already available and authorized, verify the current account through official CLI or API before using it.',
  'Do not infer the report display name from remote owners, repository namespaces, email prefixes, or machine usernames.',
  'If identity evidence is missing, conflicting, or low confidence, omit the display name and use a localized generic report title; never write placeholder display names such as `你的名字`, `your name`, or equivalent placeholders.',
  ...workTopicAgentTaskGuidance,
  'When it is clearer, combine a stable product or system name with the active work focus, for example `product / current work focus`.',
];

export const weeklyHarnessJudgmentRules = [
  ...outcomeAgentTaskGuidance,
  ...transactionalAgentTaskGuidance,
  'Do not automatically exclude low-confidence content; when included, keep a concise confidence or evidence marker.',
];

export const weeklyHarnessOutputContract = [
  'Use the user system language resolved by `workline` and declared as Report language for the final report title, period line, headings, and body.',
  'Write the final Markdown report to the Final report path, then tell the user that path and a short completion summary.',
  'Do not run `workline weekly --facts` for the final human-facing weekly report workflow.',
  'Do not present `weekly-facts-*.md` paths or contents as the final weekly report.',
  'Treat the generated agent-context file as an intermediate artifact, not as a default user-facing deliverable.',
  'After the final Markdown report is written successfully, delete the generated agent-context file.',
  'Do not present the generated agent-context path as a default user-facing deliverable.',
  'If final report writing fails, preserve the generated agent-context file and report its path so the workflow can be recovered.',
  'Start the final Markdown report with exactly two localized opening lines: a report title, then a period line using `{startDate}` and `{endDate}`; format both dates as `yyyy-MM-dd`.',
  'Include the report display name in the title only when identity evidence is reliable; otherwise omit the display name.',
  'Do not write placeholder display names such as `你的名字`, `your name`, or equivalent placeholders.',
  'Keep the report scan-first: put the short overall summary immediately after the opening lines without a fixed Overview heading, then list work topics.',
  'Do not use `Overview` or `Work topics` as fixed visible section headings.',
  'Use human-readable topic headings directly, then list outcome bullets directly under each topic heading.',
  ...finalReportEvidenceGuidance,
  'Do not include raw `Thought`, `Action`, or `Observation` labels, tool-use traces, context-budget explanations, reasoning transcripts, or evidence-expansion decisions in the final report.',
  'Do not add standalone sections for in-progress items, risks, blockers, suggested next steps, or evidence appendix unless the user explicitly asks.',
  'If extraction returns no facts, say that no usable local work facts were found instead of inventing content.',
];

export const weeklyAgentContextHarnessGuidance = [
  'This context is the CLI-facing evidence package for the shared weekly harness contract, not a separate program, service, or user-visible component.',
  'The MVP stays local and relies on local Agent facts, local evidence references, and the local output path.',
  'The command stdout is path-only; the generated context file is the content Agent should read next.',
  'Do not use `workline weekly --facts` while writing the final report; fact summaries are explicit debug artifacts, not user-facing report output.',
  'When telling the user where the weekly report is, use the Final report path, not `weekly-facts-*.md` or the generated context path.',
  'Visible content may be bounded/summarized, truncated, or folded; compact evidence references point to local raw or potentially large evidence files.',
  'Read raw evidence only when visible context is insufficient to support, weaken, or reject a concrete final-report decision.',
  'Start from a concrete final-report decision, such as whether to include a candidate claim or outcome, what topic name or display name to use, whether to include an evidence reference, or whether to exclude a fact.',
  'Compress the observation into usable facts before continuing.',
  'Do not include raw `Thought`, `Action`, or `Observation` labels, internal reasoning, raw loop labels, context-budget explanations, tool-use traces, or evidence-expansion decisions in the final Markdown report.',
];
