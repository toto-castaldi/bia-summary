# Phase 2: PDF Output Pipeline - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert Claude's markdown summary to a client-ready PDF via CloudConvert API and save with auto-generated filename. Adds `--output` / `-o` flag for custom output path. When not in dry-run mode, the tool produces a PDF file instead of printing to stdout.

</domain>

<decisions>
## Implementation Decisions

### Conversion Path
- **D-01:** Claude's Discretion — try md→pdf first via CloudConvert. If table rendering is poor, switch to md→html→pdf (two-step). Implementation decides based on output quality.

### Filename Extraction
- **D-02:** Parse the input PDF filename first (pattern: `DD_MM_YYYY - Client Name - Report di stampa _ Bodygram.pdf`). If parsing fails (non-standard filename), fall back to extracting name/date from Claude's markdown response.
- **D-03:** Output filename format: `YYYY_MM_DD - [Client Name] - Riassunto BIA.pdf` (note: date is reformatted to YYYY_MM_DD)

### PDF Formatting
- **D-04:** Page size: A4 (European standard)
- **D-05:** Font: CloudConvert default (system font)
- **D-06:** Claude's Discretion on margins and other formatting options — whatever looks clean and readable

### Failure Handling
- **D-07:** On CloudConvert failure: save the markdown as a `.md` file (same auto-generated name but .md extension) AND show an error explaining PDF conversion failed. User gets the content either way.

### Claude's Discretion
- md→pdf vs md→html→pdf conversion strategy (test and decide)
- Specific CloudConvert API parameters for margins, header/footer
- How to extract name/date from Claude's markdown response as fallback

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, CloudConvert API URL
- `.planning/REQUIREMENTS.md` — CLI-04, PDF-01, PDF-02 requirements

### Phase 1 Code (integration points)
- `src/types.ts` — AppConfig (has `cloudConvertKey`), PipelineOptions, AnalysisResult
- `src/pipeline.ts` — `runPipeline()` returns AnalysisResult with `markdown` field
- `src/cli.ts` — Commander setup, needs --output/-o flag added
- `src/config.ts` — `validateEnv()` already validates CLOUDCONVERT_API_KEY

### Research
- `.planning/research/STACK.md` — CloudConvert SDK v3.0.0 details, job-based task model
- `.planning/research/ARCHITECTURE.md` — CloudConvert integration pattern (import/upload → convert → export/url)
- `.planning/research/PITFALLS.md` — CloudConvert table rendering concerns, md→html→pdf fallback

### Prior Phase Context
- `.planning/phases/01-core-analysis-pipeline/01-CONTEXT.md` — Phase 1 decisions (D-05 pipeable output, D-06/D-07 API keys)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppConfig.cloudConvertKey` — already available from `validateEnv()`
- `AnalysisResult.markdown` — the content to convert to PDF
- `PipelineOptions` — needs `outputPath?: string` added for --output flag
- `src/cli.ts` — Commander setup ready for new `--output` option

### Established Patterns
- Spinner via ora (to stderr) for progress indication
- Error messages to stderr, content to stdout
- `process.exit(1)` for errors with descriptive messages

### Integration Points
- `runPipeline()` in `src/pipeline.ts` — needs PDF conversion step after analysis
- `src/cli.ts` — needs `--output` / `-o` flag wired to pipeline
- New file: `src/clients/cloudconvert.ts` — CloudConvert API client

</code_context>

<specifics>
## Specific Ideas

- CloudConvert uses a job-based model: create job with import/upload + convert (md→pdf) + export/url tasks, upload markdown, wait for completion, download result
- The input filename pattern `DD_MM_YYYY - Name - Report di stampa _ Bodygram.pdf` is consistent for Bodygram exports — regex parsing should be reliable
- On CloudConvert failure, save markdown as fallback so the user always gets the content (can manually convert or re-run later)
- CloudConvert API endpoint: https://api.cloudconvert.com/v2/jobs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-pdf-output-pipeline*
*Context gathered: 2026-03-26*
