# Project Research Summary

**Project:** BIA Summary
**Domain:** Single-purpose CLI tool — multimodal PDF analysis + API-based PDF generation
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

BIA Summary is a focused personal CLI tool for an Italian health professional who uses an Akern BIA 101 BIVA Pro / Bodygram device. The tool ingests 6-page Bodygram PDF reports, sends them to Claude's multimodal API for structured extraction and summarization, and delivers a clean Italian-language PDF summary to the client via CloudConvert. Research confirms this is a straightforward 5-file linear pipeline: the tool has no server, no database, no GUI, and no multi-user requirements. The entire architecture fits in a single asynchronous pipeline function. The established expert pattern for this class of tool is: thin CLI entry point, typed config loader, thin API client wrappers, and a central orchestrator that sequences the steps.

The recommended stack is intentionally minimal: Node.js 22 LTS with TypeScript 5.7, the official `@anthropic-ai/sdk` (sending PDFs as native `document` content blocks — not images), the official `cloudconvert` SDK for the markdown-to-PDF job pipeline, `commander` for CLI argument parsing, `zod` for startup validation, and `ora` for progress feedback. Total: 5 production dependencies. The model recommendation is `claude-sonnet-4-20250514` — its multimodal vision is needed to interpret the Biavector and other graphical charts that local PDF parsers would miss entirely. At $0.05–0.08 per report and 10–20 reports per month, API cost is negligible.

The dominant risks are correctness risks, not engineering risks. Claude can hallucinate numerical values from dense BIA tables (off-by-one errors in kg or %). Markdown tables rendered via CloudConvert may look plain or broken. And a vague prompt will produce structurally inconsistent output across runs. All three risks are addressed in Phase 1 through prompt engineering discipline (enumerate every parameter by name, hard-code sex-specific thresholds, include few-shot examples, set `temperature: 0`) and early end-to-end testing with real Bodygram PDFs before shipping the prompt.

## Key Findings

### Recommended Stack

The tool uses a deliberately lean stack. Node.js native `--env-file` eliminates the `dotenv` dependency. `tsx` replaces the heavier `ts-node` for development execution. `tsup` bundles to ESM for distribution. The project must use `"type": "module"` throughout — `ora` v8 and the rest of the modern ecosystem are ESM-only. See STACK.md for full configuration details including `package.json` and `tsconfig.json` key fields, verified API integration code samples, and a comprehensive alternatives table.

**Core technologies:**
- `@anthropic-ai/sdk ^0.80.x`: Claude API client — sends PDF as `document` content block (text + image dual extraction), the only approach that captures visual charts
- `cloudconvert ^3.0.0`: Markdown-to-PDF via API — avoids local Puppeteer/Chromium dependencies; user already has active subscription
- `commander ^13.x`: CLI argument parsing — zero deps, battle-tested, not overkill like oclif
- `zod ^3.x`: Environment validation — fail-fast startup check that both API keys are present
- `tsx ^4.x` / `tsup ^8.x`: Dev runner and build tool — esbuild-powered, zero-config for this project size
- `ora ^8.x`: Terminal spinner — essential UX because Claude + CloudConvert takes 15–40 seconds total

### Expected Features

Research identifies a clear v1 MVP (end-to-end pipeline + essential debugging) and a well-defined set of deferred features. The anti-features list is equally important: local PDF parsing, GUI, batch processing, report archival, and model selection flags are all explicitly out of scope and would actively harm the project. See FEATURES.md for the full competitor analysis showing this tool reduces a 15–20 minute manual workflow to under 1 minute.

**Must have (table stakes):**
- PDF input via CLI argument — core invocation pattern (`bia-summary ./report.pdf`)
- Claude multimodal API call via `document` block — extracts text AND interprets charts/tables visually
- Configurable prompt loaded from external file — professional iterates prompt without touching code
- CloudConvert markdown-to-PDF conversion — produces clean client-facing PDF
- Auto-generated output filename — derived from Claude-extracted client name and exam date
- API key configuration via `.env` / environment variables — both keys required at startup
- Human-readable error messages and exit codes — tool user is a health professional, not a developer
- `--dry-run` flag — previews markdown before spending a CloudConvert credit

**Should have (v1.x, add after validation):**
- `--verbose` flag for step-by-step logging
- `--output` / `-o` flag for custom output path
- Retry logic with exponential backoff for transient API errors (Anthropic SDK has built-in retry; CloudConvert needs manual handling)
- Prompt template variables (`{{CLIENT_NAME}}`, `{{EXAM_DATE}}`)

**Defer (v2+):**
- Batch processing — not validated; current volume is 1–5 exams/day, each reviewed individually
- `--json` flag for structured data output — no current consumer
- Comparison mode (current vs. previous exam) — requires archival
- Custom PDF template (HTML-to-PDF) — only if "semplice e pulito" markdown output proves insufficient

### Architecture Approach

The architecture is a strictly linear 5-step pipeline: validate input, load prompt, call Claude API (PDF in, markdown out), call CloudConvert API (markdown in, PDF out), write output file. There is no branching, no parallelism, and no state. The critical structural decision is keeping the pipeline in its own `pipeline.ts` module, separate from CLI argument parsing in `cli.ts`, so the core logic is testable without simulating CLI invocations. Each external API gets its own thin client wrapper (`clients/claude.ts`, `clients/cloudconvert.ts`) that hides SDK verbosity from the pipeline. See ARCHITECTURE.md for the full data flow diagram, CloudConvert job structure JSON, and verified Claude API request structure.

**Major components:**
1. `cli.ts` — Entry point: parses args with `commander`, calls pipeline, handles top-level errors with user-friendly messages
2. `pipeline.ts` — Orchestrator: sequences validate → load prompt → analyze → convert → write
3. `config.ts` — Loads prompt template from file, validates env vars with Zod at startup
4. `clients/claude.ts` — Base64-encodes PDF, sends as `document` block, returns markdown string
5. `clients/cloudconvert.ts` — Creates import/upload + convert + export/url job, waits for completion, returns PDF buffer

### Critical Pitfalls

1. **Numerical hallucination from dense BIA tables** — Claude may misread values like 46.2 kg as 46.8 kg from the compressed page images. Mitigation: enumerate every parameter by name in the prompt, instruct Claude to flag uncertain values with `[UNCERTAIN]`, use `document` block (not image) to get the text layer, and manually verify the first 3+ reports against originals.

2. **PDF text layer ignored (using image-only approach)** — Sending PDF pages pre-converted to PNG images loses the text layer entirely. The `document` content block with `media_type: "application/pdf"` provides dual extraction (text + image). Never use `type: "image"` for PDFs.

3. **Silent summary truncation from low `max_tokens`** — The default `max_tokens: 1024` from example code truncates mid-table. Set to 8192+. Always check `stop_reason === "end_turn"` and throw an error if it is `"max_tokens"`.

4. **CloudConvert markdown table rendering is ugly** — Default markdown-to-PDF CSS produces plain tables with poor column widths and no borders. Test early with real data. If unacceptable, switch Claude's output format to HTML and the CloudConvert job to HTML-to-PDF — the API structure is identical.

5. **Inconsistent output structure from vague prompt** — A generic prompt produces different parameter sets and formats on each run. The prompt must enumerate exact parameters, specify section structure, hard-code sex-specific thresholds, list explicit exclusions (BMI, Hydragram), and include at least one few-shot output example. Set `temperature: 0`.

## Implications for Roadmap

Based on combined research, this project is a single coherent phase with one clear validation gate. There is no reason to split into a multi-phase feature roadmap — the tool is either working end-to-end or it is not.

### Phase 1: Foundation and Core Pipeline

**Rationale:** All critical pitfalls apply to Phase 1. The entire MVP is one sequential pipeline; you cannot partially ship it. The build order from ARCHITECTURE.md (types → config → claude client → cloudconvert client → pipeline → CLI) is the natural implementation sequence. The Claude client should be built and validated first because it represents the core value proposition and its output quality determines whether the project succeeds.

**Delivers:** A working CLI that takes a Bodygram PDF and produces a client-ready Italian-language summary PDF with body composition data, goal table, and nutritional guidance.

**Addresses (from FEATURES.md):**
- All P1 must-have features: PDF input, Claude multimodal call, configurable prompt, CloudConvert conversion, auto-named output, .env config, error messages, `--dry-run`, exit codes

**Avoids (from PITFALLS.md):**
- Use `document` block (not `image`) from the first API call — structural, cannot retrofit
- Set `max_tokens: 8192` and check `stop_reason` from day one — never silently truncated
- Add `.gitignore` and `.env.example` before any API code — secrets hygiene from commit one
- Invest heavily in prompt engineering: named parameters, hard-coded thresholds, exclusions, few-shot example
- Test CloudConvert markdown table output with real data early — forces the markdown vs. HTML decision before the prompt is finalized

**Build sequence within phase:**
1. Project scaffolding: `package.json`, `tsconfig.json`, `tsup.config.ts`, `.gitignore`, `.env.example`
2. `types.ts` + `config.ts` with Zod env validation
3. `clients/claude.ts` — base64 PDF send, markdown extraction, `stop_reason` check
4. Prompt engineering: iterate `prompts/default.txt` until Claude produces consistent, accurate output against 3+ real BIA reports
5. `clients/cloudconvert.ts` — job pipeline, error handling, PDF download
6. `pipeline.ts` — wires both clients together with progress feedback (ora spinner)
7. `cli.ts` — commander arg parsing, `--dry-run`, `--output`, `--prompt` flags, user-friendly error handling
8. End-to-end validation: run against 5 reports, verify all numbers, check both sexes

### Phase 2: Robustness and Polish (v1.x)

**Rationale:** Add after Phase 1 is in real-world use. The features here are triggered by observed pain points, not speculation.

**Delivers:** More reliable tool under real-world conditions — API failures handled gracefully, output path flexibility, and diagnostic capability.

**Implements (from FEATURES.md, "Add After Validation"):**
- `--verbose` flag for step-by-step stderr logging
- `--output` / `-o` flag for custom output path
- Retry with exponential backoff for CloudConvert (Anthropic SDK handles Claude retries automatically)
- Progress spinner improvements (named steps: "Analyzing PDF...", "Converting to PDF...")

### Phase 3: Prompt Enhancements (v1.x, optional)

**Rationale:** Only if the professional finds the static prompt limiting after regular use.

**Delivers:** Reduced friction for per-client prompt customization.

**Implements:**
- Prompt template variables (`{{CLIENT_NAME}}`, `{{EXAM_DATE}}`) via two-pass approach

### Phase Ordering Rationale

- The entire tool is one pipeline; Phase 1 must ship end-to-end before Phases 2 and 3 add value
- Prompt engineering is inside Phase 1, not deferred — the output quality is the product
- The markdown vs. HTML decision for CloudConvert output must be made in Phase 1 because it changes what Claude outputs and the entire conversion pipeline
- Phases 2 and 3 are triggered by real-world friction, not planned upfront — they may never be needed

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 (prompt engineering):** The Bodygram report format, sex-specific BIA thresholds ("in forma" / "ottima definizione"), and Italian nutritional guidance vocabulary need professional input from the tool's user before the prompt is finalized. This is domain knowledge, not engineering research.
- **Phase 1 (CloudConvert output format):** Early testing will determine whether markdown-to-PDF is acceptable or whether HTML-to-PDF is required. This is a practical experiment, not a research question — but it gates the rest of prompt engineering.

Phases with standard patterns (skip research-phase):

- **Phase 2:** Retry logic, verbose logging, and output path flags are standard CLI patterns with no unknowns.
- **Phase 3:** Template variable substitution is a solved problem with simple string replacement.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official sources, SDK versions confirmed, ESM-only constraint clearly documented |
| Features | HIGH | Feature set derived from actual tool requirements (PROJECT.md) + official API capability docs; anti-features list is well-reasoned |
| Architecture | HIGH | Linear pipeline is the canonical pattern for this class of tool; component boundaries are clear and verified against official SDK examples |
| Pitfalls | HIGH | Pitfalls verified against official Anthropic PDF docs, actual Bodygram PDF analysis, and peer-reviewed medical LLM hallucination research |

**Overall confidence:** HIGH

### Gaps to Address

- **Sex-specific BIA thresholds:** The target value table for "in forma" and "ottima definizione" requires the professional's clinical judgment. Claude must not invent these ranges. The prompt engineer (or the professional themselves) must supply exact thresholds per sex before Phase 1 is complete.
- **CloudConvert markdown rendering quality:** Unknown until tested with real BIA summary content. The fallback (HTML-to-PDF) is known and ready, but the decision requires an empirical test in Phase 1.
- **Actual Bodygram PDF text layer quality:** Research confirms the tool is a digitally-generated PDF (not scanned), so the text layer should be clean. Verified with one sample PDF. Edge cases (older firmware, different export settings) are not ruled out.

## Sources

### Primary (HIGH confidence)
- [Anthropic PDF Support Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support) — document block type, base64 encoding, 32MB/100-page limits, dual text+image extraction, token costs
- [Anthropic TypeScript SDK (GitHub)](https://github.com/anthropics/anthropic-sdk-typescript) — v0.80.0, message creation with document blocks
- [Anthropic Vision Limitations](https://platform.claude.com/docs/en/build-with-claude/vision) — accuracy degradation with dense tables, small text
- [Anthropic Stop Reasons Documentation](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) — max_tokens truncation detection
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Sonnet 4 at $3/$15 per MTok (March 2026)
- [CloudConvert Node.js SDK (GitHub)](https://github.com/cloudconvert/cloudconvert-node) — v3.0.0, job-based workflow (import/upload + convert + export/url)
- [CloudConvert MD to PDF](https://cloudconvert.com/md-to-pdf) — confirmed markdown-to-PDF conversion support
- [Bodygram Plus Software Manual](https://www.akern.com/wp-content/uploads/2020/12/BODYGRAM-_basic_rev.6_2019_EN.pdf) — report format, available metrics, 6-page structure

### Secondary (MEDIUM confidence)
- [LLM Medical Summarization Hallucination Study (Nature, 2025)](https://www.nature.com/articles/s41746-025-01670-7) — 1.47% hallucination rate, 3.45% omission rate in clinical note generation; numerical values most vulnerable
- [JAMA Network Open: LLM Accuracy in Medical Records](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2822301) — variability in hallucination rates across models for medical data

### Tertiary (LOW confidence — needs validation)
- Actual CloudConvert markdown table rendering quality — only confirmed through general markdown-to-PDF conversion capability, not tested with BIA summary table structure

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
