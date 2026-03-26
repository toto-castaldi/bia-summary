# Feature Research

**Domain:** BIA report summarization CLI tool (single-professional, Akern BIA 101 Biva Pro / Bodygram)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features the professional assumes exist. Missing these = tool is unusable for its core purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single PDF input via CLI argument | Core workflow: run tool, pass a report, get output. Without this there is no tool. | LOW | `bia-summary ./report.pdf` -- standard CLI arg parsing with positional file path |
| PDF sent to Claude API (multimodal) | The whole point is AI-powered extraction. Claude reads the PDF visually (pages as images + extracted text), no local parsing needed. | LOW | Base64-encode the PDF, send as `document` content block. Bodygram reports are 6 pages (~258KB), well within the 32MB / 100-page API limits. |
| Body composition data extraction | Claude must extract: demographics (name, age, sex, weight, height, exam date), composition (FFM, FM, BCM, SMM, ASMM in kg and %), metabolism (BMR, TDEE), phase angle (PhA). These are the salient metrics the client cares about. | LOW | Delegated entirely to Claude via the prompt. The Bodygram report format is consistent (always 6 pages: Biavector, quantitative analysis, glossary, indices, hydration/nutrition, database). |
| Configurable prompt from external text file | The professional tweaks what Claude says without touching code. Prompt evolves over time (e.g., add new metrics, change tone, adjust thresholds for "in forma" vs "ottima definizione"). | LOW | Read a `.txt` or `.md` file from a known path (e.g., `./prompt.txt` or config-specified). Fail clearly if missing. |
| Markdown output from Claude | Claude generates structured markdown (headings, tables, lists) that becomes the client PDF. This intermediate format is inspectable and debuggable. | LOW | Already natural Claude output. Specify markdown format in the prompt. |
| Markdown-to-PDF conversion via CloudConvert API | Produces the clean, client-facing PDF. User already has a CloudConvert subscription. | MEDIUM | Create a job: import/raw (markdown string) -> convert (md to pdf) -> export/url. Download result. Requires API key management and job polling/waiting. |
| Output PDF saved to disk with sensible name | The professional needs to find the output easily and send it to the client. | LOW | Default pattern: `YYYY_MM_DD - [Client Name] - Riassunto BIA.pdf` derived from data extracted by Claude. Save in current directory or configurable output directory. |
| API key configuration (Claude + CloudConvert) | Two API keys are required. Must be configured once, used repeatedly. | LOW | Environment variables (`ANTHROPIC_API_KEY`, `CLOUDCONVERT_API_KEY`) and/or a `.env` file. Node.js v20.6+ supports `--env-file` natively, no dotenv dependency needed. |
| Clear error messages | When Claude API fails, CloudConvert fails, PDF is unreadable, or config is missing, the user must know what went wrong and what to do. | LOW | Catch each failure point separately. Print human-readable messages, not stack traces. |
| Exit codes | Standard CLI behavior: 0 on success, non-zero on failure. Scripts and muscle memory depend on this. | LOW | Exit 1 for config errors, exit 2 for API errors, exit 0 on success. |

### Differentiators (Competitive Advantage)

Features that elevate the tool from "it works" to "it's a pleasure to use." Not required for v1, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Goal table with sex-specific thresholds | The prompt includes a table showing "in forma" and "ottima definizione" targets per metric, differentiated by sex. This is the core value-add over just reading numbers: the client sees where they stand relative to goals. | LOW | Entirely prompt-driven. The professional encodes thresholds in the prompt file. Claude generates the comparison table. |
| Explicit BMI and hydration exclusion | Per the professional's workflow, BMI and hydration details are deliberately excluded from the client summary (BMI is misleading for body composition; hydration is too technical). The prompt enforces this. | LOW | Prompt instruction: "Do not include BMI or hydration analysis." |
| Nutritional guidance in output | The summary includes basic nutritional recommendations based on the composition data (e.g., protein intake suggestions based on BCM, caloric targets based on TDEE). | LOW | Prompt-driven. Claude generates suggestions based on extracted TDEE/BMR. Professional can tune in prompt. |
| Dry-run / preview mode | Show the markdown output in terminal before converting to PDF. Lets the professional verify Claude's interpretation before spending a CloudConvert credit. | LOW | `--dry-run` flag: print markdown to stdout, skip PDF conversion. Nearly free to implement, high debugging value. |
| Verbose/debug mode | Print what's happening at each step: reading PDF, sending to Claude, waiting for response, sending to CloudConvert, downloading result. Helpful for diagnosing issues. | LOW | `--verbose` flag. Log to stderr so stdout remains clean for piping. |
| Custom output path | Override the default output filename or directory. | LOW | `--output` or `-o` flag. |
| Retry with exponential backoff for API calls | Both Claude and CloudConvert can return transient errors (429 rate limit, 500/502/503 server errors). Automatic retry prevents the professional from having to re-run manually. | MEDIUM | Retry on 429 (respect `retry-after` header), 500, 502, 503. Max 3 retries. Exponential backoff with jitter. Do not retry 400-level client errors (except 429). |
| Prompt template variables | Allow the prompt file to contain placeholders (e.g., `{{CLIENT_NAME}}`, `{{EXAM_DATE}}`) that get populated from the report data or CLI args. Enables personalized summaries without editing the prompt each time. | MEDIUM | Requires a two-pass approach: first extract minimal data from Claude (or parse filename), then inject into prompt template before the main summarization call. Adds complexity but reduces prompt editing friction. |
| Italian language output by default | The professional and clients are Italian. The output should be in Italian by default, set via prompt instruction. | LOW | Prompt instruction: "Rispondi in italiano." Already implied by the example prompt. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but actively hurt this project. Do NOT build these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Local PDF parsing (pdf-parse, pdfjs) | "Don't depend on Claude for reading" | Bodygram reports contain charts (Biavector, Biagram, Hydragram, Nutrigram, percentile curves) that are images, not extractable text. Local parsing would miss visual data and graphs. Claude's multimodal vision handles the entire page layout. Adding a local parser creates two code paths to maintain for zero benefit. | Send the entire PDF to Claude multimodal API. It reads text AND images. |
| Web UI or Electron wrapper | "Easier for non-technical users" | The user is a single professional who runs this from terminal. A GUI adds massive complexity (framework, state management, packaging) for one user who does not need it. PROJECT.md explicitly scopes this out. | CLI with clear `--help` output. Add shell alias for convenience. |
| Multi-user / authentication | "What if you have colleagues?" | Single professional tool. Auth adds config complexity, user management, and zero value. Explicitly out of scope per PROJECT.md. | If colleagues need it, they clone the repo and use their own API keys. |
| Report archival / database | "Track client progress over time" | Adds persistence layer (SQLite/JSON), migration concerns, query interface, and backup requirements. The professional generates and sends the PDF -- that's the archive. If history is needed, the file system is the database. | Save PDFs to a folder structure: `./reports/[client-name]/YYYY-MM-DD.pdf`. Let the filesystem be the archive. |
| Batch processing (glob, folder scan) | "Process all today's reports at once" | Premature optimization. The professional runs 1-5 exams per day. Each report should be reviewed individually before sending to the client. Batch mode skips that review step and risks sending incorrect summaries. Also multiplies API costs if something goes wrong. | Process one at a time. Add batch later ONLY if validated need emerges. |
| Drag-and-drop input | "Drag PDF onto tool" | This is a GUI concept. In terminal, drag-and-drop pastes the file path as text, which already works with the CLI argument. No special handling needed. | Standard CLI argument: `bia-summary "/path/to/report.pdf"` -- drag-and-drop to terminal already works. |
| Fancy PDF design (infographics, logos, colors) | "Make it look professional with charts" | CloudConvert markdown-to-PDF produces clean, readable output with headings and tables. Custom design requires switching to HTML-to-PDF (Puppeteer or custom templates), which massively increases complexity. The professional explicitly wants "semplice e pulito" (simple and clean). | Clean markdown with proper heading hierarchy, tables, and bold text. This is sufficient and aligned with stated requirements. |
| Structured JSON extraction mode | "Parse the data into a structured format for other tools" | This tool's output is a PDF for clients, not a data pipeline. JSON extraction adds a second output format to maintain and test, with no current consumer. | If structured data is ever needed, add a `--json` flag later. For now, markdown-to-PDF only. |
| Model selection flag | "Let user choose Claude model" | Adds configuration surface area. For summarization of a 6-page PDF, Claude Sonnet is fast, cheap, and more than capable. The professional should not have to think about model choice. | Hardcode the model (e.g., `claude-sonnet-4-20250514`). If a model upgrade is needed, change the code. |

## Feature Dependencies

```
[PDF Input (CLI arg)]
    └──requires──> [Claude API Call (multimodal)]
                       └──requires──> [API Key Configuration]
                       └──produces──> [Markdown Output]
                                          └──requires──> [CloudConvert API Call]
                                          │                   └──requires──> [API Key Configuration]
                                          │                   └──produces──> [PDF Output to Disk]
                                          └──enhances──> [Dry-Run Mode (skip CloudConvert)]

[Configurable Prompt File]
    └──enhances──> [Claude API Call]

[Retry Logic]
    └──enhances──> [Claude API Call]
    └──enhances──> [CloudConvert API Call]

[Verbose Mode]
    └──enhances──> [All steps: read, call, convert, save]

[Output Naming]
    └──requires──> [Data extracted by Claude (client name, date)]
```

### Dependency Notes

- **Claude API Call requires API Key Configuration:** Without `ANTHROPIC_API_KEY`, nothing works. This must be the first thing configured.
- **CloudConvert API Call requires Markdown Output:** The markdown from Claude is the input to CloudConvert. These are sequential, not parallel.
- **Dry-Run Mode enhances Markdown Output:** It short-circuits the pipeline after Claude's response, skipping CloudConvert. This means the core pipeline must be structured with a clear separation point between "get markdown" and "convert to PDF."
- **Output Naming requires Claude extraction:** The client name and exam date come from Claude's analysis of the PDF. The output filename depends on data that only exists after the API call completes.
- **Configurable Prompt File enhances Claude API Call:** The prompt file is loaded before the API call and injected as the user message alongside the PDF document.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept works end-to-end.

- [ ] CLI accepts a single PDF file path as argument -- core input mechanism
- [ ] PDF is base64-encoded and sent to Claude API as a multimodal document block -- core extraction
- [ ] Prompt loaded from an external text file (default: `./prompt.txt`) -- core configurability
- [ ] Claude returns markdown with body composition summary, goal table, metabolism data, nutritional guidance -- core output
- [ ] Markdown sent to CloudConvert API for PDF conversion -- core delivery format
- [ ] Output PDF saved with auto-generated name (`YYYY_MM_DD - [Name] - Riassunto BIA.pdf`) -- core file output
- [ ] API keys read from environment variables or `.env` file -- core configuration
- [ ] Clear error messages for: missing file, missing API keys, API failures, CloudConvert failures -- core reliability
- [ ] `--dry-run` flag to preview markdown without converting to PDF -- essential debugging

### Add After Validation (v1.x)

Features to add once the core pipeline is proven reliable.

- [ ] `--verbose` flag for step-by-step logging -- add when debugging API issues in production use
- [ ] `--output` / `-o` flag for custom output path -- add when default naming proves insufficient
- [ ] Retry logic with exponential backoff for transient API errors -- add after encountering first real-world API failure
- [ ] Prompt template variables (`{{CLIENT_NAME}}`, `{{EXAM_DATE}}`) -- add when the professional finds themselves editing the prompt file per-client

### Future Consideration (v2+)

Features to defer until the tool is well-established.

- [ ] Batch processing (multiple PDFs) -- defer until proven need; current volume is 1-5 exams/day
- [ ] `--json` flag for structured data output -- defer until a data consumer exists
- [ ] Comparison mode (compare current vs. previous exam) -- defer; requires archival which is out of scope
- [ ] Custom PDF template (HTML-to-PDF instead of markdown-to-PDF) -- defer unless "semplice e pulito" proves insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PDF input via CLI arg | HIGH | LOW | P1 |
| Claude multimodal API call | HIGH | LOW | P1 |
| Configurable prompt file | HIGH | LOW | P1 |
| CloudConvert markdown-to-PDF | HIGH | MEDIUM | P1 |
| Auto-generated output filename | MEDIUM | LOW | P1 |
| API key configuration (.env) | HIGH | LOW | P1 |
| Error messages (human-readable) | HIGH | LOW | P1 |
| `--dry-run` mode | HIGH | LOW | P1 |
| Exit codes | MEDIUM | LOW | P1 |
| `--verbose` mode | MEDIUM | LOW | P2 |
| `--output` flag | LOW | LOW | P2 |
| Retry with backoff | MEDIUM | MEDIUM | P2 |
| Prompt template variables | MEDIUM | MEDIUM | P3 |
| Batch processing | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the end-to-end pipeline plus essential debugging
- P2: Should have, add when real-world usage reveals the need
- P3: Nice to have, future consideration after core is stable

## Competitor Feature Analysis

This is a niche single-user tool, not a commercial product. "Competitors" are alternative workflows the professional could use instead.

| Feature | Manual Workflow (read report, type summary) | ChatGPT Web UI (upload PDF, copy-paste) | This Tool (CLI) |
|---------|---------------------------------------------|------------------------------------------|-----------------|
| Time per report | 15-20 min | 5-10 min (upload, prompt, copy, format) | <1 min (one command) |
| Consistency | Varies by fatigue/attention | Varies by prompt wording each time | Identical prompt every time |
| Output format | Word/Pages manual formatting | Copy-paste into Word, reformat | Clean PDF, ready to send |
| Prompt iteration | N/A | Re-type or recall from memory | Edit file once, all future reports use it |
| Cost per report | Professional's time | ChatGPT subscription ($20/mo) | ~$0.01-0.05 Claude API + CloudConvert credit |
| Automation potential | None | None (manual web UI) | Full: script, cron, integration |
| Data privacy | Stays local | Uploaded to OpenAI | Sent to Anthropic API (no training use) |

The tool's competitive advantage over the manual workflow is speed and consistency. Over ChatGPT web UI, it's automation, consistent prompting, and direct PDF output without copy-paste formatting.

## Sources

- [Claude API PDF Support Documentation](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- PDF limits (32MB, 100 pages), base64 encoding, multimodal processing, prompt caching, batch API
- [Claude API Rate Limits](https://platform.claude.com/docs/en/api/rate-limits) -- RPM/ITPM/OTPM limits, retry-after header, exponential backoff guidance
- [Claude API Errors](https://platform.claude.com/docs/en/api/errors) -- Error codes, retry guidance (retry 429/500/502/503, do not retry other 4xx)
- [CloudConvert Node.js SDK](https://github.com/cloudconvert/cloudconvert-node) -- Official SDK, job creation, task chaining (import -> convert -> export)
- [CloudConvert MD to PDF](https://cloudconvert.com/md-to-pdf) -- Markdown to PDF conversion support confirmation
- [Akern BIA 101 BIVA PRO](https://www.akern.com/en/products-and-solutions/biompedence-analyzers/new-bia-101-biva-pro/) -- Device specifications
- [Bodygram Plus Software Manual](https://www.akern.com/wp-content/uploads/2020/12/BODYGRAM-_basic_rev.6_2019_EN.pdf) -- Report format, available metrics, export capabilities
- [Node.js native .env support](https://typescript.tv/best-practices/you-dont-need-dotenv-anymore/) -- Node.js v20.6+ `--env-file` flag eliminates dotenv dependency

---
*Feature research for: BIA report summarization CLI tool*
*Researched: 2026-03-26*
