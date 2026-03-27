# Phase 1: Core Analysis Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 01-core-analysis-pipeline
**Areas discussed:** Prompt discovery, Dry-run output, Config & API keys, Response quality

---

## Prompt Discovery

### Prompt file location

| Option | Description | Selected |
|--------|-------------|----------|
| Same dir as PDF | Look for prompt.txt in the same directory as the input PDF | ✓ |
| Working directory | Look for prompt.txt in the current working directory | |
| Fixed config dir | Look in ~/.bia-summary/prompt.txt | |

**User's choice:** Same dir as PDF

### --prompt flag

| Option | Description | Selected |
|--------|-------------|----------|
| Yes (Recommended) | bia-summary report.pdf --prompt custom-prompt.txt | |
| No | Keep it simple, one fixed location only | ✓ |

**User's choice:** No

### Missing prompt behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Error and exit | Clear error message explaining where the tool looked | ✓ |
| Built-in fallback | Ship a default prompt embedded in the code | |

**User's choice:** Error and exit

---

## Dry-Run Output

### What to show

| Option | Description | Selected |
|--------|-------------|----------|
| Raw markdown | Print Claude's markdown response directly to stdout | |
| Markdown + metadata | Print markdown plus extracted metadata header | ✓ |
| You decide | Claude has discretion | |

**User's choice:** Markdown + metadata

### Pipeable output

| Option | Description | Selected |
|--------|-------------|----------|
| Yes (Recommended) | Only markdown to stdout, status to stderr | ✓ |
| Not important | Print everything to stdout | |

**User's choice:** Yes — pipeable output

---

## Config & API Keys

### API key source

| Option | Description | Selected |
|--------|-------------|----------|
| .env file | Read from .env in working directory | |
| Env vars only | Only environment variables | |
| Both (Recommended) | .env as default, env vars override | ✓ |

**User's choice:** Both — .env file with env var override

### Missing keys behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Error at startup | Check all required keys before doing anything | ✓ |
| Error when needed | Only fail when specific API is called | |

**User's choice:** Error at startup — fail fast

---

## Response Quality

### Output validation

| Option | Description | Selected |
|--------|-------------|----------|
| No validation | Trust Claude, save as-is | |
| Basic checks | Verify key sections exist, warn if missing | |
| Math validation | Check FM+FFM ≈ weight, TBW = ECW+ICW, warn on mismatch | ✓ |

**User's choice:** Math validation

### max_tokens handling

| Option | Description | Selected |
|--------|-------------|----------|
| Set high, trust it | Set 4096+, don't worry | |
| Check stop_reason | Set high AND check if truncated, warn user | ✓ |

**User's choice:** Check stop_reason

---

## Claude's Discretion

- Specific Claude model selection (Sonnet 4 recommended by research)
- Exact max_tokens value (minimum 4096)
- Markdown structure details beyond prompt instructions

## Deferred Ideas

None — discussion stayed within phase scope
