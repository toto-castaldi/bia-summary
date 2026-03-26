# Phase 2: PDF Output Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 02-pdf-output-pipeline
**Areas discussed:** Conversion path, Filename extraction, PDF formatting, Failure handling

---

## Conversion Path

| Option | Description | Selected |
|--------|-------------|----------|
| md → pdf direct | Simplest path. Switch later if tables look bad | |
| md → html → pdf | Two-step for better formatting control | |
| You decide | Claude tests md→pdf first, switches if needed | ✓ |

**User's choice:** Claude's discretion — test and decide

---

## Filename Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Parse input filename | Extract from PDF filename pattern. Fast, no extra API call | |
| From Claude response | Ask Claude to return structured metadata | |
| Both (fallback) | Parse filename first, fall back to Claude response | ✓ |

**User's choice:** Both with fallback strategy

---

## PDF Formatting

### Page size

| Option | Description | Selected |
|--------|-------------|----------|
| A4 (Recommended) | Standard European paper size | ✓ |
| Letter | US paper size | |
| You decide | Claude picks | |

**User's choice:** A4

### Font

| Option | Description | Selected |
|--------|-------------|----------|
| Default (system) | Whatever CloudConvert uses | ✓ |
| Sans-serif | Clean modern look | |
| You decide | Claude picks | |

**User's choice:** Default system font

---

## Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Save markdown fallback | Save .md file, warn user | |
| Error and exit | Just fail with clear error | |
| Both | Save markdown AND show error | ✓ |

**User's choice:** Save markdown as fallback AND show error

---

## Claude's Discretion

- md→pdf vs md→html→pdf conversion strategy
- CloudConvert margins and formatting parameters
- Markdown-based name/date extraction as fallback

## Deferred Ideas

None — discussion stayed within phase scope
