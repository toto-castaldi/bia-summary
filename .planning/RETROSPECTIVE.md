# Project Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-27
**Phases:** 3 | **Plans:** 7

### What Was Built
- TypeScript 6.0 ESM CLI tool: `bia-summary <report.pdf>`
- Claude multimodal PDF analysis with configurable prompt
- CloudConvert markdown-to-PDF conversion
- Auto-generated output filenames from Bodygram filename pattern
- --dry-run, --verbose, --output flags
- Template variables in prompt ({{CLIENT_NAME}}, {{EXAM_DATE}})
- Retry logic for both API clients
- Math validation (FM+FFM vs weight, TBW vs ECW+ICW)
- Markdown fallback on CloudConvert failure

### What Worked
- Linear 3-phase structure matched the pipeline architecture perfectly (foundation → PDF → polish)
- Coarse granularity kept phases manageable (3-5 phases, 1-3 plans each)
- Project-level research upfront avoided re-researching in each phase
- Human verification checkpoints caught real issues before proceeding
- YOLO mode with quality agents (research + plan-check + verifier) — fast but thorough

### What Was Inefficient
- Phase 2 ROADMAP.md had stale progress table (showed "Not started" for phases already complete) — roadmap updates didn't always propagate
- Revision loop triggered once in Phase 3 planning (onRetry callback wiring) — could have been caught at plan creation with more careful cross-plan contract analysis

### Patterns Established
- All output to stderr except dry-run markdown (D-05 invariant)
- Spinner (ora) for user-facing progress, verboseLog for detailed logging
- Config validation at startup with fail-fast (Zod 4 safeParse)
- Prompt file co-located with input PDF
- Filename parsing with 3-level fallback chain

### Key Lessons
- For a small personal CLI tool, 3 coarse phases were ideal — enough structure without overhead
- Claude's multimodal PDF reading worked well for structured medical reports
- CloudConvert import/raw eliminates stream complexity for small content

### Cost Observations
- Model mix: opus for research/planning/execution, sonnet for verification/checking
- Sessions: 1 long session covering all 3 phases
- Notable: The entire v1.0 was built in a single day

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Duration | Key Pattern |
|-----------|--------|-------|----------|-------------|
| v1.0 MVP | 3 | 7 | 1 day | Linear pipeline, coarse granularity |
