# Phase 2: PDF Output Pipeline - Research

**Researched:** 2026-03-26
**Domain:** CloudConvert API integration (markdown/HTML to PDF), filename generation, CLI option handling
**Confidence:** HIGH

## Summary

This phase adds the PDF output pipeline to the existing BIA summary tool. The core task is: take the markdown string produced by Claude in Phase 1, convert it to a PDF via the CloudConvert API, and save it to disk with an auto-generated filename. A `--output` / `-o` flag is also added to allow custom output paths.

The CloudConvert Node.js SDK (v3.0.0) supports a job-based workflow with three task types: `import/raw` (embed markdown directly in the request), `convert` (md-to-pdf or html-to-pdf), and `export/url` (get a download URL). The **critical architectural decision** is which conversion path to use: direct md-to-pdf (Pandoc engine) or md-to-html-to-pdf (Chrome engine). The Pandoc engine has limited styling control for tables; the Chrome engine gives full CSS control. Per D-01 in CONTEXT.md, implementation should try md-to-pdf first and switch to the two-step path if table rendering is poor.

The filename generation requires parsing the input PDF filename (pattern: `DD_MM_YYYY - Client Name - Report di stampa _ Bodygram.pdf`) and reformatting the date to `YYYY_MM_DD`. A regex-based parser with a fallback to extract name/date from the Claude markdown response is the recommended approach.

**Primary recommendation:** Use `import/raw` to embed markdown content directly in the CloudConvert job (no stream upload needed), start with md-to-pdf (Pandoc engine), and structure the code so switching to html-to-pdf (Chrome engine) requires changing only the convert task parameters.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Claude's Discretion -- try md-to-pdf first via CloudConvert. If table rendering is poor, switch to md-to-html-to-pdf (two-step). Implementation decides based on output quality.
- **D-02:** Parse the input PDF filename first (pattern: `DD_MM_YYYY - Client Name - Report di stampa _ Bodygram.pdf`). If parsing fails (non-standard filename), fall back to extracting name/date from Claude's markdown response.
- **D-03:** Output filename format: `YYYY_MM_DD - [Client Name] - Riassunto BIA.pdf` (note: date is reformatted to YYYY_MM_DD)
- **D-04:** Page size: A4 (European standard)
- **D-05:** Font: CloudConvert default (system font)
- **D-06:** Claude's Discretion on margins and other formatting options -- whatever looks clean and readable
- **D-07:** On CloudConvert failure: save the markdown as a `.md` file (same auto-generated name but .md extension) AND show an error explaining PDF conversion failed. User gets the content either way.

### Claude's Discretion
- md-to-pdf vs md-to-html-to-pdf conversion strategy (test and decide)
- Specific CloudConvert API parameters for margins, header/footer
- How to extract name/date from Claude's markdown response as fallback

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-04 | User can use `--output` / `-o` flag to specify custom output path | Commander `.option('-o, --output <path>')` pattern; integration into `PipelineOptions.outputPath` |
| PDF-01 | Tool converts Claude's markdown output to PDF via CloudConvert API | CloudConvert SDK v3.0.0 job workflow: `import/raw` + `convert` (md-to-pdf, Pandoc engine) + `export/url`; download via `fetch` |
| PDF-02 | Output PDF is saved with auto-generated filename: `YYYY_MM_DD - [Client Name] - Riassunto BIA.pdf` | Regex parsing of input filename pattern `DD_MM_YYYY - Client Name - Report di stampa _ Bodygram.pdf`; fallback extraction from markdown |
</phase_requirements>

## Standard Stack

### Core (New for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cloudconvert | 3.0.0 | Markdown-to-PDF via CloudConvert API | Official Node.js SDK for CloudConvert API v2. User has active subscription. Job-based task model with `import/raw`, `convert`, `export/url`. TypeScript declarations included. |

### Already Installed (Phase 1)

| Library | Version | Purpose | Relevant to Phase 2 |
|---------|---------|---------|---------------------|
| commander | ^14.0.3 | CLI argument parsing | Add `--output` / `-o` option |
| ora | ^9.3.0 | Terminal spinner | Show progress during CloudConvert conversion |
| zod | ^4.3.6 | Validation | Validate output path if provided |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `import/raw` (inline markdown) | `import/upload` (stream upload) | `import/raw` is simpler -- no stream handling, no file size calculation. Only unsuitable for files >10MB, which markdown summaries never reach. |
| Pandoc engine (md-to-pdf) | Chrome engine (html-to-pdf) | Pandoc has limited table styling. Chrome gives full CSS control but requires generating HTML first. Try Pandoc first per D-01. |
| `https.get` for download | `fetch` (native Node 22) | `fetch` is cleaner, returns `Response` with `arrayBuffer()`. No need for `https` module. |

**Installation:**
```bash
npm install cloudconvert
```

**Version verification:** `cloudconvert` 3.0.0 is the current latest (verified 2026-03-26 via `npm view`).

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)

```
src/
  clients/
    claude.ts          # [existing] Claude API client
    cloudconvert.ts    # [NEW] CloudConvert API client
  cli.ts               # [MODIFY] Add --output/-o flag
  pipeline.ts          # [MODIFY] Add PDF conversion step, conditional on dryRun
  types.ts             # [MODIFY] Add outputPath to PipelineOptions
  filename.ts          # [NEW] Input filename parsing + output filename generation
```

### Pattern 1: import/raw for Inline Content Upload

**What:** Use `import/raw` instead of `import/upload` to embed the markdown string directly in the job creation request. This eliminates the need for stream handling, file size calculation, or multi-step upload.

**When to use:** When the content to convert is a string under 10MB (markdown summaries are typically 2-8KB).

**Example:**
```typescript
// Source: CloudConvert API v2 import docs (https://cloudconvert.com/api/v2/import)
const job = await cloudConvert.jobs.create({
  tasks: {
    "import-md": {
      operation: "import/raw",
      file: markdownContent,       // string directly embedded
      filename: "summary.md",
    },
    "convert-to-pdf": {
      operation: "convert",
      input: ["import-md"],
      output_format: "pdf",
      // engine: "pandoc" (default for md-to-pdf)
    },
    "export-pdf": {
      operation: "export/url",
      input: ["convert-to-pdf"],
    },
  },
});
```

**Why better than import/upload:** No need to create a Readable stream, no need to calculate file size, no separate upload step. Single API call creates the job and provides the content.

### Pattern 2: Conversion Path Abstraction

**What:** Structure the CloudConvert client so the conversion path (md-to-pdf vs html-to-pdf) is a configuration choice, not a code change.

**When to use:** When D-01 says "try md-to-pdf first, switch to html-to-pdf if quality is poor."

**Example:**
```typescript
interface ConvertOptions {
  inputFormat: "md" | "html";
  outputFormat: "pdf";
  pageSize?: "a4" | "letter";
  // margins, etc.
}

async function convertToPdf(
  content: string,
  options: ConvertOptions,
): Promise<Buffer> {
  const filename = options.inputFormat === "md" ? "summary.md" : "summary.html";

  const job = await cloudConvert.jobs.create({
    tasks: {
      "import-content": {
        operation: "import/raw",
        file: content,
        filename,
      },
      "convert": {
        operation: "convert",
        input: ["import-content"],
        output_format: options.outputFormat,
        // engine auto-selected based on input format:
        // md -> pandoc, html -> chrome
      },
      "export": {
        operation: "export/url",
        input: ["convert"],
      },
    },
  });

  // ... wait and download
}
```

### Pattern 3: Fallback on Failure (D-07)

**What:** If CloudConvert fails, save the markdown as `.md` file using the same auto-generated filename (but with .md extension). Show an error to stderr but exit 0 since the user still gets their content.

**When to use:** Always -- the user should never lose their analysis just because PDF conversion failed.

**Example:**
```typescript
try {
  const pdfBuffer = await convertToPdf(markdown, convertOptions);
  await writeFile(outputPath, pdfBuffer);
  spinner.succeed(`PDF saved: ${outputPath}`);
} catch (error) {
  // Fallback: save markdown (D-07)
  const mdPath = outputPath.replace(/\.pdf$/i, ".md");
  await writeFile(mdPath, markdown, "utf-8");
  spinner.fail(
    `PDF conversion failed: ${error instanceof Error ? error.message : String(error)}\n` +
    `Markdown saved as fallback: ${mdPath}`
  );
}
```

### Pattern 4: Pipeline Branching on dryRun

**What:** The pipeline currently always returns `AnalysisResult`. In Phase 2, when `dryRun` is false, the pipeline should also convert to PDF and save to disk. When `dryRun` is true, behavior stays the same (markdown to stdout).

**Example:**
```typescript
// In pipeline.ts
export async function runPipeline(options: PipelineOptions): Promise<AnalysisResult> {
  // ... existing steps 1-4 (load prompt, analyze PDF, validate) ...

  if (!options.dryRun) {
    // Phase 2: Convert to PDF and save
    spinner.text = "Converting to PDF via CloudConvert...";
    const outputPath = options.outputPath ?? generateOutputPath(options.inputPath);
    await convertAndSave(result.markdown, outputPath, spinner);
  }

  return result;
}
```

### Anti-Patterns to Avoid

- **Writing markdown to temp file then uploading:** Use `import/raw` to embed content directly. No temp files needed.
- **Polling job status manually:** Use `cloudConvert.jobs.wait(job.id)` which handles polling internally.
- **Hardcoding conversion engine:** Let CloudConvert auto-select the engine based on input/output format. Only specify engine explicitly if you need to override.
- **Using `https.get` for file download:** Node 22 has native `fetch`. Use `fetch(url)` then `response.arrayBuffer()` for cleaner code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown to PDF | Custom Pandoc/LaTeX pipeline | CloudConvert API | Local PDF generation requires heavy dependencies (Chromium, LaTeX). CloudConvert handles it server-side. |
| Stream upload handling | Manual multipart upload | `import/raw` operation | Markdown content is small (<10KB). Embedding in the request body is simpler and eliminates stream size issues. |
| Job status polling | Custom polling loop | `cloudConvert.jobs.wait()` | SDK method handles polling interval and timeout internally. |
| Date parsing from Italian format | Manual string splitting | Regex with named capture groups | The input format is consistent (`DD_MM_YYYY`). A single regex handles it cleanly. |

**Key insight:** The CloudConvert SDK does most of the heavy lifting. The custom code is: (1) create job, (2) wait, (3) download result. Everything else is filename logic and error handling.

## Common Pitfalls

### Pitfall 1: Stream Size Required for import/upload

**What goes wrong:** When using `import/upload` with `Readable.from(string)`, the SDK cannot auto-detect stream length and the upload fails silently or throws.
**Why it happens:** The SDK calls `fs.stat` on file-based streams but custom streams have no file backing.
**How to avoid:** Use `import/raw` instead of `import/upload` for string content. This eliminates the stream entirely.
**Warning signs:** Upload hangs, timeout errors, zero-byte files.

### Pitfall 2: CloudConvert Markdown Table Rendering (Pandoc Engine)

**What goes wrong:** The Pandoc engine converts markdown to PDF via LaTeX. Tables may render with minimal styling, poor column widths, or broken alignment for Italian text with accented characters.
**Why it happens:** Pandoc's default LaTeX template has conservative table styling. Markdown table syntax has no column width control.
**How to avoid:** Test with real BIA summary content early. If tables look poor, switch to html-to-pdf path (Chrome engine) which gives full CSS control. Per D-01, this decision is at implementation time.
**Warning signs:** Tables without borders, disproportionate column widths, accented characters (a, e, i, o, u) rendering incorrectly.

### Pitfall 3: Export URL Expiration

**What goes wrong:** The download URL from `export/url` tasks has a time-limited validity. If there is a delay between job completion and file download, the URL may expire.
**Why it happens:** CloudConvert generates temporary signed URLs for security. They expire after a period (typically minutes).
**How to avoid:** Download the file immediately after `jobs.wait()` completes. Do not store the URL for later use.
**Warning signs:** HTTP 403 or 404 when downloading the result.

### Pitfall 4: Filename Parsing Assumes Consistent Input Format

**What goes wrong:** The regex for parsing `DD_MM_YYYY - Client Name - Report di stampa _ Bodygram.pdf` fails on PDFs with different naming conventions.
**Why it happens:** Not all BIA reports may follow the Bodygram naming convention. The user might rename files.
**How to avoid:** Implement the fallback path (D-02): if filename parsing fails, extract client name and date from the Claude markdown response. The markdown typically starts with the client's name and exam date.
**Warning signs:** Output filename shows "Unknown" or uses current date instead of exam date.

### Pitfall 5: Forgetting to Pass CloudConvert API Key

**What goes wrong:** The CloudConvert client is instantiated without the API key, or the key is read from the wrong env var.
**Why it happens:** Phase 1 validates `CLOUDCONVERT_API_KEY` via `validateEnv()` but the key is stored in `AppConfig.cloudConvertKey`. The CloudConvert SDK constructor requires it as a string parameter (unlike the Anthropic SDK which reads from env automatically).
**How to avoid:** Pass `config.cloudConvertKey` explicitly when creating the CloudConvert client. Do not rely on the SDK reading env vars -- it does not.
**Warning signs:** 401 Unauthorized errors from CloudConvert API.

## Code Examples

### Complete CloudConvert md-to-pdf Flow

```typescript
// Source: CloudConvert API docs + Node SDK README
import CloudConvert from "cloudconvert";
import { writeFile } from "node:fs/promises";

export async function convertMarkdownToPdf(
  markdown: string,
  apiKey: string,
): Promise<Buffer> {
  const cloudConvert = new CloudConvert(apiKey);

  // Step 1: Create job with import/raw + convert + export
  const job = await cloudConvert.jobs.create({
    tasks: {
      "import-md": {
        operation: "import/raw",
        file: markdown,
        filename: "summary.md",
      },
      "convert-to-pdf": {
        operation: "convert",
        input: ["import-md"],
        output_format: "pdf",
      },
      "export-pdf": {
        operation: "export/url",
        input: ["convert-to-pdf"],
      },
    },
  });

  // Step 2: Wait for completion
  const completed = await cloudConvert.jobs.wait(job.id);

  // Step 3: Get download URL
  const exportUrls = cloudConvert.jobs.getExportUrls(completed);
  if (!exportUrls.length || !exportUrls[0].url) {
    throw new Error("CloudConvert job completed but no export URL available");
  }

  // Step 4: Download the PDF
  const response = await fetch(exportUrls[0].url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

### Filename Parsing and Generation

```typescript
// Parse input Bodygram filename: "DD_MM_YYYY - Client Name - Report di stampa _ Bodygram.pdf"
// Generate output filename: "YYYY_MM_DD - Client Name - Riassunto BIA.pdf"

interface ParsedFilename {
  clientName: string;
  date: string; // YYYY_MM_DD format
}

export function parseInputFilename(filename: string): ParsedFilename | null {
  // Pattern: DD_MM_YYYY - Name - Report di stampa _ Bodygram.pdf
  const match = filename.match(
    /^(\d{2})_(\d{2})_(\d{4})\s*-\s*(.+?)\s*-\s*Report di stampa/i
  );

  if (!match) return null;

  const [, day, month, year, clientName] = match;
  return {
    clientName: clientName.trim(),
    date: `${year}_${month}_${day}`,
  };
}

export function generateOutputFilename(parsed: ParsedFilename): string {
  return `${parsed.date} - ${parsed.clientName} - Riassunto BIA.pdf`;
}

export function generateOutputPath(
  inputPath: string,
  customOutputPath?: string,
): string {
  if (customOutputPath) return path.resolve(customOutputPath);

  const inputDir = path.dirname(inputPath);
  const inputBasename = path.basename(inputPath);
  const parsed = parseInputFilename(inputBasename);

  if (parsed) {
    return path.join(inputDir, generateOutputFilename(parsed));
  }

  // Fallback: use current date and generic name
  const now = new Date();
  const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
  return path.join(inputDir, `${dateStr} - Riassunto BIA.pdf`);
}
```

### Markdown Fallback Extraction (D-02 fallback)

```typescript
// Extract client name and date from Claude's markdown output
// Markdown typically starts with "# Riassunto BIA" followed by client info

export function extractFromMarkdown(markdown: string): ParsedFilename | null {
  // Look for name pattern: "Nome: Angelina Jolie" or "**Nome:** Angelina Jolie"
  const nameMatch = markdown.match(/\*?\*?Nome\*?\*?:\s*(.+)/i);
  // Look for date pattern: "Data esame: 26/03/2026" or similar
  const dateMatch = markdown.match(
    /\*?\*?Data\s*(?:esame|visita)?\*?\*?:\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i
  );

  if (!nameMatch) return null;

  const clientName = nameMatch[1].trim();

  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return {
      clientName,
      date: `${year}_${month.padStart(2, "0")}_${day.padStart(2, "0")}`,
    };
  }

  // Use current date if no date found
  const now = new Date();
  const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
  return { clientName, date: dateStr };
}
```

### CLI --output Flag Addition

```typescript
// Source: Commander.js docs
// In cli.ts, add the --output option to the existing command

program
  .option("-o, --output <path>", "Custom output path for the generated PDF")
  .action(async (pdfFile: string, options: { dryRun: boolean; output?: string }) => {
    // ... existing validation ...

    const result = await runPipeline({
      inputPath,
      dryRun: options.dryRun,
      outputPath: options.output ? path.resolve(options.output) : undefined,
    });

    // In dry-run mode, output markdown to stdout (existing behavior)
    if (options.dryRun) {
      console.error(/* metadata */);
      process.stdout.write(result.markdown);
    }
    // In non-dry-run mode, PDF was already saved by the pipeline
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import/upload` with stream | `import/raw` for string content | Always available | Eliminates stream handling complexity for small files |
| `https.get` + pipe for download | `fetch` + `arrayBuffer()` | Node 22 (native fetch) | Cleaner async/await pattern, no callback nesting |
| Manual job polling | `cloudConvert.jobs.wait()` | CloudConvert SDK v3 | SDK handles polling interval internally |

## CloudConvert Engine Comparison

| Property | md-to-pdf (Pandoc) | html-to-pdf (Chrome) |
|----------|-------------------|---------------------|
| Engine | Pandoc | Chrome (headless) |
| Table styling | Limited (LaTeX default) | Full CSS control |
| Page size | Via Pandoc geometry options | Via Chrome print options |
| Margins | Via Pandoc geometry | Via Chrome margin options |
| Font control | Limited | Full CSS fonts |
| Cost | 1 credit | 1 credit |
| Complexity | Simple (one step) | Requires HTML generation step |
| Best for | Simple text-heavy documents | Documents with styled tables |

**Recommendation:** Start with Pandoc (md-to-pdf). If the BIA summary tables look poor, switch to Chrome (html-to-pdf). The code is structured so this switch changes only the import filename extension and potentially wraps the markdown in an HTML template with CSS.

## Open Questions

1. **Pandoc engine table quality with Italian BIA data**
   - What we know: Pandoc converts markdown tables to LaTeX tables. The styling is minimal but functional.
   - What's unclear: Whether accented Italian characters render correctly, and whether column widths are acceptable for BIA parameter names like "Massa Muscolo-Scheletrica (SMM)".
   - Recommendation: Test with real data in the first implementation task. If quality is unacceptable, switch to html-to-pdf path.

2. **CloudConvert conversion options for Pandoc engine**
   - What we know: The API accepts engine-specific options in the convert task, but the exact parameter names for Pandoc (page geometry, margins) are not fully documented in public docs.
   - What's unclear: Whether `page_size: "a4"` or Pandoc-specific geometry variables are supported.
   - Recommendation: Start without explicit options (Pandoc defaults to A4 for European locales). If sizing is wrong, query `GET /v2/convert/formats?filter[input_format]=md&filter[output_format]=pdf` with an API key to get the full option schema.

3. **Markdown fallback extraction reliability**
   - What we know: Claude's output follows the prompt structure, which includes "Nome:" and "Data esame:" fields.
   - What's unclear: Whether the exact field labels are consistent across all runs.
   - Recommendation: Use multiple regex patterns with fallbacks. The primary path (input filename parsing) is reliable; the markdown fallback is a safety net.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | >= 22 LTS | -- |
| cloudconvert npm | PDF conversion | Not installed | 3.0.0 (latest) | `npm install cloudconvert` |
| CLOUDCONVERT_API_KEY | API auth | Validated at startup | -- | -- |
| Native fetch | PDF download | Yes (Node 22) | Built-in | -- |

**Missing dependencies with no fallback:**
- `cloudconvert` npm package needs to be installed

**Missing dependencies with fallback:**
- None

## Project Constraints (from CLAUDE.md)

- **Tech stack:** TypeScript, Node.js (enforced)
- **Module system:** ESM (`"type": "module"` in package.json, NodeNext module resolution)
- **TypeScript version:** 6.0.2 with `strict: true`, no `esModuleInterop`
- **CLI framework:** Commander (already in use)
- **Progress indicator:** ora to stderr
- **Error pattern:** `console.error()` for errors, `process.exit(1)` for failures
- **GSD workflow:** Do not make direct repo edits outside a GSD workflow

## Sources

### Primary (HIGH confidence)
- [CloudConvert Node.js SDK (GitHub)](https://github.com/cloudconvert/cloudconvert-node) -- v3.0.0, job creation, import/raw, import/upload, jobs.wait(), getExportUrls(), download pattern
- [CloudConvert API v2 Import](https://cloudconvert.com/api/v2/import) -- import/raw operation: `file` (string content), `filename` (with extension), <10MB limit
- [CloudConvert API v2 Convert](https://cloudconvert.com/api/v2/convert) -- convert operation parameters, engine auto-selection
- [CloudConvert Formats API](https://api.cloudconvert.com/v2/convert/formats) -- md-to-pdf uses Pandoc engine, html-to-pdf uses Chrome engine, 1 credit each
- [CloudConvert Node SDK Issue #108](https://github.com/cloudconvert/cloudconvert-node/issues/108) -- Readable.from pattern for custom streams, no fileSize needed

### Secondary (MEDIUM confidence)
- [CloudConvert HTML-to-PDF API](https://cloudconvert.com/apis/html-to-pdf) -- Chrome-based engine, page size / margin / zoom customization confirmed but specific parameter names not extracted
- [Pandoc User's Guide](https://pandoc.org/MANUAL.html) -- Pandoc geometry options for page size and margins via LaTeX variables

### Tertiary (LOW confidence)
- CloudConvert Pandoc engine specific option names (page_size, margins) -- not verified against full API schema. The formats API endpoint with authentication would provide the definitive list.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- cloudconvert v3.0.0 verified, import/raw pattern verified from official docs
- Architecture: HIGH -- job-based workflow well-documented, import/raw eliminates stream complexity
- Pitfalls: HIGH -- table rendering concern documented in project PITFALLS.md, stream upload pitfall verified from GitHub issues
- Filename parsing: HIGH -- sample file `26_03_2026 - Angelina Jolie - Report di stampa _ Bodygram.pdf` confirms the pattern

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (30 days -- CloudConvert SDK is stable)
