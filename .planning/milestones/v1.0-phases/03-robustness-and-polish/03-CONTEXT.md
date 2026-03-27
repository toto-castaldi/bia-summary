# Phase 3: Robustness and Polish - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the tool for real-world use: add retry logic for transient API errors, verbose logging for debugging, improve error messages, and support template variables in the prompt file. This is the final phase — after this, the tool is production-ready for the user's daily BIA workflow.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User deferred all implementation details to Claude. The following areas need decisions during planning/execution:

**Verbose Logging (CLI-03):**
- What shows with `--verbose`: step-by-step progress, timing, API details
- How to implement: likely a verbose flag passed through the pipeline
- Existing pattern: ora spinner already handles progress on stderr

**Error Messages (CLI-05):**
- Error messages already exist for most failure modes (missing file, missing keys, CloudConvert failure)
- This requirement is about auditing and improving existing messages for clarity and consistency
- Pattern: `console.error()` to stderr + `process.exit(1)` already established

**Retry Strategy (PDF-04):**
- Which API calls: both Claude and CloudConvert
- Transient errors: 429, 500, 502, 503
- Backoff: exponential with jitter, max 3 retries
- What shows during retry: stderr message about retry attempt

**Template Variables (AI-08):**
- Variables: at minimum `{{CLIENT_NAME}}`, `{{EXAM_DATE}}`
- Source: already available from filename parsing (`src/filename.ts` — `parseInputFilename()`)
- Approach: replace variables in prompt text before sending to Claude
- Edge case: if filename parsing fails, skip template replacement (variables remain as-is in prompt)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints
- `.planning/REQUIREMENTS.md` — CLI-03, CLI-05, PDF-04, AI-08 requirements

### Phase 1 & 2 Code (integration points)
- `src/cli.ts` — Add --verbose flag, improve error messages
- `src/pipeline.ts` — Add verbose logging, wire retry logic
- `src/clients/claude.ts` — Add retry wrapper for API calls
- `src/clients/cloudconvert.ts` — Add retry wrapper for API calls
- `src/config.ts` — Template variable replacement in loadPrompt()
- `src/filename.ts` — parseInputFilename() provides template variable values
- `src/types.ts` — May need verbose flag in PipelineOptions

### Research
- `.planning/research/PITFALLS.md` — max_tokens truncation, retry-after headers

### Prior Phase Contexts
- `.planning/phases/01-core-analysis-pipeline/01-CONTEXT.md` — D-05 (stderr for status), D-09/D-10 (validation)
- `.planning/phases/02-pdf-output-pipeline/02-CONTEXT.md` — D-07 (markdown fallback on failure)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseInputFilename()` in `src/filename.ts` — returns `ParsedFilename` with `clientName` and `date`, perfect for template variable population
- ora spinner pattern — already handles progress on stderr
- Error handling pattern — `console.error()` + `process.exit(1)` for all error paths

### Established Patterns
- All status/progress output to stderr (pipeable stdout)
- `process.exit(1)` for fatal errors
- Spinner with `.start()`, `.text =`, `.succeed()`, `.fail()` lifecycle

### Integration Points
- `src/cli.ts` — needs `--verbose` flag
- `src/pipeline.ts` — needs verbose logging calls, retry wrappers around API calls
- `src/config.ts` `loadPrompt()` — needs template variable replacement
- `src/clients/claude.ts` `analyzePdf()` — needs retry wrapper
- `src/clients/cloudconvert.ts` `convertMarkdownToPdf()` — needs retry wrapper

</code_context>

<specifics>
## Specific Ideas

- Template variable replacement should happen in `loadPrompt()` — load the file, replace `{{CLIENT_NAME}}` and `{{EXAM_DATE}}` with values from filename parsing, return the processed prompt
- Retry logic should be a shared utility function used by both API clients
- Verbose mode should log: loading prompt, sending to Claude (with file size), Claude response received (with token counts), sending to CloudConvert, PDF download, file saved

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-robustness-and-polish*
*Context gathered: 2026-03-27*
