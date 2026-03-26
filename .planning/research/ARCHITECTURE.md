# Architecture Research

**Domain:** CLI tool -- PDF analysis via LLM + PDF generation
**Researched:** 2026-03-26
**Confidence:** HIGH

## System Overview

```
                          BIA Summary CLI
                          ===============

 ┌──────────────────────────────────────────────────────────┐
 │                      CLI Layer                           │
 │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
 │  │  Arg     │  │   Config     │  │   Orchestrator   │   │
 │  │  Parser  │──│   Loader     │──│   (pipeline)     │   │
 │  └──────────┘  └──────────────┘  └────────┬─────────┘   │
 ├───────────────────────────────────────────┼──────────────┤
 │                   Service Layer           │              │
 │  ┌──────────────┐   ┌──────────────────┐  │              │
 │  │  Claude      │   │  CloudConvert    │  │              │
 │  │  Client      │   │  Client          │  │              │
 │  └──────┬───────┘   └────────┬─────────┘  │              │
 ├─────────┼────────────────────┼────────────┘──────────────┤
 │         │   External APIs    │                           │
 │    ┌────▼────┐         ┌─────▼──────┐                    │
 │    │ Claude  │         │CloudConvert│                    │
 │    │ API     │         │ API v2     │                    │
 │    └─────────┘         └────────────┘                    │
 └──────────────────────────────────────────────────────────┘

 Data flow:
 PDF file  ──►  base64  ──►  Claude API  ──►  markdown
 markdown  ──►  CloudConvert API  ──►  output PDF
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Arg Parser | Parse CLI arguments (input PDF path, optional output path) | `commander` with typed options |
| Config Loader | Read prompt template from text file, load API keys from env | `fs.readFile` + `dotenv` |
| Orchestrator | Run the pipeline: validate input, call Claude, call CloudConvert, save output | Single async function composing services |
| Claude Client | Encode PDF to base64, send to Claude API with prompt, return markdown response | `@anthropic-ai/sdk` with `document` content blocks |
| CloudConvert Client | Upload markdown, convert to PDF, download result | `cloudconvert` Node SDK with job-based tasks |

## Recommended Project Structure

```
bia-summary/
├── src/
│   ├── cli.ts              # Entry point: arg parsing, orchestration call
│   ├── pipeline.ts         # Orchestrator: ties the steps together
│   ├── clients/
│   │   ├── claude.ts       # Claude API interaction
│   │   └── cloudconvert.ts # CloudConvert API interaction
│   ├── config.ts           # Load prompt template, resolve paths
│   └── types.ts            # Shared TypeScript interfaces
├── prompts/
│   └── default.txt         # Default prompt template
├── .env.example            # Template for required env vars
├── package.json
└── tsconfig.json
```

### Structure Rationale

- **src/clients/**: Each external API gets its own module. They are independently testable and have no knowledge of each other. If either API changes, only one file changes.
- **src/pipeline.ts**: Separate from CLI parsing because the pipeline logic is the core value. This makes it testable without simulating CLI invocations.
- **src/cli.ts**: Thin entry point. Parses args, calls pipeline, handles top-level errors with user-friendly messages.
- **prompts/**: Prompt template lives outside `src/` because it is user-editable content, not code. The path is configurable but defaults to `prompts/default.txt`.
- **Flat structure**: This is a small, focused tool. No need for deeply nested folders. Five source files total in the initial implementation.

## Architectural Patterns

### Pattern 1: Linear Pipeline

**What:** The tool follows a strictly linear data pipeline: read input, transform with Claude, transform with CloudConvert, write output. No branching, no parallelism, no state.

**When to use:** When the application is a sequential transformation of data with clear input and output at each stage.

**Trade-offs:** Simple to reason about and debug. Not suitable if steps needed to run in parallel or conditionally, but that is not the case here.

**Example:**
```typescript
// pipeline.ts
export async function runPipeline(options: PipelineOptions): Promise<void> {
  // Step 1: Validate input exists
  const pdfBuffer = await fs.readFile(options.inputPath);

  // Step 2: Load prompt template
  const promptTemplate = await fs.readFile(options.promptPath, "utf-8");

  // Step 3: Send to Claude, get markdown
  const markdown = await analyzePdf(pdfBuffer, promptTemplate);

  // Step 4: Convert markdown to PDF via CloudConvert
  const outputBuffer = await convertToPdf(markdown);

  // Step 5: Write output
  await fs.writeFile(options.outputPath, outputBuffer);
}
```

### Pattern 2: Thin Client Wrappers

**What:** Each external API client is a thin wrapper that encapsulates the SDK setup and exposes a single, purpose-specific function. The wrapper hides SDK details (base64 encoding, job/task orchestration) from the pipeline.

**When to use:** When integrating with external APIs whose SDKs have verbose configuration. Keeps the pipeline readable and testable.

**Trade-offs:** Adds a file per API, but these files are small (30-60 lines) and make mocking/testing straightforward.

**Example:**
```typescript
// clients/claude.ts
import Anthropic from "@anthropic-ai/sdk";

export async function analyzePdf(
  pdfBuffer: Buffer,
  prompt: string
): Promise<string> {
  const client = new Anthropic();  // reads ANTHROPIC_API_KEY from env
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
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text response");
  }
  return textBlock.text;
}
```

### Pattern 3: Fail-Fast with Clear Errors

**What:** Validate everything upfront before making API calls. Check that the input file exists, is a PDF, is under the size limit, that API keys are set, and that the prompt file exists. Fail with a clear, actionable error message.

**When to use:** CLI tools where the user is a human who needs to understand what went wrong.

**Trade-offs:** Adds validation code upfront, but saves money (no wasted API calls) and frustration (no cryptic API errors).

## Data Flow

### Primary Pipeline Flow

```
User invokes CLI
    │
    ▼
[cli.ts] Parse arguments: inputPdf, --output, --prompt
    │
    ▼
[pipeline.ts] Validate inputs (file exists, env vars set)
    │
    ▼
[config.ts] Read prompt template from file
    │
    ▼
[clients/claude.ts]
    │  1. Read PDF file into Buffer
    │  2. Base64-encode the Buffer
    │  3. POST to Claude Messages API:
    │     - model: claude-sonnet-4-20250514
    │     - content: [{ type: "document", source: base64 }, { type: "text", text: prompt }]
    │  4. Extract markdown text from response
    │
    ▼
markdown string (in memory)
    │
    ▼
[clients/cloudconvert.ts]
    │  1. Create job: import/upload + convert(md→pdf) + export/url
    │  2. Write markdown to temp .md file, upload via SDK
    │  3. Wait for job completion
    │  4. Download result PDF from export URL
    │
    ▼
[pipeline.ts] Write output PDF to disk
    │
    ▼
Print success message with output path
```

### Key Data Transformations

1. **PDF file on disk** --> `Buffer` (fs.readFile)
2. **Buffer** --> `base64 string` (Buffer.toString('base64'))
3. **base64 string + prompt** --> **markdown string** (Claude API)
4. **markdown string** --> **temp .md file** (fs.writeFile to temp dir)
5. **temp .md file** --> **PDF binary** (CloudConvert API)
6. **PDF binary** --> **output .pdf file** (fs.writeFile or stream pipe)

### CloudConvert Job Structure

```json
{
  "tasks": {
    "import-markdown": {
      "operation": "import/upload"
    },
    "convert-to-pdf": {
      "operation": "convert",
      "input": "import-markdown",
      "input_format": "md",
      "output_format": "pdf"
    },
    "export-result": {
      "operation": "export/url",
      "input": "convert-to-pdf"
    }
  }
}
```

After creating the job, upload the markdown content as a `.md` file via the SDK's `tasks.upload()` method, then `jobs.wait()` for completion, then download from the export URL.

### Claude API Request Structure

```typescript
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: [
      {
        type: "document",          // NOT "image" -- PDF-specific type
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: "<base64-encoded-pdf>"
        }
      },
      {
        type: "text",
        text: "<prompt-from-template-file>"
      }
    ]
  }]
}
```

Key details verified from official docs:
- Content block type is `"document"` (not `"image"`)
- Media type is `"application/pdf"`
- Source type is `"base64"` for local files
- Max request size: 32 MB, max pages: 100 (for 200k context models)
- The sample BIA PDF is 264 KB / 6 pages -- well within limits
- Each page costs ~1,500-3,000 text tokens + image tokens
- Place PDF before text in the content array for optimal performance

## Scaling Considerations

This is a single-user CLI tool. Scaling is not a concern.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user, occasional use | Current design is perfect. No changes needed. |
| Batch processing (many PDFs) | Add a loop or glob pattern to process multiple files. No architecture change. |
| Multiple prompt templates | Already supported: `--prompt` flag selects different templates. |

### Cost Considerations (More Relevant Than Scaling)

- A 6-page PDF costs ~9,000-18,000 input tokens (text) + image tokens per page
- Claude Sonnet is the right model: good quality, reasonable cost for this use case
- CloudConvert: 25 conversion minutes/day on free tier; paid plans from EUR 8/month
- No caching needed -- each report is unique and processed once

## Anti-Patterns

### Anti-Pattern 1: Parsing the PDF Yourself

**What people do:** Use `pdf-parse`, `pdfjs-dist`, or similar libraries to extract text/tables from the BIA PDF, then send structured text to Claude.

**Why it is wrong:** BIA reports from Bodygram contain charts (Biavector, Biagram, Hydragram, Nutrigram) and complex tables. Text extraction loses visual information. Claude's multimodal PDF support reads both text and visual elements natively.

**Do this instead:** Send the entire PDF as a base64 `document` content block. Let Claude handle extraction. This is the explicit design decision in PROJECT.md.

### Anti-Pattern 2: Generating PDF Locally

**What people do:** Use `puppeteer`, `wkhtmltopdf`, or `markdown-pdf` to convert markdown to PDF locally.

**Why it is wrong:** These tools have heavy system dependencies (headless Chrome, wkhtmltopdf binaries), produce inconsistent results across platforms, and require significant configuration for clean output. The project already has a CloudConvert subscription.

**Do this instead:** Use CloudConvert's markdown-to-PDF conversion via their API. Zero local dependencies, consistent output, already paid for.

### Anti-Pattern 3: Over-Engineering the CLI

**What people do:** Build plugin systems, sub-commands, interactive modes, config file hierarchies for what is a single-purpose tool.

**Why it is wrong:** This tool does one thing: PDF in, summary PDF out. Adding complexity does not add value for a single-user tool.

**Do this instead:** One command, a few flags (`--output`, `--prompt`), clear error messages. Five source files, not fifty.

### Anti-Pattern 4: Hardcoding the Prompt

**What people do:** Embed the Claude prompt directly in the source code.

**Why it is wrong:** The prompt will need frequent iteration (adjusting what data to extract, table format, tone). Editing code to change a prompt is friction that discourages experimentation.

**Do this instead:** Load the prompt from a text file (already a project requirement). The user edits `prompts/default.txt` without touching code.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API (Anthropic) | `@anthropic-ai/sdk` -- Messages API with `document` content block, base64 source | API key via `ANTHROPIC_API_KEY` env var. SDK reads it automatically. Model: `claude-sonnet-4-20250514` for cost/quality balance. |
| CloudConvert API v2 | `cloudconvert` npm package -- Job with import/upload + convert + export/url tasks | API key via `CLOUDCONVERT_API_KEY` env var. Job-based workflow: create job, upload file, wait, download result. Markdown-to-PDF uses `input_format: "md"`, `output_format: "pdf"`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| cli.ts --> pipeline.ts | Direct function call with typed options object | CLI layer constructs a `PipelineOptions` object and passes it. Pipeline never reads `process.argv`. |
| pipeline.ts --> clients/* | Direct async function calls | Pipeline calls `analyzePdf()` and `convertToPdf()`. Each returns a clear type (string for markdown, Buffer for PDF). |
| config.ts --> pipeline.ts | Config returns resolved paths and loaded content | Config handles file reading and path resolution. Pipeline receives ready-to-use values. |

## Build Order (Dependencies)

The components have clear build-order dependencies:

```
Phase 1: types.ts + config.ts
   │      (No external dependencies. Define interfaces, load files.)
   ▼
Phase 2: clients/claude.ts
   │      (Depends on types. Can be tested independently with a real PDF.)
   ▼
Phase 3: clients/cloudconvert.ts
   │      (Depends on types. Can be tested independently with sample markdown.)
   ▼
Phase 4: pipeline.ts
   │      (Depends on both clients + config. Wires everything together.)
   ▼
Phase 5: cli.ts
          (Depends on pipeline. Adds arg parsing, error handling, UX.)
```

**Why this order:**
1. **Types and config first** because every other module imports from them.
2. **Claude client before CloudConvert** because it produces the markdown that CloudConvert consumes. You can manually verify Claude's output quality before building the conversion step.
3. **Pipeline before CLI** because the pipeline is the core logic. You can test it programmatically before wiring up the CLI interface.
4. **CLI last** because it is the thinnest layer and depends on everything else.

**Practical implication:** Phases 2 and 3 (the two API clients) are independent of each other and could be built in parallel, but building Claude first lets you validate the core value proposition (does Claude produce good summaries?) before investing in PDF generation.

## Sources

- [Anthropic PDF Support Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support) -- Official API docs for document content blocks, base64 encoding, limits (32MB/100 pages), TypeScript examples. HIGH confidence.
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) -- Official SDK repository. HIGH confidence.
- [CloudConvert Node.js SDK](https://github.com/cloudconvert/cloudconvert-node) -- Official SDK with job-based workflow examples (import/upload, convert, export/url, download). HIGH confidence.
- [CloudConvert API v2 Convert Endpoint](https://cloudconvert.com/api/v2/convert) -- Official REST API docs for conversion tasks. HIGH confidence.
- [CloudConvert MD to PDF](https://cloudconvert.com/md-to-pdf) -- Confirms markdown-to-PDF conversion is a supported conversion path. HIGH confidence.

---
*Architecture research for: BIA Summary CLI tool*
*Researched: 2026-03-26*
