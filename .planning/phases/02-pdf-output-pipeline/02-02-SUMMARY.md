---
phase: 02-pdf-output-pipeline
plan: 02
subsystem: api
tags: [cloudconvert, pdf, pipeline, cli, markdown-to-pdf, fallback]

# Dependency graph
requires:
  - phase: 02-pdf-output-pipeline
    provides: "convertMarkdownToPdf function, generateOutputPath function, ParsedFilename type, PipelineOptions.outputPath"
provides:
  - "End-to-end PDF generation pipeline: BIA PDF in -> Claude analysis -> CloudConvert conversion -> PDF saved to disk"
  - "CLI --output/-o flag for custom output path (CLI-04)"
  - "Markdown .md fallback on CloudConvert failure (D-07)"
affects: [03-robustness-and-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline dryRun branching, CloudConvert fallback to .md on error, metadata to stderr / markdown to stdout separation]

key-files:
  created: []
  modified: [src/pipeline.ts, src/cli.ts]

key-decisions:
  - "Pipeline function signature takes config: AppConfig as second parameter so cloudConvertKey is passed from CLI caller"
  - "Metadata (model, tokens, stop reason) always goes to stderr; markdown to stdout only in dry-run mode"
  - "On CloudConvert failure, .pdf extension replaced with .md and markdown saved as fallback per D-07"

patterns-established:
  - "Pipeline branching on dryRun: dry-run outputs markdown to stdout, non-dry-run converts to PDF and saves to disk"
  - "CLI passes validated config to pipeline (separation of validation and execution)"

requirements-completed: [CLI-04, PDF-01, PDF-02]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 02 Plan 02: Pipeline PDF Conversion + CLI --output Flag Summary

**End-to-end PDF generation wired into pipeline with dryRun branching, --output/-o CLI flag, and .md fallback on CloudConvert failure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T21:14:00Z
- **Completed:** 2026-03-26T21:17:00Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 2

## Accomplishments

- Pipeline branches on dryRun flag: dry-run outputs markdown to stdout (unchanged from Phase 1), non-dry-run converts to PDF via CloudConvert and saves to disk
- CLI has --output/-o flag wired through PipelineOptions to override auto-generated output path (CLI-04)
- CloudConvert failure gracefully degrades to .md file saved alongside original PDF (D-07)
- User verified end-to-end flow: PDF is clean and readable, tables well-formatted, filename follows YYYY_MM_DD - [Client Name] - Riassunto BIA.pdf pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PDF conversion branch to pipeline and --output flag to CLI** - `e9125cd` (feat)
2. **Task 2: Verify end-to-end PDF generation with real BIA report** - human-verify checkpoint, approved by user

## Files Created/Modified

- `src/pipeline.ts` - Added PDF conversion branch (Step 5) with CloudConvert call when !dryRun, .md fallback on error, spinner messaging per mode
- `src/cli.ts` - Added --output/-o option, pass config to runPipeline, conditional stdout output (markdown only in dry-run)

## Decisions Made

- Pipeline function signature takes `config: AppConfig` as second parameter so cloudConvertKey is available without re-reading env
- Metadata line (model, tokens, stop reason) always written to stderr so it does not pollute stdout piped output
- On CloudConvert failure, the `.pdf` extension is replaced with `.md` and raw markdown is saved as a fallback, implementing decision D-07

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. CloudConvert API key was already configured in Phase 1.

## Next Phase Readiness

- Phase 2 complete: full end-to-end pipeline from BIA PDF input to client-ready PDF output is working
- Phase 3 (Robustness and Polish) can begin: retry logic, verbose logging, error messages, and prompt template variables
- CloudConvert markdown rendering quality confirmed acceptable by user (D-01 decision: no need to switch to HTML-to-PDF path)

## Self-Check: PASSED

All files verified present, all commit hashes verified in git log.

---
*Phase: 02-pdf-output-pipeline*
*Completed: 2026-03-26*
