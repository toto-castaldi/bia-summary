<!-- GSD:project-start source:PROJECT.md -->
## Project

**BIA Summary**

Un tool CLI TypeScript che prende un report PDF di una BIA eseguita con macchina Akern BIA 101 Biva Pro (software Bodygram), lo invia a Claude via API multimodale per generare un riassunto comprensibile per il cliente, e produce un PDF pulito con i dati salienti della composizione corporea. Uso personale di un professionista che esegue esami BIA.

**Core Value:** Il cliente riceve un riassunto chiaro e leggibile della propria composizione corporea, senza dover interpretare il report tecnico originale.

### Constraints

- **Tech stack**: TypeScript, Node.js
- **API esterne**: Claude API (Anthropic) per analisi, CloudConvert API per generazione PDF
- **Input**: PDF generati da Bodygram/Akern
- **Output**: PDF semplice e leggibile per il cliente finale
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Runtime & Language
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | >= 22 LTS | Runtime | Current LTS. Native `--env-file` support eliminates dotenv dependency. Required by Anthropic SDK (>=18). | HIGH |
| TypeScript | ~5.7 | Language | Project constraint. Type safety for API contracts (Claude, CloudConvert). | HIGH |
| tsx | ^4.x | TS runner (dev) | Zero-config TypeScript execution, 5-10x faster startup than ts-node, ESM/CJS transparent. No type-checking (use `tsc --noEmit` separately). | HIGH |
### Core Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| commander | ^13.x | CLI argument parsing | Zero dependencies, 500M+ weekly downloads, built-in TypeScript types, perfect for simple single-command CLIs. Yargs is overkill for a tool with one command and a few options. Oclif is enterprise-grade scaffolding -- absurd for this. | HIGH |
### AI / Document Analysis
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @anthropic-ai/sdk | ^0.80.x | Claude API client | Official Anthropic TypeScript SDK. Native `document` content block type for PDF ingestion -- sends base64-encoded PDF directly. Full multimodal processing (page images + extracted text interleaved). Type-safe API. | HIGH |
### PDF Conversion (Output)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| cloudconvert | ^3.0.0 | Markdown-to-PDF via API | Official Node.js SDK for CloudConvert API v2. User already has active subscription. Supports `import/upload` + `convert` (md -> pdf) + `export/url` job pipeline. TypeScript declarations included. Avoids local PDF generation dependencies (wkhtmltopdf, puppeteer, etc.). | HIGH |
### PDF Reading (Fallback)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| unpdf | ^0.12.x | PDF text extraction fallback | Modern TypeScript-first alternative to unmaintained pdf-parse. ESM native, async/await API. Only needed if Claude's multimodal PDF processing proves insufficient for some report variants. **Install only if needed.** | MEDIUM |
### Environment & Configuration
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js `--env-file` | Native (>=20.6) | Load `.env` file | Zero dependencies. Built into Node.js. `node --env-file=.env` loads vars into `process.env` before app starts. | HIGH |
| zod | ^3.x | Env validation + config schema | Validates API keys exist at startup (fail fast). Type-infers config object from schema. Also useful for validating Claude API response structure. | HIGH |
- `.env` file for secrets: `ANTHROPIC_API_KEY`, `CLOUDCONVERT_API_KEY`
- `prompt.md` file for the Claude prompt template (configurable via CLI flag, default: `./prompt.md`)
- No dotenv package needed -- `--env-file` is native
- Zod schema validates at startup: both keys present, prompt file exists
### Build & Development
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsup | ^8.x | Build/bundle to JS | esbuild-powered, zero-config for simple projects. Outputs ESM bundle. Generates declaration files. Shebang injection for CLI bin entry. | HIGH |
| typescript | ~5.7 | Type checking | `tsc --noEmit` for CI/pre-commit type checking. tsup handles actual compilation. | HIGH |
### CLI UX (Minimal)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ora | ^8.x | Terminal spinner | Shows progress during Claude API call and CloudConvert conversion (both take seconds). ESM-only -- project must use ESM. | MEDIUM |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI framework | commander | yargs | Larger API surface, more deps. Overkill for single-command CLI. |
| CLI framework | commander | oclif | Enterprise scaffolding with many deps. Absurd for a personal tool. |
| CLI framework | commander | citty (UnJS) | Newer, smaller ecosystem. Commander is battle-tested. |
| TS runner | tsx | ts-node | Slower startup, requires tsconfig adjustment, heavier config. |
| TS runner | tsx | Node.js native `--experimental-strip-types` | Still experimental in Node 22. Not stable enough for production. |
| Build tool | tsup | esbuild (raw) | tsup wraps esbuild with sensible defaults. Raw esbuild needs more config. |
| Build tool | tsup | tsc | No bundling, no shebang injection, slower. |
| Env loading | Node.js `--env-file` | dotenv | Extra dependency for something Node.js does natively. |
| Env loading | Node.js `--env-file` | dotenvx | Encryption/multi-env features not needed for personal tool. |
| PDF text | unpdf | pdf-parse | Unmaintained since 2021, CJS-only. |
| PDF text | unpdf | pdfjs-dist | Low-level, large dependency. unpdf wraps it with better DX. |
| PDF output | CloudConvert API | puppeteer + HTML | Heavy local dependency (Chromium). User already pays for CloudConvert. |
| PDF output | CloudConvert API | md-to-pdf | Local tool, requires Chrome/Puppeteer under the hood. |
| PDF output | CloudConvert API | Pandoc + LaTeX | Requires system-level installs. Not portable. |
| Spinner | ora | nanospinner | ora is more mature, better API, wider adoption. |
| Model | claude-sonnet-4 | claude-haiku-3.5 | Cheaper but weaker at chart interpretation and Italian prose. |
| Model | claude-sonnet-4 | claude-haiku-4.5 | Good alternative if cost becomes a concern. 3x cheaper than Sonnet. |
| Model | claude-sonnet-4 | claude-opus-4.6 | 1.7x more expensive input, 1.7x output. Overkill for summarization. |
## Project Configuration
### package.json (key fields)
### tsconfig.json (key fields)
## Installation
# Core dependencies
# Dev dependencies
## File Structure
## API Integration Details
### Claude API: PDF Document Analysis
- Content block type is `"document"` (not `"image"`)
- Source type `"base64"` with `media_type: "application/pdf"`
- Max 32MB request size, max 100 pages (for 200k context models)
- Each page processed as image + extracted text (interleaved)
- BIA reports at ~258KB / ~5 pages are well within limits
- All active models support PDF processing
### CloudConvert API: Markdown to PDF
## Claude Model Pricing Reference (March 2026)
| Model | Input ($/MTok) | Output ($/MTok) | Est. Cost/Report | Best For |
|-------|---------------|-----------------|------------------|----------|
| claude-sonnet-4 | $3.00 | $15.00 | ~$0.05-0.08 | **Recommended.** Strong multimodal + good Italian prose. |
| claude-haiku-4.5 | $1.00 | $5.00 | ~$0.02-0.03 | Budget option if Sonnet quality proves unnecessary. |
| claude-haiku-3.5 | $0.80 | $4.00 | ~$0.01-0.03 | Cheapest. May struggle with chart interpretation. |
## Sources
- [Anthropic PDF Support Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support) -- verified, HIGH confidence
- [Anthropic TypeScript SDK (GitHub)](https://github.com/anthropics/anthropic-sdk-typescript) -- v0.80.0, verified
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- verified, March 2026
- [CloudConvert Node.js SDK (GitHub)](https://github.com/cloudconvert/cloudconvert-node) -- v3.0.0, verified
- [CloudConvert API v2 Convert](https://cloudconvert.com/api/v2/convert) -- verified
- [CloudConvert MD to PDF](https://cloudconvert.com/md-to-pdf) -- verified
- [Commander.js (npm)](https://www.npmjs.com/package/commander) -- verified
- [tsx (official site)](https://tsx.is/) -- verified
- [tsup (official site)](https://tsup.egoist.dev/) -- verified
- [unpdf (GitHub)](https://github.com/unjs/unpdf) -- verified
- [Zod documentation](https://zod.dev/api) -- verified
- [Node.js native .env support](https://nodejs.org/en/learn/typescript/run) -- verified for Node 22 LTS
- [ora (GitHub)](https://github.com/sindresorhus/ora) -- verified, ESM-only v8
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
