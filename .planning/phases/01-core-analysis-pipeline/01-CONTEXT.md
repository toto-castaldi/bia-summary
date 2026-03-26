# Phase 1: Core Analysis Pipeline - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI tool that accepts a BIA PDF report, sends it to Claude multimodal API with a configurable prompt, and outputs a structured Italian-language markdown summary of the client's body composition. Includes --dry-run preview mode. This phase delivers the core value proposition — everything after this is delivery format (PDF) and polish.

</domain>

<decisions>
## Implementation Decisions

### Prompt Discovery
- **D-01:** Prompt file is looked for in the same directory as the input PDF (e.g., if input is `/reports/client.pdf`, look for `/reports/prompt.txt`)
- **D-02:** No `--prompt` flag — single fixed location strategy, keep it simple
- **D-03:** If prompt file not found, error and exit with clear message explaining where the tool looked. No built-in fallback prompt.

### Dry-Run Output
- **D-04:** `--dry-run` prints markdown to stdout with extracted metadata (client name, date) shown as a header before the content
- **D-05:** Output is pipeable: only markdown goes to stdout, any status/progress messages go to stderr

### Configuration & API Keys
- **D-06:** API keys read from both `.env` file (working directory) and environment variables. Env vars override `.env` values.
- **D-07:** Both `ANTHROPIC_API_KEY` and `CLOUDCONVERT_API_KEY` are validated at startup. Missing keys cause immediate exit with clear error message listing which keys are missing.
- **D-08:** Note: In Phase 1 (dry-run only, no PDF conversion), `CLOUDCONVERT_API_KEY` validation still happens at startup for consistency, even though it won't be used until Phase 2.

### Response Quality
- **D-09:** Math validation on Claude's output: verify FM + FFM ≈ body weight, TBW ≈ ECW + ICW. Warn the user (to stderr) if mismatches detected but still output the result.
- **D-10:** Set `max_tokens` to 4096+. Check `stop_reason` in Claude's response — if truncated, warn the user that the summary may be incomplete.

### Claude's Discretion
- Claude chooses the specific model (research recommends Sonnet 4 for cost/speed balance)
- Claude decides the exact `max_tokens` value (minimum 4096)
- Claude decides markdown structure details beyond what the prompt specifies

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, core value, constraints
- `.planning/REQUIREMENTS.md` — Full v1 requirements with REQ-IDs mapped to this phase

### Research
- `.planning/research/STACK.md` — Technology stack recommendations (Anthropic SDK, Commander, etc.)
- `.planning/research/ARCHITECTURE.md` — Component structure and data flow
- `.planning/research/PITFALLS.md` — Domain-specific risks (numerical hallucination, truncation, prompt engineering)
- `.planning/research/SUMMARY.md` — Synthesized research findings

### Sample Data
- `26_03_2026 - Angelina Jolie - Report di stampa _ Bodygram.pdf` — Example BIA report to test against

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- Sample BIA PDF in repo root for testing
- `.env` file (to be created) for API key configuration

</code_context>

<specifics>
## Specific Ideas

- The user provided a detailed example prompt in Italian that includes: demographic extraction, body composition data (massa grassa/magra in kg and %), sex-specific goal tables ("in forma" at 26%F/22%M, "ottima definizione" at 18%F/14%M), BMR/TDEE prospetto, nutritional guidance, and explicit exclusions (no BMI, no hydration, no "Se vuoi posso..." closings)
- The prompt is the product's core differentiator — it encodes professional expertise into a repeatable template
- The sample PDF is from Bodygram software (Akern), 6 pages containing: Biavector, Biagram, quantitative analysis tables, glossary, indices, hydration/nutrition charts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-analysis-pipeline*
*Context gathered: 2026-03-26*
