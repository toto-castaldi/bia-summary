---
phase: 03-robustness-and-polish
plan: 01
subsystem: api
tags: [retry, exponential-backoff, template-variables, anthropic-sdk, cloudconvert]

# Dependency graph
requires:
  - phase: 02-pdf-output
    provides: CloudConvert client (convertMarkdownToPdf) and pipeline structure
  - phase: 01-core-pipeline
    provides: Claude client (analyzePdf), types, config (loadPrompt), filename parsing
provides:
  - withRetry utility for CloudConvert API calls with exponential backoff and jitter
  - TemplateVars interface for prompt variable replacement
  - verbose flag in PipelineOptions (ready to wire in Plan 02)
  - onRetry callback passthrough on convertMarkdownToPdf for caller-controlled retry feedback
affects: [03-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [SDK-native retry for Anthropic, custom withRetry wrapper for CloudConvert, template variable replacement via String.replaceAll]

key-files:
  created: [src/retry.ts]
  modified: [src/types.ts, src/clients/claude.ts, src/clients/cloudconvert.ts, src/config.ts, src/cli.ts]

key-decisions:
  - "Use Anthropic SDK maxRetries: 3 instead of custom wrapper to avoid double-retry pitfall"
  - "withRetry checks error.cause instanceof Response for CloudConvert error structure (ES2022 cause)"
  - "Template variable {{EXAM_DATE}} converts YYYY_MM_DD to DD/MM/YYYY for Italian convention"

patterns-established:
  - "Retry pattern: SDK-native retry for SDKs that support it, custom withRetry for those that don't"
  - "Template vars: simple replaceAll with graceful degradation (unreplaced vars remain as literal text)"

requirements-completed: [PDF-04, AI-08]

# Metrics
duration: 14min
completed: 2026-03-27
---

# Phase 03 Plan 01: Retry Logic and Template Variables Summary

**Retry logic via SDK maxRetries for Claude and custom withRetry wrapper for CloudConvert, plus {{CLIENT_NAME}}/{{EXAM_DATE}} template variable replacement in loadPrompt**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-27T06:20:49Z
- **Completed:** 2026-03-27T06:35:26Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created shared withRetry utility with exponential backoff, full jitter, and Retry-After header support for CloudConvert API calls
- Configured Anthropic SDK with maxRetries: 3 (leveraging SDK-native retry instead of custom wrapper)
- Added template variable support to loadPrompt for {{CLIENT_NAME}} and {{EXAM_DATE}} replacement from filename parsing data
- Extended PipelineOptions with verbose flag and added TemplateVars interface for future wiring in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types, create retry utility, wire Claude maxRetries** - `280a311` (feat)
2. **Task 2: Wire CloudConvert retry with onRetry passthrough and add template variables to loadPrompt** - `9509392` (feat)

## Files Created/Modified
- `src/retry.ts` - NEW: withRetry utility with RetryOptions, exponential backoff, jitter, Retry-After header parsing
- `src/types.ts` - Added verbose: boolean to PipelineOptions, new TemplateVars interface
- `src/clients/claude.ts` - Set maxRetries: 3 on Anthropic constructor
- `src/clients/cloudconvert.ts` - Wrapped jobs.create and jobs.wait with withRetry, added optional onRetry callback parameter
- `src/config.ts` - Extended loadPrompt with optional TemplateVars parameter for {{CLIENT_NAME}} and {{EXAM_DATE}} replacement
- `src/cli.ts` - Added verbose: false to PipelineOptions literal for type compatibility

## Decisions Made
- Used Anthropic SDK maxRetries: 3 instead of custom wrapper to avoid double-retry pitfall (SDK already handles 429 Retry-After, exponential backoff, connection errors)
- withRetry checks error.cause instanceof Response for CloudConvert error structure (ES2022 Error cause feature) as confirmed by CloudConvert SDK source
- Template variable {{EXAM_DATE}} converts YYYY_MM_DD to DD/MM/YYYY for Italian date convention
- Did NOT wrap fetch() download call in retry -- only CloudConvert API calls (jobs.create, jobs.wait) are retried

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added verbose: false to cli.ts PipelineOptions object**
- **Found during:** Task 1 (after adding verbose to PipelineOptions interface)
- **Issue:** TypeScript compilation failed because cli.ts did not include the new required verbose field
- **Fix:** Added verbose: false to the PipelineOptions object in cli.ts (Plan 02 will wire the --verbose CLI flag properly)
- **Files modified:** src/cli.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 280a311 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal fix to maintain type compatibility. Plan 02 will properly wire the --verbose CLI option.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired. Template variable replacement and retry logic are complete. The verbose flag is set to false as a default; Plan 02 will wire the --verbose CLI option and threading through the pipeline.

## Next Phase Readiness
- Retry logic and template variables are ready for Plan 02 to wire into the CLI (--verbose flag) and pipeline (verbose logging, template var population from parseInputFilename)
- onRetry callback on convertMarkdownToPdf is ready for Plan 02 to use for spinner text updates during retries

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 03-robustness-and-polish*
*Completed: 2026-03-27*
