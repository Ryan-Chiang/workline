# Workline

Workline turns AI work traces into reportable, trackable progress. It is built for people who use Codex, Claude Code, and similar coding Agents heavily, and want a low-maintenance way to summarize what actually happened.

Current status: early release. The project focuses on local evidence first; it does not upload your Agent logs.

## For Humans

### What it does

Workline reads local Codex session facts and Claude Code history facts, then generates Markdown artifacts for weekly reporting.

It is designed to answer:

- What work happened in the selected period
- What appears complete, with evidence
- What is still in progress
- What can be reused in a human-facing progress report

### Who it is for

This early release is for developers, product builders, and technical leads who use Agent-assisted workflows often enough that their real progress is scattered across local sessions, commands, branches, diffs, and notes.

It is not a team task manager, project management system, or personal desktop assistant.

### Install

Prerequisite: Node.js `>=24.0.0`.

For an npm install:

```powershell
npm install -g workline
```

On macOS, the same command can be run from a shell:

```bash
npm install -g workline
```

To upgrade later:

```powershell
npm install -g workline@latest
```

If you are testing from a local checkout:

```powershell
npm install
npm link
```

### Quick Start

Install the Agent-facing Workline skill for Codex and Claude:

```powershell
workline install-skill --target both
```

By default, Workline reads:

- Codex sessions from `$CODEX_HOME/sessions` when `CODEX_HOME` is set, otherwise from your user home `.codex/sessions` directory
- Claude Code history from `$CLAUDE_CONFIG_DIR/projects` when `CLAUDE_CONFIG_DIR` is set, otherwise from your user home `.claude/projects` directory

On macOS and Linux these are typically `~/.codex/sessions` and `~/.claude/projects`. On Windows they resolve under `%USERPROFILE%`.

After installation, ask the Agent for a Workline report with `$workline`, `/workline`, or a natural-language request such as `生成本周周报`.

You can pass source paths explicitly:

```bash
workline --context --print-output-path --codex-root ~/.codex/sessions --claude-root ~/.claude/projects
```

The printed path is an intermediate Agent context file. The final user-facing report is written by the Agent to the `Final report path` declared inside that context.

Use `workline --facts` only when you explicitly want the internal fact/debug summary.

### Privacy

Workline reads local files from your machine and writes Markdown output locally. The CLI does not upload raw Codex sessions, Claude Code transcripts, or generated reports.

Generated reports may still contain local paths, project names, branch names, command summaries, and inferred work outcomes. Review output before sharing it with others.

### Known Limits

- Codex and Claude Code local history extraction are the current first-class Agent sources.
- Git, Slack, email, PR metadata, and other sources are future expansion areas unless already present in local Agent context.
- The final human-facing weekly report is written by the current Agent from generated local context, not by a full deterministic renderer.
- Low-confidence follow-up items should be reviewed by a human before becoming tasks.

### License

Workline is open source under the MIT License.

## For Agents

### When To Use

Use workline when the user asks for Workline, `$workline`, `/workline`, weekly progress, work summaries, Agent-assisted work recap, `本周周报`, `周报`, or related reporting material based on local work traces.

Do not treat chat messages, draft notes, or exploratory commands as completed outcomes unless the local facts support that conclusion.

### Install Prerequisites

Before installing, verify:

```powershell
node --version
npm --version
git --version
```

Node.js must be `>=24.0.0`. If Node is too old, stop and tell the user to upgrade Node before continuing.

### Install From npm

Use:

```powershell
npm install -g workline
```

To upgrade an existing global install, use:

```powershell
npm install -g workline@latest
```

If the user is working from a cloned repository, use:

```powershell
npm install
npm link
```

### Verify Installation

Run:

```powershell
workline --context --print-output-path
```

Expected result: an Agent context Markdown file path is printed. Treat that path as an intermediate file, not as the final weekly report.

If the command fails because local Codex sessions and Claude Code history are missing, inaccessible, or empty for the selected period, report that fact directly instead of inventing progress.

### Install The Workline Skill

Install the Agent-facing skill:

```powershell
workline install-skill --target both
```

Targets:

- `codex`: installs to the user-level Codex skills directory
- `claude`: installs to the user-level Claude skills directory
- `both`: installs both; this is the default

After installing, verify the printed `SKILL.md` paths if the user asks whether installation is complete.

### Generate Workline Context

For Agent-written final reports, generate context with:

```powershell
workline --context --print-output-path
```

Treat stdout as path-only output. Read the generated context file, then write the final report to the `Final report path` declared in that context.

Pass through user-provided time bounds or source paths when relevant:

```powershell
workline --context --print-output-path --since <instant> --until <instant> --timezone <iana> --codex-root <path> --claude-root <path>
```

### Command Boundaries

Use `workline --facts` only for deterministic fact/debug summaries.

Use `workline --context` for Agent-facing context.

Use `$workline`, `/workline`, Workline wording, or a natural-language weekly request for the final human-facing report after the skill is installed.

Do not call bare `workline`; the terminal CLI requires `--context`, `--facts`, or an explicit compatible `--format` output layer.

Do not present `workline-facts-*.md` as the final weekly report.

### Final Report Rules

Write outcome-first. Prefer actual state changes and reusable results over implementation steps.

Keep process evidence as support, not as the headline. File edits, commands, config changes, draft docs, and validation runs are evidence unless they clearly represent the user's desired outcome.

Do not copy compact internal evidence IDs such as `[E1]` into the final report. Convert evidence into human-readable descriptions, paths, links, commands, commits, or session references.

Mark low-confidence follow-ups explicitly and leave them for human confirmation.

After the final Markdown report is written successfully, delete the generated agent-context file. If final report writing fails, preserve the context file and tell the user its path so the workflow can be recovered.

### Troubleshooting

If installation fails, check Node version, npm registry access, npm permissions, and whether the package has been published.

If no facts are found, check the date range, timezone, Codex sessions path, and Claude Code projects path.

If generated context is long, summarize conservatively from the bounded context instead of asking the user to paste raw logs.

If output contains sensitive local paths or private project names, tell the user to review before sharing.

### License Handling

Treat Workline as MIT-licensed open source software.
