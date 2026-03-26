# Technology Stack

**Project:** BIA Summary
**Researched:** 2026-03-26

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

**Model recommendation: `claude-sonnet-4-20250514`**

Rationale: BIA reports are 3-8 pages with tables, charts (Biavector, Biagram, Hydragram, Nutrigram), and structured data. This needs visual understanding, not just text extraction. Sonnet 4 at $3/$15 per MTok provides strong multimodal reasoning at reasonable cost. Haiku 3.5 ($0.80/$4) would be 3-4x cheaper but may miss nuance in charts and produce less refined Italian-language output. For a professional tool processing ~5-20 reports/month, the cost difference is negligible ($0.05-0.15 per report with Sonnet vs $0.02-0.05 with Haiku).

**Cost estimate per report:** A 5-page BIA PDF uses ~7,500-15,000 input tokens (text + images). With a ~2,000-token prompt and ~2,000-token response: ~$0.05-0.08 per report with Sonnet 4.

### PDF Conversion (Output)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| cloudconvert | ^3.0.0 | Markdown-to-PDF via API | Official Node.js SDK for CloudConvert API v2. User already has active subscription. Supports `import/upload` + `convert` (md -> pdf) + `export/url` job pipeline. TypeScript declarations included. Avoids local PDF generation dependencies (wkhtmltopdf, puppeteer, etc.). | HIGH |

**CloudConvert workflow:**
1. `import/upload` -- upload markdown string as `.md` file
2. `convert` -- md to pdf (engine: default)
3. `export/url` -- get download URL for generated PDF

### PDF Reading (Fallback)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| unpdf | ^0.12.x | PDF text extraction fallback | Modern TypeScript-first alternative to unmaintained pdf-parse. ESM native, async/await API. Only needed if Claude's multimodal PDF processing proves insufficient for some report variants. **Install only if needed.** | MEDIUM |

**Why not pdf-parse:** Unmaintained (last publish 2021), CJS-only, wraps ancient pdf.js. unpdf is the modern replacement from the UnJS ecosystem.

**Why this is a fallback, not primary:** The entire architecture relies on Claude seeing the PDF visually (charts, layout, tables). Text extraction alone would lose the Biavector, Biagram, Hydragram, and Nutrigram chart data. Only use if some specific PDF variant has issues with multimodal processing.

### Environment & Configuration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js `--env-file` | Native (>=20.6) | Load `.env` file | Zero dependencies. Built into Node.js. `node --env-file=.env` loads vars into `process.env` before app starts. | HIGH |
| zod | ^3.x | Env validation + config schema | Validates API keys exist at startup (fail fast). Type-infers config object from schema. Also useful for validating Claude API response structure. | HIGH |

**Config approach:**
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

**Note on ESM:** ora v8 and chalk v5+ are ESM-only. The project MUST use `"type": "module"` in `package.json` and `"module": "Node16"` / `"moduleResolution": "Node16"` in `tsconfig.json`. This is the correct direction for 2026 -- do not fight it by pinning CJS versions.

**Why not chalk:** ora already provides colored output for spinners. For the few other colored messages (success, error), use `ora.succeed()` / `ora.fail()` or Node.js built-in `util.styleText()` (available since Node 21.7 / 22.x). Avoid adding chalk as a separate dependency for a handful of colored lines.

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

```json
{
  "name": "bia-summary",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "bia-summary": "./dist/cli.js"
  },
  "scripts": {
    "dev": "tsx --env-file=.env src/cli.ts",
    "build": "tsup src/cli.ts --format esm --dts --clean",
    "typecheck": "tsc --noEmit",
    "start": "node --env-file=.env dist/cli.js"
  }
}
```

### tsconfig.json (key fields)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## Installation

```bash
# Core dependencies
npm install @anthropic-ai/sdk cloudconvert commander zod ora

# Dev dependencies
npm install -D typescript tsx tsup @types/node
```

**Total production dependencies: 5** (anthropic SDK, cloudconvert, commander, zod, ora)
**Total dev dependencies: 4** (typescript, tsx, tsup, @types/node)

This is intentionally lean. A personal CLI tool should not have 30+ dependencies.

## File Structure

```
bia-summary/
  src/
    cli.ts              # Entry point: commander setup, arg parsing
    config.ts           # Zod schema for env vars, config loading
    analyze.ts          # Claude API: send PDF, get markdown
    convert.ts          # CloudConvert: markdown -> PDF
    types.ts            # Shared TypeScript types
  prompt.md             # Default Claude prompt template
  .env                  # API keys (gitignored)
  .env.example          # Template for .env
  package.json
  tsconfig.json
  tsup.config.ts        # Optional, can use CLI flags instead
```

## API Integration Details

### Claude API: PDF Document Analysis

```typescript
// How to send a BIA PDF to Claude for analysis
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const pdfBuffer = await readFile("report.pdf");
const pdfBase64 = pdfBuffer.toString("base64");

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: promptTemplate, // loaded from prompt.md
        },
      ],
    },
  ],
});
```

**Key details from official docs (verified):**
- Content block type is `"document"` (not `"image"`)
- Source type `"base64"` with `media_type: "application/pdf"`
- Max 32MB request size, max 100 pages (for 200k context models)
- Each page processed as image + extracted text (interleaved)
- BIA reports at ~258KB / ~5 pages are well within limits
- All active models support PDF processing

### CloudConvert API: Markdown to PDF

```typescript
// How to convert markdown to PDF via CloudConvert
import CloudConvert from "cloudconvert";
import { Readable } from "node:stream";

const cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY!);

const job = await cloudConvert.jobs.create({
  tasks: {
    "upload-md": {
      operation: "import/upload",
    },
    "convert-to-pdf": {
      operation: "convert",
      input: ["upload-md"],
      output_format: "pdf",
    },
    "export-pdf": {
      operation: "export/url",
      input: ["convert-to-pdf"],
    },
  },
});

// Upload the markdown content as a file
const uploadTask = job.tasks.find((t) => t.name === "upload-md")!;
const stream = Readable.from([markdownContent]);
await cloudConvert.tasks.upload(uploadTask, stream, "summary.md");

// Wait for completion and get download URL
const completed = await cloudConvert.jobs.wait(job.id);
const exportTask = completed.tasks.find((t) => t.name === "export-pdf")!;
const downloadUrl = exportTask.result?.files?.[0]?.url;
```

## Claude Model Pricing Reference (March 2026)

| Model | Input ($/MTok) | Output ($/MTok) | Est. Cost/Report | Best For |
|-------|---------------|-----------------|------------------|----------|
| claude-sonnet-4 | $3.00 | $15.00 | ~$0.05-0.08 | **Recommended.** Strong multimodal + good Italian prose. |
| claude-haiku-4.5 | $1.00 | $5.00 | ~$0.02-0.03 | Budget option if Sonnet quality proves unnecessary. |
| claude-haiku-3.5 | $0.80 | $4.00 | ~$0.01-0.03 | Cheapest. May struggle with chart interpretation. |

At 10-20 reports/month with Sonnet 4, total monthly Claude API cost: ~$0.50-1.60. Negligible.

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
