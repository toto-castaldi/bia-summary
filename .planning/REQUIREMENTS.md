# Requirements: BIA Summary

**Defined:** 2026-03-26
**Core Value:** Il cliente riceve un riassunto chiaro e leggibile della propria composizione corporea, senza dover interpretare il report tecnico originale.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### CLI Interface

- [x] **CLI-01**: User can run `bia-summary <file.pdf>` to process a single BIA report
- [x] **CLI-02**: User can use `--dry-run` flag to preview markdown output without PDF conversion
- [ ] **CLI-03**: User can use `--verbose` flag to see step-by-step progress logging
- [x] **CLI-04**: User can use `--output` / `-o` flag to specify custom output path
- [ ] **CLI-05**: Tool displays clear, human-readable error messages for: missing file, missing API keys, API failures, invalid PDF
- [x] **CLI-06**: Tool exits with code 0 on success, non-zero on failure

### AI Analysis

- [x] **AI-01**: Tool sends the entire PDF to Claude API as a multimodal document block (base64)
- [x] **AI-02**: Tool loads the prompt from an external text file (default: `./prompt.txt`)
- [x] **AI-03**: Claude extracts body composition data: demographics (name, age, sex, weight, height, exam date), composition (FFM, FM in kg and %), metabolism (BMR, TDEE)
- [x] **AI-04**: Claude generates a goal table with sex-specific thresholds ("in forma" and "ottima definizione") as defined in the prompt
- [x] **AI-05**: Claude provides nutritional guidance based on extracted metabolism data
- [x] **AI-06**: Claude output excludes BMI and hydration data as instructed by the prompt
- [x] **AI-07**: Output is in Italian language
- [ ] **AI-08**: Prompt supports template variables (e.g., `{{CLIENT_NAME}}`, `{{EXAM_DATE}}`) populated from report data or CLI args

### PDF Output

- [x] **PDF-01**: Tool converts Claude's markdown output to PDF via CloudConvert API
- [x] **PDF-02**: Output PDF is saved with auto-generated filename: `YYYY_MM_DD - [Client Name] - Riassunto BIA.pdf`
- [x] **PDF-03**: API keys (ANTHROPIC_API_KEY, CLOUDCONVERT_API_KEY) are read from environment variables or `.env` file
- [ ] **PDF-04**: API calls retry with exponential backoff on transient errors (429, 500, 502, 503), max 3 retries

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Batch Processing

- **BATCH-01**: User can process multiple PDFs in a single command
- **BATCH-02**: User can specify a folder to process all PDFs within it

### Advanced Output

- **ADV-01**: User can use `--json` flag for structured data output
- **ADV-02**: Tool supports comparison mode between current and previous exam
- **ADV-03**: Tool supports custom HTML-to-PDF templates for richer design

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI or GUI | Single professional, CLI is sufficient |
| Multi-user / authentication | Personal tool, no shared access needed |
| Local PDF parsing | Claude multimodal handles text + visual data from charts |
| Report archival / database | Filesystem is the archive, tool generates and saves |
| Fancy PDF design (logos, colors, infographics) | "Semplice e pulito" is the stated requirement |
| Model selection flag | Hardcode Sonnet; change in code if needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 1 | Complete |
| CLI-03 | Phase 3 | Pending |
| CLI-04 | Phase 2 | Complete |
| CLI-05 | Phase 3 | Pending |
| CLI-06 | Phase 1 | Complete |
| AI-01 | Phase 1 | Complete |
| AI-02 | Phase 1 | Complete |
| AI-03 | Phase 1 | Complete |
| AI-04 | Phase 1 | Complete |
| AI-05 | Phase 1 | Complete |
| AI-06 | Phase 1 | Complete |
| AI-07 | Phase 1 | Complete |
| AI-08 | Phase 3 | Pending |
| PDF-01 | Phase 2 | Complete |
| PDF-02 | Phase 2 | Complete |
| PDF-03 | Phase 1 | Complete |
| PDF-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
