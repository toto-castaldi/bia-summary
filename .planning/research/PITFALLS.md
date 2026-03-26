# Pitfalls Research

**Domain:** CLI tool for BIA medical report summarization (Claude multimodal PDF analysis + CloudConvert PDF generation)
**Researched:** 2026-03-26
**Confidence:** HIGH (verified against official Anthropic docs, actual Bodygram PDF analysis, and research literature)

## Critical Pitfalls

### Pitfall 1: Numerical Value Hallucination from Visual Charts

**What goes wrong:**
Claude reads the Bodygram PDF pages as images. The report contains dense numerical data in tables (page 2: PhA, TBW, ECW, ICW, FFM, FM, BCM, SMM, ASMM, BMR, TDEE) alongside color-coded reference range bars. Claude may misread numbers from the visual rendering -- confusing 46.2 kg with 46.8 kg, or reading a percentage as 75.7% when it is 73.7%. This is catastrophic for a body composition summary because the client trusts the output numbers to match their actual exam results.

**Why it happens:**
Per Anthropic's official vision docs: "Accuracy diminishes when screenshots include small font sizes, dense tables with minimal spacing." The Bodygram PDF has exactly this problem -- the quantitative analysis table on page 2 packs parameter names, exam values, percentages, reference range bars with embedded numbers, and deviation percentages into a dense layout. Each page is converted to an image at approximately 1092x1568 resolution, which may compress the small numerical text. Research on LLM medical data extraction found hallucination rates of 1.5-38% depending on model and complexity, with numerical values being particularly vulnerable.

**How to avoid:**
1. In the prompt, explicitly instruct Claude to extract values as a structured list/table and state "If you are uncertain about any number, flag it with [UNCERTAIN]"
2. Include the specific parameter names (PhA, TBW, ECW, etc.) in the prompt so Claude knows exactly what to look for -- do not rely on Claude discovering them
3. Use the `document` content block type (not image), which extracts text alongside images -- the text layer from the Bodygram PDF will contain the actual numbers, reducing reliance on OCR from the image
4. For the first few runs, manually compare every extracted number against the original PDF to calibrate prompt accuracy
5. Consider requesting output in JSON for the numerical section, which forces Claude to commit to specific values

**Warning signs:**
- Numbers in the summary that are close-but-not-exact matches to the PDF (off by 0.1-1.0)
- Percentages that do not add up (e.g., FM% + FFM% should approximate 100%)
- BMR/TDEE values that are physiologically implausible for the given weight/age/sex
- Reference range comparisons that contradict the color coding visible in the original

**Phase to address:**
Phase 1 (Core CLI) -- this must be correct from day one. Build a validation step that at minimum checks FM + FFM approximately equals body weight, and TBW = ECW + ICW.

---

### Pitfall 2: Ignoring the PDF Text Layer (Using Only Vision)

**What goes wrong:**
Developers send the PDF and assume Claude "sees" it like a human. But Claude's PDF processing actually does two things: extracts the text layer AND converts each page to an image. If you use the `document` content block with `type: "base64"` and `media_type: "application/pdf"`, you get both. If instead you convert the PDF to images yourself and send as `image` blocks, you lose the text layer entirely and rely solely on OCR from the image -- dramatically reducing accuracy for numerical data.

**Why it happens:**
Per Anthropic's official PDF docs: "The system converts each page of the document into an image. The text from each page is extracted and provided alongside each page's image." This dual-path approach is the key advantage of using `document` blocks. Many tutorials and examples show image-based approaches because they predate native PDF support. A developer following older examples may convert PDF to PNG first, losing the crucial text extraction.

**How to avoid:**
Use the native `document` content block with `media_type: "application/pdf"` -- do NOT pre-convert to images. The Bodygram PDF is a standard digitally-generated PDF (not scanned), so its text layer is perfect. Send the entire PDF as a single `document` block.

```typescript
// CORRECT: Send PDF directly
{
  type: "document",
  source: {
    type: "base64",
    media_type: "application/pdf",
    data: pdfBase64
  }
}

// WRONG: Convert to images first
// This loses the text layer and relies on vision OCR only
```

**Warning signs:**
- Using `type: "image"` instead of `type: "document"` in the API call
- Pre-processing the PDF with a library like `pdf2pic` or `sharp` before sending to Claude
- Token count per page being much lower than expected (pure text extraction uses 1,500-3,000 tokens/page; image adds ~1,600 tokens/page)

**Phase to address:**
Phase 1 (Core CLI) -- foundational API call structure. Get this right in the first implementation.

---

### Pitfall 3: max_tokens Set Too Low, Silently Truncating the Summary

**What goes wrong:**
The `max_tokens` parameter is required in the Claude API and controls output length. If set to a common default like 1024 or even 4096, the medical summary may be silently truncated mid-sentence or mid-table. The `stop_reason` field will be `"max_tokens"` instead of `"end_turn"`, but if you do not check this, you produce an incomplete PDF that the client receives -- missing critical data like TDEE calculations or nutritional recommendations.

**Why it happens:**
Many API examples and tutorials use `max_tokens: 1024` for brevity. A comprehensive BIA summary with demographic data, body composition table, target values table, metabolic data, and nutritional recommendations can easily reach 2,000-4,000 tokens. The Bodygram PDF has 5+ pages of data, and the prompt asks for structured output including tables -- this is not a short response.

**How to avoid:**
1. Set `max_tokens` to at least 8192 (Claude Sonnet 4.6 supports up to 64K output tokens)
2. Always check `response.stop_reason` -- if it equals `"max_tokens"`, the output was truncated
3. Throw an error or retry with higher max_tokens if truncation is detected -- never silently pass truncated markdown to CloudConvert

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 8192,
  // ...
});

if (response.stop_reason === "max_tokens") {
  throw new Error("Response was truncated. Increase max_tokens or simplify the prompt.");
}
```

**Warning signs:**
- Summary ends mid-sentence or mid-table
- Missing sections that the prompt requested (e.g., nutritional recommendations absent)
- `stop_reason` in API response is `"max_tokens"` instead of `"end_turn"`

**Phase to address:**
Phase 1 (Core CLI) -- must be handled in the initial API integration.

---

### Pitfall 4: CloudConvert Markdown Table Rendering Produces Ugly or Broken PDFs

**What goes wrong:**
CloudConvert converts markdown to PDF, but markdown tables have limited styling control. The BIA summary contains tables with numerical data, reference ranges, and target values. CloudConvert's markdown-to-PDF engine may render tables with: no borders or barely visible borders, misaligned columns, text wrapping that breaks readability, no color or emphasis for values outside reference ranges, and inconsistent font sizing. The result is a PDF that looks amateur compared to the original Bodygram report.

**Why it happens:**
Standard markdown has no native styling mechanism. CloudConvert's MD-to-PDF converter parses markdown, converts to HTML, then renders to PDF. The default CSS produces functional but plain output. Tables in particular suffer because markdown table syntax cannot specify column widths, cell padding, text alignment beyond basic left/center/right, or background colors. The professional-looking output the prompt describes ("semplice e pulito") requires more control than raw markdown provides.

**How to avoid:**
1. Instead of pure markdown, generate HTML with inline CSS or a style block, then convert HTML-to-PDF via CloudConvert -- this gives full control over table appearance, fonts, colors, and spacing
2. If staying with markdown, keep tables extremely simple: few columns, short cell content, no complex nested data
3. Test the CloudConvert output with representative data early -- do not assume markdown tables will look acceptable without testing
4. CloudConvert supports HTML-to-PDF conversion with the same API job structure; the switch from MD-to-PDF to HTML-to-PDF is trivial
5. Consider whether Claude should output HTML directly instead of markdown

**Warning signs:**
- Tables render without visible borders in the PDF
- Column widths are disproportionate (parameter names get 80% of the width, numbers get 20%)
- Long parameter names like "Massa Muscolo-Scheletrica (SMM) Janssen" wrap awkwardly
- The PDF looks nothing like the "semplice e pulito" vision

**Phase to address:**
Phase 1 (Core CLI) -- test the conversion pipeline end-to-end with real data before building the full prompt. This may force an early decision to use HTML instead of markdown.

---

### Pitfall 5: Prompt Not Anchoring to Specific BIA Parameters, Causing Inconsistent Output

**What goes wrong:**
A generic prompt like "summarize this BIA report" produces wildly different output structures each time. One run extracts 12 parameters, the next extracts 8. One run includes BMI (which the user explicitly wants excluded), the next omits BMR (which is required). The output format varies between runs -- sometimes a table, sometimes bullet points, sometimes prose. This makes it impossible to produce a consistent, professional PDF.

**Why it happens:**
LLMs are non-deterministic. Without explicit, specific instructions about which parameters to extract, in what order, in what format, and what to exclude, Claude will make different choices each time based on which parts of the document it focuses on. The Bodygram report has 5+ pages of data -- Claude has many options for what to include. The project context notes explicit exclusions (BMI, hydration data) and explicit inclusions (FM/FFM in kg and %, BMR, TDEE, target tables by sex), but these must be encoded precisely in the prompt.

**How to avoid:**
1. The prompt must enumerate every parameter to extract by name: PhA, TBW, ECW, ICW, FFM, FM, BCM, SMM, ASMM, BMR, TDEE
2. The prompt must specify the exact output structure: section headings, table columns, what goes where
3. The prompt must explicitly list exclusions: "Do NOT include BMI. Do NOT include hydration analysis (Hydragram). Do NOT include Nutrigram."
4. Use a system prompt to set the persona and language (Italian), and a user prompt with the document and specific extraction instructions
5. Include an example of the expected output format (few-shot prompting) -- even one example dramatically improves consistency
6. Set `temperature: 0` (or as low as possible) for maximum determinism

**Warning signs:**
- Running the same PDF twice produces structurally different outputs
- Some runs include BMI despite the exclusion instruction
- Table column ordering changes between runs
- Missing parameters in some outputs

**Phase to address:**
Phase 1 (Core CLI) -- the prompt is the core product. Invest heavily in prompt engineering from day one. The prompt file should be iterated and tested against the same PDF multiple times to verify consistency.

---

### Pitfall 6: Misunderstanding BIA Reference Ranges and Target Calculation

**What goes wrong:**
The prompt asks Claude to generate a "target table" with goals for "in forma" and "ottima definizione" states, with thresholds varying by sex. Claude may invent plausible-sounding but incorrect target ranges, or apply male ranges to a female subject, or calculate target weights incorrectly. For example, the Bodygram report shows FM at 24.3% for a female subject -- Claude might set an "in forma" target of 15% (which is appropriate for males but dangerously low for females).

**Why it happens:**
Claude has general knowledge of body composition but is not a certified BIA specialist. The reference ranges in the Bodygram report are sex-specific and age-adjusted. Claude may hallucinate target values that sound reasonable but are clinically inappropriate. This is compounded by the fact that BIA-specific reference ranges (especially from Akern/Bodygram) are proprietary and may differ from generic body composition literature.

**How to avoid:**
1. Hard-code the target ranges in the prompt itself -- do not ask Claude to calculate or determine them
2. The prompt should contain explicit thresholds: "For females, 'in forma' FM% target is 20-25%, 'ottima definizione' is 15-20%"
3. Have Claude extract the actual values and compare against the provided thresholds, not generate its own
4. Include the sex of the subject as a variable that controls which threshold table is used
5. Review with the BIA professional (the user) to confirm all thresholds before finalizing the prompt

**Warning signs:**
- Target percentages that differ between runs for the same prompt
- Male-appropriate ranges applied to female subjects or vice versa
- Target values that contradict the reference ranges shown in the Bodygram report itself
- "Invented" categories or thresholds not in the original prompt

**Phase to address:**
Phase 1 (Core CLI) -- this is embedded in the prompt engineering. The prompt must contain the authoritative thresholds, not rely on Claude's training data.

---

## Moderate Pitfalls

### Pitfall 7: Token Cost Surprise from PDF Page-as-Image Processing

**What goes wrong:**
Each PDF page costs both text tokens (1,500-3,000 per page) and image tokens (~1,600 per page), totaling roughly 3,000-4,500 input tokens per page. A 5-page Bodygram report costs approximately 15,000-22,000 input tokens. At Sonnet 4.6 pricing ($3/M input), that is about $0.05-0.07 per report. Seems cheap, but if the developer sends unnecessary pages (glossary, header pages) or does not realize the dual-cost model, costs can double unexpectedly.

**Why it happens:**
Developers often think PDF processing costs only the text extraction tokens. The official docs clearly state each page is also rendered as an image. The Bodygram report includes a glossary page (page 3) and percentile curve pages (page 4) that may not be needed for the summary. Sending the full PDF when only pages 1-2 are needed wastes tokens.

**How to avoid:**
1. For this specific tool, sending the full PDF is likely fine (5 pages, ~$0.05-0.07 per run, personal use) -- but be aware of the cost model
2. If cost becomes a concern, pre-split the PDF to send only the data pages (pages 1-2 for core data, skip glossary and charts if not needed)
3. Use Anthropic's token counting endpoint to measure actual costs before committing to a model tier
4. Consider using Claude Haiku for cost-sensitive scenarios (much cheaper, still capable for structured data extraction)

**Warning signs:**
- API bills higher than expected relative to usage volume
- Sending large multi-page PDFs when only 2-3 pages contain needed data

**Phase to address:**
Phase 1 -- make an informed model choice and understand the cost per report.

---

### Pitfall 8: CloudConvert Job Failure Without Proper Error Handling

**What goes wrong:**
CloudConvert API jobs are asynchronous. A job has import, convert, and export tasks. Any task can fail independently: the import may fail if the file is too large, the convert may fail if the markdown is malformed, the export URL may expire before download. If the CLI does not handle these failures, the user gets a cryptic error or worse, no output with no explanation.

**Why it happens:**
CloudConvert returns HTTP 201 for job creation, but the job itself runs asynchronously. The actual conversion status must be polled or received via webhook. Common failure modes: 422 (invalid input), 429 (rate limit exceeded with Retry-After header), 500 (internal error). The markdown-to-PDF conversion can also fail silently if the markdown contains unsupported syntax.

**How to avoid:**
1. After creating a job, poll the job status until all tasks are `finished` or any task is `error`
2. Handle the `error` status for each task individually, with meaningful error messages
3. Implement retry logic for 429 (respect Retry-After header) and 500 errors
4. Set a timeout for the polling loop (e.g., 60 seconds max for a simple markdown-to-PDF conversion)
5. Validate the exported file exists and has non-zero size before declaring success
6. Use the CloudConvert Node.js SDK which handles some of this automatically

```typescript
// Check job completion
job = await cloudConvert.jobs.wait(job.id);
const exportTask = job.tasks.find(t => t.operation === "export/url");
if (!exportTask || exportTask.status === "error") {
  throw new Error(`CloudConvert export failed: ${exportTask?.message}`);
}
```

**Warning signs:**
- CLI hangs indefinitely waiting for CloudConvert response
- Empty or zero-byte output PDF files
- Intermittent "success" with no actual file produced

**Phase to address:**
Phase 1 (Core CLI) -- error handling must be robust from the first implementation.

---

### Pitfall 9: Not Handling Claude API Errors Gracefully (Rate Limits, Overloads)

**What goes wrong:**
The Claude API can return 429 (rate limit), 529 (overload), or 500 (server error). Without proper handling, the CLI crashes with an unreadable stack trace. The user (a health professional, not a developer) sees a Node.js error and has no idea what to do.

**Why it happens:**
The Anthropic TypeScript SDK has built-in retry logic (configurable via `maxRetries`), but developers often leave it at defaults or do not handle the case where all retries are exhausted. 529 errors (server overload) are distinct from 429 (rate limit) and need exponential backoff.

**How to avoid:**
1. Configure the Anthropic client with explicit retry settings: `new Anthropic({ maxRetries: 3 })`
2. Wrap the API call in a try/catch that produces user-friendly error messages
3. For 429: respect the `Retry-After` header (the SDK does this automatically)
4. For 529: implement exponential backoff with a maximum wait time
5. Log the raw error for debugging but show the user a clear message: "Claude API is temporarily overloaded. Please try again in a few minutes."

**Warning signs:**
- Raw `APIError` stack traces shown to the user
- CLI hanging indefinitely on a failed request
- No distinction between "your API key is wrong" and "the server is busy"

**Phase to address:**
Phase 1 (Core CLI) -- part of the basic error handling framework.

---

### Pitfall 10: API Keys Committed to Git or Hardcoded

**What goes wrong:**
The tool needs two API keys (Anthropic and CloudConvert). A developer hardcodes them during development or commits a `.env` file to the repository. Even for a personal tool, this is a risk if the repo is ever shared or made public.

**Why it happens:**
For personal-use tools, security feels less important. The developer tests with real keys, forgets to add `.env` to `.gitignore`, and pushes to a remote repo.

**How to avoid:**
1. Use `dotenv` for local development with a `.env` file
2. Add `.env` to `.gitignore` from the very first commit
3. Create a `.env.example` file with placeholder values
4. Validate at startup that both `ANTHROPIC_API_KEY` and `CLOUDCONVERT_API_KEY` are set, with clear error messages if missing
5. Never accept API keys as CLI arguments (they appear in shell history)

**Warning signs:**
- `.env` file tracked in git
- API keys visible in `git log`
- Keys passed as command-line arguments

**Phase to address:**
Phase 1 (Core CLI) -- `.gitignore` and env validation must be set up before any code touches an API.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding the prompt string in code | Faster initial development | Cannot iterate on prompt without code changes, rebuilds | Never -- the project explicitly requires external prompt file |
| Using `any` types for API responses | Skip TypeScript typing for Anthropic/CloudConvert responses | Runtime errors from unexpected response shapes, no IDE completion | Only for initial prototype, must type within same phase |
| Skipping stop_reason check | Less code in happy path | Silent truncation produces incomplete summaries for clients | Never -- must check from day one |
| Synchronous file operations | Simpler code flow | Blocks event loop, poor UX on large PDFs | Acceptable for this personal CLI (single file, small PDF) |
| No retry logic for API calls | Less code complexity | Intermittent failures require manual re-runs | Only acceptable for MVP if SDK default retries are enabled |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API (PDF) | Sending PDF as `image` blocks instead of `document` block | Use `type: "document"` with `media_type: "application/pdf"` to get text+image dual extraction |
| Claude API (output) | Setting `max_tokens: 1024` from example code | Set to 8192+ for medical summary; always check `stop_reason` |
| Claude API (prompt) | Placing the prompt text before the PDF document | Place the PDF document BEFORE the text prompt -- Anthropic docs explicitly recommend "images before text" for better results |
| CloudConvert | Using `import/url` when you have a local file | Use `import/upload` for local files, or `import/raw` for inline content (the markdown string) |
| CloudConvert | Not waiting for job completion before accessing results | Use `jobs.wait()` or poll status; the job creation response does NOT contain results |
| CloudConvert | Assuming markdown tables render attractively in PDF | Test early; switch to HTML-to-PDF if tables look poor |
| Both APIs | Not setting request timeouts | Set explicit timeouts: 120s for Claude (PDF analysis is slow), 60s for CloudConvert |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sending full 5-page PDF when only 2 pages have data | Higher latency and cost per request (~22K tokens vs ~9K) | This is acceptable for personal use; optimize only if batch processing is added later | Not a real issue for single-report personal use |
| Not using streaming for Claude response | CLI appears frozen for 10-30 seconds while waiting for full response | Implement streaming to show progress; or at minimum, show a spinner/progress indicator | Immediately -- 10-30 seconds of silence is poor UX |
| Base64 encoding large PDFs in memory | Memory spike during encoding | The Bodygram PDF is ~258KB, producing ~344KB base64 -- trivial for Node.js. Only matters if processing much larger documents | Not a concern for this project |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API keys in CLI arguments | Keys visible in `ps`, shell history, logs | Use environment variables or .env file only |
| Storing client PDFs with names in temp directory | PII exposure (name, date of birth, health data in the filename and content) | Process in memory where possible; if temp files needed, use random names and delete immediately after |
| Not clearing Claude API response from memory | Health data persists in Node.js process memory | For this personal CLI tool, the process exits after each run -- not a real concern. Would matter for a server. |
| Logging full API responses in debug mode | Health data in log files | If logging, redact or exclude the response content; log only metadata (token count, stop_reason, latency) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress feedback during API calls | User thinks the tool is frozen (Claude + CloudConvert can take 15-40 seconds total) | Show spinner or progress steps: "Analyzing PDF...", "Generating summary...", "Converting to PDF..." |
| Cryptic error messages from API failures | Non-developer user cannot diagnose or fix the issue | Translate every error to a user-friendly message with suggested action |
| Output PDF filename is generic (e.g., "output.pdf") | User must rename every file; hard to organize | Generate filename from input: "Riassunto BIA - Angelina Jolie - 2026-03-26.pdf" |
| No way to preview the markdown before PDF conversion | User discovers formatting issues only after seeing the PDF | Add a `--preview` or `--markdown-only` flag that outputs the markdown without converting |
| Italian prompt producing English output or vice versa | Inconsistent language in client-facing document | Explicitly specify output language in the prompt: "Rispondi SEMPRE in italiano" |

## "Looks Done But Isn't" Checklist

- [ ] **PDF extraction accuracy:** Numbers in summary match original PDF exactly -- verify against at least 3 different Bodygram reports with different patient profiles
- [ ] **Sex-specific thresholds:** Target table uses correct thresholds for the subject's sex -- test with both male and female reports
- [ ] **Output completeness:** All requested parameters present (PhA, TBW, ECW, ICW, FFM, FM, BCM, SMM, ASMM, BMR, TDEE) -- check against the prompt's explicit list
- [ ] **Exclusions enforced:** BMI and hydration data (Hydragram) do NOT appear in the output -- search output for "BMI" and "idratazione"
- [ ] **stop_reason check:** API response `stop_reason` is `"end_turn"`, not `"max_tokens"` -- must be verified in code, not just tested once
- [ ] **PDF renders correctly:** Open the generated PDF and verify tables have readable formatting, no cut-off text, proper Italian characters (accented letters: a, e, i, o, u)
- [ ] **Error handling:** Run the tool with: invalid PDF, expired API key, no internet, oversized PDF -- all should produce clear error messages
- [ ] **Cleanup:** No temp files left behind after successful or failed runs

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Numerical hallucination in output | LOW | Re-run with improved prompt; add explicit verification instructions; compare against original PDF |
| max_tokens truncation shipped to client | LOW | Re-run with higher max_tokens; add stop_reason check to prevent recurrence |
| CloudConvert table rendering is ugly | MEDIUM | Switch from markdown-to-PDF to HTML-to-PDF; requires changing Claude's output format and CloudConvert job config |
| API keys leaked in git history | MEDIUM | Rotate both API keys immediately; use `git filter-branch` or BFG to remove from history; add `.env` to `.gitignore` |
| Wrong sex-specific thresholds in prompt | LOW | Fix thresholds in prompt file; re-run affected reports |
| Prompt produces inconsistent structure | MEDIUM | Invest in few-shot examples in the prompt; add output format validation in code |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Numerical value hallucination | Phase 1: Core CLI | Run same PDF 5 times, compare all extracted numbers against original |
| Ignoring PDF text layer | Phase 1: Core CLI | Verify `document` block type in API call code; check token count matches expected (text + image) |
| max_tokens truncation | Phase 1: Core CLI | Unit test that checks `stop_reason === "end_turn"` in response handling |
| CloudConvert table rendering | Phase 1: Core CLI | Visual inspection of output PDF; decide markdown vs. HTML early |
| Inconsistent prompt output | Phase 1: Core CLI (prompt engineering) | 5 consecutive runs produce structurally identical output |
| BIA reference range errors | Phase 1: Core CLI (prompt engineering) | Professional review of target tables against BIA literature |
| Token cost surprise | Phase 1: Core CLI | Log token usage for first 10 runs; verify cost per report |
| CloudConvert job failures | Phase 1: Core CLI | Test with malformed input; verify error messages |
| Claude API error handling | Phase 1: Core CLI | Test with invalid API key; simulate rate limit |
| API keys in git | Phase 1: Core CLI (setup) | Verify `.gitignore` contains `.env` before first commit with API code |

## Sources

- [Anthropic PDF Support Documentation](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- Official limits (32MB, 600 pages), text+image dual extraction, token costs (1,500-3,000 text + ~1,600 image per page), best practices (PDF before text, standard fonts)
- [Anthropic Vision Limitations](https://platform.claude.com/docs/en/build-with-claude/vision) -- Accuracy issues with small text, dense tables, spatial reasoning; hallucination risk for low-quality/small images
- [Anthropic Stop Reasons Documentation](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) -- max_tokens truncation detection and handling
- [LLM Medical Summarization Hallucination Study (Nature, 2025)](https://www.nature.com/articles/s41746-025-01670-7) -- 1.47% hallucination rate and 3.45% omission rate in clinical note generation
- [JAMA Network Open: LLM Accuracy in Medical Records](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2822301) -- Variability in hallucination rates across models for medical data
- [CloudConvert Node.js SDK](https://github.com/cloudconvert/cloudconvert-node) -- Job creation, task workflow, SDK usage patterns
- [CloudConvert API v2](https://cloudconvert.com/api/v2) -- Job structure, rate limiting (429 with Retry-After), error codes
- [Anthropic Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) -- Few-shot examples, XML structuring, explicit output format specification
- [Anthropic Rate Limit Handling](https://markaicode.com/anthropic-api-rate-limits-429-errors/) -- 429 vs 529 error distinction, retry strategies
- Actual Bodygram PDF analysis (in-repo sample) -- Confirmed dense numerical tables, color-coded reference bars, graphical charts, Italian text, 5-page structure

---
*Pitfalls research for: BIA report summarization CLI tool (Claude multimodal + CloudConvert)*
*Researched: 2026-03-26*
