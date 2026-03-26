# Roadmap: BIA Summary

## Overview

BIA Summary is a linear CLI pipeline: read a Bodygram PDF, send it to Claude for multimodal analysis, convert the markdown output to a clean PDF via CloudConvert. The roadmap delivers this in three phases. Phase 1 builds the core analysis engine (Claude integration + dry-run preview), which is the entire value proposition. Phase 2 adds PDF generation via CloudConvert to complete the end-to-end pipeline. Phase 3 hardens the tool with retry logic, verbose logging, better error messages, and prompt template variables.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Analysis Pipeline** - Project scaffolding, Claude multimodal integration, prompt loading, and dry-run markdown preview
- [ ] **Phase 2: PDF Output Pipeline** - CloudConvert integration to produce the final client-facing PDF
- [ ] **Phase 3: Robustness and Polish** - Retry logic, verbose logging, error messages, and prompt template variables

## Phase Details

### Phase 1: Core Analysis Pipeline
**Goal**: User can send a BIA report PDF to Claude and receive a structured Italian-language markdown summary of the client's body composition
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, CLI-06, AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, PDF-03
**Success Criteria** (what must be TRUE):
  1. User can run `bia-summary <file.pdf> --dry-run` and see a formatted markdown summary printed to stdout
  2. The markdown output contains a demographics section (name, age, sex, weight, height, exam date), a body composition table (FFM, FM in kg and %), and metabolism data (BMR, TDEE)
  3. The markdown output contains a goal table with sex-specific thresholds ("in forma" / "ottima definizione") and nutritional guidance, and excludes BMI and hydration data
  4. The prompt is loaded from an external text file (default: `./prompt.txt`) and can be changed without modifying code
  5. Tool exits with code 0 on success and non-zero on failure; missing API keys cause a clear startup error
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold project, install deps, TypeScript 6.0 config, shared types, env/prompt validation
- [x] 01-02-PLAN.md -- Claude API client (PDF document block) and pipeline orchestrator with response validation
- [x] 01-03-PLAN.md -- CLI entry point (commander), end-to-end dry-run verification with sample PDF

### Phase 2: PDF Output Pipeline
**Goal**: User receives a clean, client-ready PDF generated from the Claude markdown output via CloudConvert
**Depends on**: Phase 1
**Requirements**: CLI-04, PDF-01, PDF-02
**Success Criteria** (what must be TRUE):
  1. User can run `bia-summary <file.pdf>` (without --dry-run) and a PDF file is saved to disk
  2. Output PDF filename is auto-generated as `YYYY_MM_DD - [Client Name] - Riassunto BIA.pdf` from data extracted by Claude
  3. User can override the output path with `--output` / `-o` flag
  4. The generated PDF is clean and readable: well-formatted text, visible table borders, clear section headings
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md -- Install CloudConvert SDK, extend types with outputPath, create filename parser and CloudConvert API client
- [x] 02-02-PLAN.md -- Wire PDF conversion into pipeline (dryRun branch), add --output/-o flag to CLI, end-to-end verification

### Phase 3: Robustness and Polish
**Goal**: Tool handles real-world conditions gracefully -- API failures retry automatically, verbose mode aids debugging, and prompts support per-client customization
**Depends on**: Phase 2
**Requirements**: CLI-03, CLI-05, PDF-04, AI-08
**Success Criteria** (what must be TRUE):
  1. User can use `--verbose` flag to see step-by-step progress (loading prompt, calling Claude, calling CloudConvert, writing file)
  2. Tool displays clear, human-readable error messages for missing file, missing API keys, API failures, and invalid PDF inputs
  3. Transient API errors (429, 500, 502, 503) are retried with exponential backoff up to 3 times before failing
  4. Prompt supports template variables (e.g., `{{CLIENT_NAME}}`, `{{EXAM_DATE}}`) that are populated from report data or CLI arguments
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Analysis Pipeline | 3/3 | Complete | 2026-03-26 |
| 2. PDF Output Pipeline | 0/2 | Not started | - |
| 3. Robustness and Polish | 0/1 | Not started | - |
