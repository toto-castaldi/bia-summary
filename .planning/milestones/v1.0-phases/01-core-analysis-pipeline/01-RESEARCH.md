# Phase 1: Core Analysis Pipeline - Research

**Researched:** 2026-03-26
**Domain:** CLI tool -- PDF multimodal analysis via Claude API, structured Italian-language markdown output
**Confidence:** HIGH

## Summary

Phase 1 delivers the core value proposition: a CLI command `bia-summary <file.pdf> --dry-run` that sends a Bodygram BIA report PDF to Claude's multimodal API and prints a structured Italian-language markdown summary to stdout. This phase does NOT include PDF output (CloudConvert) -- that is Phase 2. The scope is: project scaffolding, CLI argument parsing, environment validation, prompt loading from the PDF's directory, Claude API call with the `document` content block, response validation (truncation check, math sanity), and formatted markdown output.

The project-level stack research (STACK.md) was conducted earlier today but several package versions have moved to new major versions since the research baseline. This phase-level research corrects those versions: **TypeScript 6.0.2** (not 5.7), **Zod 4.3.6** (not 3.x), **Commander 14.0.3** (not 13.x), **ora 9.3.0** (not 8.x). TypeScript 6.0 has notable breaking changes affecting the tsconfig.json template from STACK.md -- `esModuleInterop` can no longer be set explicitly (always enabled), `types` must explicitly include `["node"]`, and `moduleResolution` should be `"NodeNext"` (not `"Node16"` which still works but `NodeNext` is the recommended path forward).

**Primary recommendation:** Build the project in strict bottom-up order: scaffolding with corrected TypeScript 6.0 config, then types/config (Zod 4 env validation), then Claude client (document block + stop_reason check), then pipeline orchestrator, then CLI entry point. The prompt file lives next to the input PDF (user decision D-01), not in a `prompts/` directory.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Prompt file is looked for in the same directory as the input PDF (e.g., if input is `/reports/client.pdf`, look for `/reports/prompt.txt`)
- **D-02:** No `--prompt` flag -- single fixed location strategy, keep it simple
- **D-03:** If prompt file not found, error and exit with clear message explaining where the tool looked. No built-in fallback prompt.
- **D-04:** `--dry-run` prints markdown to stdout with extracted metadata (client name, date) shown as a header before the content
- **D-05:** Output is pipeable: only markdown goes to stdout, any status/progress messages go to stderr
- **D-06:** API keys read from both `.env` file (working directory) and environment variables. Env vars override `.env` values.
- **D-07:** Both `ANTHROPIC_API_KEY` and `CLOUDCONVERT_API_KEY` are validated at startup. Missing keys cause immediate exit with clear error message listing which keys are missing.
- **D-08:** In Phase 1 (dry-run only, no PDF conversion), `CLOUDCONVERT_API_KEY` validation still happens at startup for consistency, even though it won't be used until Phase 2.
- **D-09:** Math validation on Claude's output: verify FM + FFM approximately equals body weight, TBW approximately equals ECW + ICW. Warn the user (to stderr) if mismatches detected but still output the result.
- **D-10:** Set `max_tokens` to 4096+. Check `stop_reason` in Claude's response -- if truncated, warn the user that the summary may be incomplete.

### Claude's Discretion
- Claude chooses the specific model (research recommends Sonnet 4 for cost/speed balance)
- Claude decides the exact `max_tokens` value (minimum 4096)
- Claude decides markdown structure details beyond what the prompt specifies

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-01 | User can run `bia-summary <file.pdf>` to process a single BIA report | Commander 14 argument parsing; single positional argument for PDF path |
| CLI-02 | User can use `--dry-run` flag to preview markdown output without PDF conversion | Commander boolean option; in Phase 1 all runs are effectively dry-run (no CloudConvert) but the flag must exist |
| CLI-06 | Tool exits with code 0 on success, non-zero on failure | `process.exit()` with appropriate codes; Commander handles parse errors |
| AI-01 | Tool sends the entire PDF to Claude API as a multimodal document block (base64) | Anthropic SDK `document` content block with `type: "base64"`, `media_type: "application/pdf"` -- verified against official docs |
| AI-02 | Tool loads the prompt from an external text file (default: `./prompt.txt`) | D-01 overrides default: prompt file is in the same directory as the input PDF, named `prompt.txt` |
| AI-03 | Claude extracts body composition data: demographics, composition (FFM, FM in kg/%), metabolism (BMR, TDEE) | Prompt engineering: enumerate every parameter by name; math validation (D-09) checks FM+FFM~=weight |
| AI-04 | Claude generates a goal table with sex-specific thresholds | Prompt must hard-code thresholds per sex (Pitfall 6); Claude reads sex from the report |
| AI-05 | Claude provides nutritional guidance based on extracted metabolism data | Prompt includes nutritional guidance section referencing BMR/TDEE values |
| AI-06 | Claude output excludes BMI and hydration data as instructed by the prompt | Prompt must contain explicit exclusion instructions |
| AI-07 | Output is in Italian language | Prompt is in Italian; include explicit instruction "Rispondi SEMPRE in italiano" |
| PDF-03 | API keys (ANTHROPIC_API_KEY, CLOUDCONVERT_API_KEY) read from env vars or `.env` file | Zod 4 startup validation; Node.js `--env-file=.env` for loading; D-06/D-07/D-08 define exact behavior |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: TypeScript, Node.js (enforced)
- **External APIs**: Claude API (Anthropic) for analysis, CloudConvert API for PDF generation
- **Input**: PDF generated by Bodygram/Akern
- **Output**: Clean, readable PDF for the end client
- **GSD Workflow**: All code changes must go through GSD commands

## Standard Stack

### Core (Verified Versions -- March 2026)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >= 22 LTS (22.20.0 available) | Runtime | Native `--env-file` support. Required by Anthropic SDK. Available on target machine. |
| TypeScript | 6.0.2 | Language | Current stable. Breaking changes from 5.x addressed in config below. |
| @anthropic-ai/sdk | 0.80.0 | Claude API client | Official SDK. Native `document` content block for PDF. Type-safe. |
| commander | 14.0.3 | CLI argument parsing | Zero deps. Node 20+ required (satisfied). `allowExcessArguments` now false by default (good for us). |
| zod | 4.3.6 | Env validation + config schema | Validates API keys at startup. Import from `"zod"` (Zod 4 is now the default export). |
| tsx | 4.21.0 | TS runner (dev) | Zero-config TypeScript execution for development. |
| tsup | 8.5.1 | Build/bundle | esbuild-powered. ESM output with shebang injection. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ora | 9.3.0 | Terminal spinner | Progress feedback during Claude API call (10-30 seconds). Output to stderr only (D-05). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander 14 | yargs | Larger API, more deps. Overkill for single-command CLI. |
| zod 4 | zod 3 (via `zod@3`) | Still available but no longer default. Use Zod 4 for new projects. |
| TypeScript 6.0 | TypeScript 5.8 | Still works but missing improvements. 6.0 is current stable. |
| ora | No spinner | Poor UX -- 10-30 seconds of silence while Claude processes. |

**Installation:**
```bash
# Core dependencies
npm install @anthropic-ai/sdk commander zod ora

# Dev dependencies
npm install -D typescript tsx tsup @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
bia-summary/
├── src/
│   ├── cli.ts              # Entry point: commander setup, arg parsing, top-level error handling
│   ├── pipeline.ts         # Orchestrator: validate -> load prompt -> analyze -> output
│   ├── clients/
│   │   └── claude.ts       # Claude API: base64 encode PDF, send document block, extract markdown
│   ├── config.ts           # Zod schema for env vars, prompt file resolution
│   └── types.ts            # Shared TypeScript interfaces
├── .env.example            # Template: ANTHROPIC_API_KEY=, CLOUDCONVERT_API_KEY=
├── .gitignore              # Must include .env from first commit
├── package.json
└── tsconfig.json
```

**Key structural decisions for Phase 1:**
- No `prompts/` directory -- D-01 says the prompt file lives next to the input PDF
- No `clients/cloudconvert.ts` -- Phase 2 concern
- No `--prompt` flag -- D-02 says single fixed location strategy
- `pipeline.ts` is separate from `cli.ts` so core logic is testable without CLI simulation

### Pattern 1: Linear Pipeline with Dry-Run Gate

**What:** The Phase 1 pipeline is: validate inputs -> load prompt from PDF directory -> send PDF to Claude -> validate response -> output markdown. In Phase 1, the output is always stdout (dry-run behavior). The `--dry-run` flag must exist on the CLI for forward compatibility, but all paths lead to stdout in this phase.

**When to use:** When the tool is a sequential transformation with a clear gate point (dry-run vs. full processing).

**Example:**
```typescript
// pipeline.ts
export async function runPipeline(options: PipelineOptions): Promise<string> {
  // Step 1: Load and validate prompt from PDF's directory
  const promptPath = path.join(path.dirname(options.inputPath), "prompt.txt");
  const prompt = await loadPrompt(promptPath);  // throws if not found (D-03)

  // Step 2: Read PDF file
  const pdfBuffer = await fs.readFile(options.inputPath);

  // Step 3: Send to Claude, get markdown
  const result = await analyzePdf(pdfBuffer, prompt);

  // Step 4: Validate response (D-09, D-10)
  validateResponse(result);  // warns to stderr if math mismatches or truncation

  // Step 5: Return markdown (CLI handles output to stdout)
  return result.markdown;
}
```

### Pattern 2: Fail-Fast Startup Validation

**What:** Before any work, validate all preconditions: both API keys present (D-07/D-08), input PDF exists and is readable, prompt file exists in PDF's directory (D-01/D-03). Exit immediately with a clear, actionable error message listing all problems found.

**Example:**
```typescript
// config.ts
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  CLOUDCONVERT_API_KEY: z.string().min(1, "CLOUDCONVERT_API_KEY is required"),
});

export function validateEnv(): { anthropicKey: string; cloudConvertKey: string } {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => i.path.join("."));
    console.error(`Missing API keys: ${missing.join(", ")}`);
    console.error("Set them in .env file or as environment variables.");
    process.exit(1);
  }
  return {
    anthropicKey: result.data.ANTHROPIC_API_KEY,
    cloudConvertKey: result.data.CLOUDCONVERT_API_KEY,
  };
}
```

### Pattern 3: Stderr for Everything Except the Result

**What:** Per D-05, only markdown goes to stdout. All progress messages (ora spinner), warnings (math mismatch from D-09, truncation from D-10), and errors go to stderr. This makes the output pipeable: `bia-summary report.pdf --dry-run | pbcopy`.

**Important:** ora writes to stderr by default. Explicitly verify this with `ora({ stream: process.stderr })`.

### Anti-Patterns to Avoid

- **Prompt in a `prompts/` directory:** User decision D-01 places it next to the input PDF. Do not create a prompts folder.
- **`--prompt` CLI flag:** User decision D-02 explicitly forbids this.
- **Sending PDF as `image` blocks:** Must use `type: "document"` with `media_type: "application/pdf"` to get text+image dual extraction.
- **Skipping CLOUDCONVERT_API_KEY validation:** D-08 requires it even in Phase 1.
- **Printing status to stdout:** Breaks pipeability (D-05). Use stderr exclusively for non-markdown output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom argv parsing | commander 14 | Edge cases: quoted args, option ordering, help text generation |
| Environment validation | Manual `if (!process.env.KEY)` checks | Zod 4 schema with `.safeParse()` | Type inference, batch validation, structured error messages |
| PDF-to-base64 encoding | Custom encoding logic | `Buffer.from(await fs.readFile(path)).toString("base64")` | Node.js built-in, zero deps |
| API key loading from .env | Custom file parsing | Node.js native `--env-file=.env` | Built into runtime since Node 20.6 |
| Terminal spinner | Custom animation loop | ora 9 (to stderr) | Handles terminal capabilities, signal interrupts, stream detection |

**Key insight:** This is a 5-file tool. Every hand-rolled solution is a maintenance burden disproportionate to the project's size. Use libraries for anything that has edge cases.

## Common Pitfalls

### Pitfall 1: TypeScript 6.0 tsconfig.json Misconfiguration

**What goes wrong:** The project-level STACK.md contains a tsconfig template based on TypeScript 5.7. TypeScript 6.0 (the current version) has breaking changes: `esModuleInterop` can no longer be set to `false` (always enabled), `types` defaults to `[]` (must explicitly include `"node"`), and `moduleResolution: "classic"` is removed.

**Why it happens:** The STACK.md research was done before verifying the actual `npm view typescript version` output, which returns 6.0.2.

**How to avoid:** Use the corrected tsconfig.json from the Code Examples section below. Key changes: add `"types": ["node"]`, use `"moduleResolution": "NodeNext"`, use `"module": "NodeNext"`, remove explicit `"esModuleInterop": true` (now always enabled).

**Warning signs:** Flood of "Cannot find name 'Buffer'", "Cannot find name 'process'" errors from TypeScript.

### Pitfall 2: Zod 4 API Differences

**What goes wrong:** Code examples in STACK.md use Zod 3 patterns. Zod 4 (now the default `npm install zod`) has some API changes: string format validators moved to top-level functions, error customization API changed.

**Why it happens:** Zod 4 became the default export from the `zod` package. `npm install zod` now gives you v4.

**How to avoid:** For this project's use case (env validation with `.safeParse()`), the core API is identical. The `z.object()` and `z.string().min()` patterns work the same in both versions. Import from `"zod"` (not `"zod/v4"` -- that was only needed during the transition period).

**Warning signs:** Import errors if trying to use `"zod/v3"` subpath. Subtle behavior changes in `.optional()` fields with defaults.

### Pitfall 3: Prompt File Not Found -- Confusing Error

**What goes wrong:** User runs `bia-summary /path/to/report.pdf` but there is no `prompt.txt` in `/path/to/`. The tool crashes with a generic ENOENT error instead of explaining where it looked.

**Why it happens:** D-01 places the prompt next to the PDF, which is non-obvious. The user might expect a global prompt or a prompt in the working directory.

**How to avoid:** When the prompt file is not found, the error message must say: "Prompt file not found. Expected at: /path/to/prompt.txt (same directory as the input PDF). Place your prompt file there and try again."

**Warning signs:** Users repeatedly asking where to put the prompt file.

### Pitfall 4: Numerical Hallucination in Claude Output

**What goes wrong:** Claude misreads values from the dense BIA tables (e.g., 46.2 kg reported as 46.8 kg). For body composition data, even small errors are unacceptable.

**Why it happens:** Bodygram PDFs have dense tables with small text and color-coded reference bars. Claude processes each page as text + image, but vision accuracy degrades with dense layouts.

**How to avoid:**
1. Use `type: "document"` content block (not image) to get the text layer
2. Enumerate every parameter by name in the prompt
3. Add D-09 math validation: FM + FFM ~ body weight, TBW ~ ECW + ICW
4. Include `[UNCERTAIN]` flagging instruction in the prompt
5. Manually verify the first several reports against originals

**Warning signs:** FM% + FFM% does not approximate 100%. BMR values physiologically implausible for given weight/age/sex.

### Pitfall 5: Silent Response Truncation

**What goes wrong:** `max_tokens` set too low, Claude's response is cut mid-table. The `stop_reason` is `"max_tokens"` but nobody checks.

**How to avoid:** Set `max_tokens: 8192`. Always check `response.stop_reason`. If `"max_tokens"`, warn to stderr per D-10 but still output what was received.

### Pitfall 6: Ora Spinner Interferes with Stdout

**What goes wrong:** ora defaults to stdout. If used carelessly, spinner output mixes with the markdown result, breaking pipeability.

**How to avoid:** Initialize ora with `{ stream: process.stderr }`. Verify that `ora.succeed()` and `ora.fail()` also write to stderr.

## Code Examples

### Corrected tsconfig.json for TypeScript 6.0

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Changes from STACK.md template:**
- `"module"`: `"NodeNext"` (was `"Node16"`)
- `"moduleResolution"`: `"NodeNext"` (was `"Node16"`)
- Added `"types": ["node"]` (TS 6.0 defaults to empty array)
- Removed `"esModuleInterop": true` (always enabled in TS 6.0, cannot be set)

### Corrected package.json Key Fields

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

### Claude API: Send PDF as Document Block

```typescript
// Source: https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

const client = new Anthropic();  // reads ANTHROPIC_API_KEY from process.env

const pdfBuffer = await readFile(inputPath);
const pdfBase64 = pdfBuffer.toString("base64");

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8192,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",   // NOT "image" -- PDF-specific type
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: promptContent,  // loaded from prompt.txt next to the PDF
        },
      ],
    },
  ],
});

// CRITICAL: Check stop_reason (D-10)
if (response.stop_reason === "max_tokens") {
  console.error("WARNING: Response was truncated. Summary may be incomplete.");
}

// Extract text content
const textBlock = response.content.find((block) => block.type === "text");
if (!textBlock || textBlock.type !== "text") {
  throw new Error("Claude returned no text response");
}
const markdown = textBlock.text;
```

**Verified from official docs (2026-03-26):**
- Content block type: `"document"` (not `"image"`)
- Source type: `"base64"` with `media_type: "application/pdf"`
- Max 32MB request, max 600 pages (100 for 200k context models)
- Each page: text extracted + converted to image (dual extraction)
- BIA report at ~258KB / 5 pages is well within limits
- PDF placed BEFORE text in content array (best practice from docs)

### Prompt Discovery (D-01)

```typescript
// config.ts
import { readFile, access } from "node:fs/promises";
import path from "node:path";

export async function loadPrompt(pdfPath: string): Promise<string> {
  const pdfDir = path.dirname(path.resolve(pdfPath));
  const promptPath = path.join(pdfDir, "prompt.txt");

  try {
    await access(promptPath);
  } catch {
    console.error(
      `Prompt file not found.\n` +
      `Expected at: ${promptPath}\n` +
      `Place your prompt.txt file in the same directory as the input PDF.`
    );
    process.exit(1);
  }

  return readFile(promptPath, "utf-8");
}
```

### Math Validation (D-09)

```typescript
// validators.ts
export function validateComposition(markdown: string): void {
  // Extract FM, FFM, and body weight from markdown
  // If FM + FFM deviates from body weight by more than 1 kg, warn
  // If TBW deviates from ECW + ICW by more than 0.5 kg, warn
  // Warnings go to stderr (D-05)
  // This is a best-effort check -- Claude's output format may vary
}
```

### Env Validation with Zod 4

```typescript
// config.ts
import { z } from "zod";  // Zod 4 is now the default export

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  CLOUDCONVERT_API_KEY: z.string().min(1, "CLOUDCONVERT_API_KEY is required"),  // D-08
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => i.path.join("."));
    console.error(`Missing required API keys: ${missing.join(", ")}`);
    console.error("Set them in a .env file (working directory) or as environment variables.");
    process.exit(1);
  }
  return result.data;
}
```

### Commander 14 CLI Setup

```typescript
// cli.ts
import { Command } from "commander";

const program = new Command();

program
  .name("bia-summary")
  .description("Generate a structured Italian summary from a BIA report PDF")
  .version("0.1.0")
  .argument("<pdf-file>", "Path to the BIA report PDF")
  .option("--dry-run", "Preview markdown output without PDF conversion", false)
  .action(async (pdfFile: string, options: { dryRun: boolean }) => {
    // 1. Validate environment (D-07, D-08)
    // 2. Validate PDF file exists
    // 3. Run pipeline
    // 4. Output to stdout (D-04, D-05)
  });

program.parse();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeScript 5.7 | TypeScript 6.0.2 | March 2026 | tsconfig needs `types: ["node"]`, `moduleResolution: "NodeNext"` |
| Zod 3.x | Zod 4.3.6 (default) | 2026 | `npm install zod` now gives v4. Core API compatible for our use case. |
| Commander 13.x | Commander 14.0.3 | 2026 | Requires Node 20+. `allowExcessArguments` now false by default. |
| ora 8.x | ora 9.3.0 | 2026 | API should be largely compatible. Verify stderr stream option. |
| `esModuleInterop: true` in tsconfig | Always enabled (TS 6.0) | March 2026 | Remove the setting from tsconfig to avoid confusion. |
| `types` auto-includes @types/* | `types` defaults to `[]` (TS 6.0) | March 2026 | Must add `"types": ["node"]` explicitly. |

**Deprecated/outdated:**
- `moduleResolution: "classic"` -- removed in TypeScript 6.0
- `target: "es5"` / `target: "es3"` -- deprecated in TypeScript 6.0
- Zod 3 as default -- `npm install zod` now gives Zod 4

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22.20.0 | -- |
| npm | Package management | Yes | 11.6.2 | -- |
| Claude API (remote) | AI analysis | Requires ANTHROPIC_API_KEY | -- | No fallback |
| CloudConvert API (remote) | PDF generation (Phase 2, but key validated in Phase 1) | Requires CLOUDCONVERT_API_KEY | -- | No fallback |

**Missing dependencies with no fallback:**
- None -- all external tools available. API keys must be provided by user.

**Missing dependencies with fallback:**
- None.

## Open Questions

1. **Exact ora 9 API changes from ora 8**
   - What we know: ora 9 is the current version. The core API (create spinner, succeed, fail) is likely stable.
   - What's unclear: Specific breaking changes between v8 and v9. The `stream` option for stderr may have changed.
   - Recommendation: Install ora 9 and verify `ora({ stream: process.stderr })` works. If not, check the changelog. LOW risk.

2. **tsup compatibility with TypeScript 6.0**
   - What we know: tsup 8.5.1 uses esbuild internally, which has its own TypeScript parser. tsup should work with TS 6.0 source code.
   - What's unclear: Whether tsup's DTS generation (`--dts`) works correctly with TypeScript 6.0 compiler API changes.
   - Recommendation: If `--dts` fails, drop it for Phase 1 (declaration files are not needed for a CLI tool). LOW risk.

3. **Math validation parsing reliability (D-09)**
   - What we know: Claude's markdown output structure will vary. Extracting FM, FFM, body weight from free-form markdown is fragile.
   - What's unclear: How reliably we can parse these values from Claude's output without mandating a specific output format.
   - Recommendation: Request Claude to include a structured data section (e.g., specific table format) that is easier to parse. Accept that validation is best-effort. If parsing fails, skip the check silently rather than crashing.

## Sources

### Primary (HIGH confidence)
- [Anthropic PDF Support Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support) -- Verified 2026-03-26. Document block type, base64 encoding, 32MB/600-page limits, dual text+image extraction, TypeScript code examples.
- [TypeScript 6.0 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) -- Breaking changes: moduleResolution classic removed, esModuleInterop always enabled, types defaults to [], es5 target deprecated.
- npm registry `npm view` -- Verified package versions: @anthropic-ai/sdk@0.80.0, commander@14.0.3, zod@4.3.6, ora@9.3.0, tsx@4.21.0, tsup@8.5.1, typescript@6.0.2.

### Secondary (MEDIUM confidence)
- [Zod 4 Migration Guide](https://zod.dev/v4/changelog) -- API changes from Zod 3 to 4. Core `z.object()` + `.safeParse()` pattern unchanged.
- [Commander.js Releases](https://github.com/tj/commander.js/releases) -- Commander 14 requires Node 20+, allowExcessArguments default changed.
- [Zod 4 Versioning](https://zod.dev/v4/versioning) -- `npm install zod` now gives Zod 4. Subpath `"zod/v4"` still works but is no longer necessary.

### Tertiary (LOW confidence)
- ora 9 API stability -- Could not find detailed breaking changes between ora 8 and 9. Assumed API-compatible for core features. Needs validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry and official release announcements
- Architecture: HIGH -- linear pipeline is canonical for this class of tool; user decisions constrain the design clearly
- Pitfalls: HIGH -- TypeScript 6.0 and Zod 4 version gaps are the main new findings; other pitfalls inherited from project-level research which was verified against official docs

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, 30-day validity)
