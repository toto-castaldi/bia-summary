# Phase 3: Robustness and Polish - Research

**Researched:** 2026-03-26
**Domain:** CLI robustness (retry logic, verbose logging, error messages, template variables)
**Confidence:** HIGH

## Summary

Phase 3 hardens an already-functional CLI tool for real-world use. The four requirements are independent features that touch different parts of the codebase but share a common theme: making the tool resilient and debuggable. The Anthropic TypeScript SDK already has built-in retry with exponential backoff (default 2 retries for 429, 500+, connection errors), so the main decision is whether to leverage the SDK's retry or build a custom wrapper. The CloudConvert SDK has NO built-in retry -- it throws a plain `Error` on non-OK HTTP responses -- so it needs a custom retry wrapper. Template variables are straightforward string replacement in `loadPrompt()`, using values already parsed by `parseInputFilename()`.

The codebase is clean and well-structured after Phases 1 and 2. All four features integrate at clear, documented points. There are no architectural surprises -- this is additive work on an established foundation.

**Primary recommendation:** Leverage the Anthropic SDK's built-in `maxRetries` (set to 3) for Claude retry. Build a shared `withRetry()` utility for CloudConvert (which lacks built-in retry). Add `--verbose` as a boolean flag threaded through `PipelineOptions`. Implement template variables as simple `{{VAR}}` string replacement in `loadPrompt()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- user deferred all implementation details to Claude.

### Claude's Discretion
- **Verbose Logging (CLI-03):** What shows with `--verbose`, how to implement it
- **Error Messages (CLI-05):** Audit and improve existing messages for clarity and consistency
- **Retry Strategy (PDF-04):** Both Claude and CloudConvert, transient errors (429, 500, 502, 503), exponential backoff with jitter, max 3 retries
- **Template Variables (AI-08):** At minimum `{{CLIENT_NAME}}`, `{{EXAM_DATE}}`, sourced from filename parsing, replace in prompt text before sending to Claude

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-03 | `--verbose` flag for step-by-step progress logging | Commander boolean option, verbose flag in PipelineOptions, conditional stderr logging at each pipeline step |
| CLI-05 | Clear, human-readable error messages for all failure modes | Audit of existing error paths; Anthropic SDK error classes (RateLimitError, AuthenticationError, etc.) for specific messages; CloudConvert raw error needs parsing |
| PDF-04 | API calls retry with exponential backoff on transient errors (429, 500, 502, 503), max 3 retries | Anthropic SDK built-in `maxRetries: 3`; custom `withRetry()` for CloudConvert; jitter strategy documented |
| AI-08 | Prompt supports `{{CLIENT_NAME}}`, `{{EXAM_DATE}}` template variables | `parseInputFilename()` already returns `clientName` and `date`; simple string replacement in `loadPrompt()` |
</phase_requirements>

## Standard Stack

No new dependencies are needed. All features are implemented using existing libraries and Node.js built-ins.

### Core (already installed)
| Library | Version | Purpose | Phase 3 Usage |
|---------|---------|---------|---------------|
| @anthropic-ai/sdk | ^0.80.0 | Claude API client | `maxRetries: 3` constructor option for built-in retry |
| cloudconvert | ^3.0.0 | CloudConvert API client | Custom retry wrapper needed (no built-in retry) |
| commander | ^14.0.3 | CLI argument parsing | Add `--verbose` boolean option |
| ora | ^9.3.0 | Terminal spinner | Already in use; verbose mode supplements spinner |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SDK built-in retry (Anthropic) | Custom retry wrapper | SDK already handles 429 Retry-After headers, exponential backoff, connection errors -- no reason to rebuild |
| Simple `withRetry()` function | p-retry / async-retry npm packages | Extra dependency for a ~20 line utility function; not justified for this project |
| `{{VAR}}` string replacement | Handlebars / Mustache template engine | Massive overkill for 2 variables; simple `String.replace()` is correct |
| console.error for verbose | pino / winston logger | Structured logging is enterprise overhead; this is a personal CLI tool |

## Architecture Patterns

### Recommended Changes by File

```
src/
  cli.ts           # Add --verbose option, pass to PipelineOptions
  config.ts        # Add templateVars parameter to loadPrompt() for {{VAR}} replacement
  pipeline.ts      # Thread verbose flag, add verbose logging at each step
  clients/
    claude.ts       # Set maxRetries: 3 on Anthropic client constructor
    cloudconvert.ts # Wrap API calls with withRetry()
  retry.ts          # NEW: shared withRetry() utility function
  types.ts          # Add verbose to PipelineOptions, add TemplateVars type
```

### Pattern 1: Anthropic SDK Built-in Retry

**What:** The Anthropic TypeScript SDK has retry built into the client. Setting `maxRetries` in the constructor enables automatic retry with exponential backoff for 429, 500+, 408, 409, and connection errors. The SDK respects `Retry-After` headers from 429 responses.

**When to use:** Always, for all Claude API calls.

**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript#retries
const client = new Anthropic({
  maxRetries: 3, // default is 2
});
```

**Key details (from official Anthropic SDK docs):**
- Default is 2 retries (we want 3 per requirement)
- Retries: connection errors, 408 Request Timeout, 409 Conflict, 429 Rate Limit, >=500 Internal
- Uses short exponential backoff
- Respects Retry-After header on 429 responses
- Timeout errors are also retried

### Pattern 2: Custom Retry Wrapper for CloudConvert

**What:** CloudConvert SDK v3 has NO built-in retry. On HTTP errors, `CloudConvert.call()` throws `new Error(res.statusText, { cause: res })` where `cause` is the raw `Response` object. A custom `withRetry()` function wraps CloudConvert calls.

**When to use:** For `cloudConvert.jobs.create()` and `cloudConvert.jobs.wait()` calls.

**Example:**
```typescript
// src/retry.ts
export interface RetryOptions {
  maxRetries: number;       // default: 3
  baseDelayMs: number;      // default: 1000
  maxDelayMs: number;       // default: 10000
  retryableStatuses: number[]; // default: [429, 500, 502, 503]
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    retryableStatuses = [429, 500, 502, 503],
    onRetry,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !isRetryable(error, retryableStatuses)) {
        throw error;
      }
      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs, error);
      onRetry?.(attempt + 1, delayMs, error);
      await sleep(delayMs);
    }
  }
  throw new Error("Unreachable");
}

function isRetryable(error: unknown, statuses: number[]): boolean {
  if (error instanceof Error && error.cause instanceof Response) {
    return statuses.includes(error.cause.status);
  }
  // Network errors (no Response)
  if (error instanceof TypeError) return true;
  return false;
}

function calculateDelay(
  attempt: number,
  baseMs: number,
  maxMs: number,
  error: unknown,
): number {
  // Respect Retry-After header if present
  if (error instanceof Error && error.cause instanceof Response) {
    const retryAfter = error.cause.headers.get("retry-after");
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
  }
  // Exponential backoff with full jitter
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  return Math.random() * capped; // full jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Pattern 3: Verbose Logging via Flag Threading

**What:** Add `verbose: boolean` to `PipelineOptions`. At each pipeline step, conditionally emit detailed information to stderr. Verbose logging supplements (does not replace) the existing ora spinner.

**When to use:** When `--verbose` flag is passed.

**Example:**
```typescript
// In pipeline.ts
function log(verbose: boolean, message: string): void {
  if (verbose) {
    console.error(`[verbose] ${message}`);
  }
}

// Usage in runPipeline:
log(options.verbose, `Loading prompt from: ${promptPath}`);
log(options.verbose, `Sending PDF to Claude (${(pdfSize / 1024).toFixed(1)} KB)`);
log(options.verbose, `Claude response: ${result.inputTokens} input / ${result.outputTokens} output tokens, stop_reason: ${result.stopReason}`);
log(options.verbose, `Converting markdown to PDF via CloudConvert...`);
log(options.verbose, `PDF saved: ${outputPath} (${(pdfSize / 1024).toFixed(1)} KB)`);
```

### Pattern 4: Template Variable Replacement in loadPrompt()

**What:** After loading the prompt file content, replace `{{CLIENT_NAME}}` and `{{EXAM_DATE}}` with values from `parseInputFilename()`. If filename parsing fails, leave variables unreplaced (they become literal text in the prompt, which is harmless).

**When to use:** In `loadPrompt()` before returning the prompt string.

**Example:**
```typescript
// In config.ts
export interface TemplateVars {
  clientName?: string;
  examDate?: string;  // YYYY_MM_DD format from parseInputFilename
}

export async function loadPrompt(
  pdfPath: string,
  templateVars?: TemplateVars,
): Promise<string> {
  // ... existing file loading logic ...
  let content = await readFile(promptPath, "utf-8");

  if (templateVars?.clientName) {
    content = content.replaceAll("{{CLIENT_NAME}}", templateVars.clientName);
  }
  if (templateVars?.examDate) {
    // Convert YYYY_MM_DD to DD/MM/YYYY for display
    const [y, m, d] = templateVars.examDate.split("_");
    content = content.replaceAll("{{EXAM_DATE}}", `${d}/${m}/${y}`);
  }

  return content;
}
```

### Anti-Patterns to Avoid

- **Wrapping Anthropic SDK calls in custom retry:** The SDK already handles retry, backoff, and Retry-After. Adding another retry layer causes double-retry (up to 9 attempts instead of 3).
- **Replacing the ora spinner with verbose logging:** Verbose mode adds detail; it does not disable the spinner. Both should work together.
- **Throwing on template variable replacement failure:** If `parseInputFilename()` returns null, template variables stay as literal `{{CLIENT_NAME}}` in the prompt text. This is harmless -- Claude sees them as placeholder text and may even fill them from the PDF content.
- **Using complex template engines:** Two variables do not need Handlebars, Mustache, or any template engine. `String.replaceAll()` is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude API retry | Custom retry wrapper for Anthropic calls | `new Anthropic({ maxRetries: 3 })` | SDK handles 429 Retry-After, exponential backoff, connection errors, timeout retries natively |
| Template engine | Full Handlebars/Mustache integration | `String.replaceAll("{{VAR}}", value)` | Only 2 variables, no conditionals, no loops -- template engine is pure overhead |
| Structured logger | Winston/pino integration | `console.error()` with `[verbose]` prefix | Personal CLI tool; structured logging is enterprise overhead |

## Common Pitfalls

### Pitfall 1: Double Retry on Claude API Calls

**What goes wrong:** Developer adds a custom `withRetry()` wrapper around `client.messages.create()` while the Anthropic SDK already retries internally. A 429 error gets retried 3 times by the SDK, and each of those failures triggers 3 more retries from the custom wrapper, potentially producing 9+ attempts.
**Why it happens:** Not realizing the SDK has built-in retry.
**How to avoid:** Use `maxRetries: 3` in the Anthropic constructor. Do NOT wrap `analyzePdf()` in `withRetry()`.
**Warning signs:** API logs showing many more retry attempts than expected.

### Pitfall 2: CloudConvert Error Object Structure

**What goes wrong:** The retry wrapper checks `error.status` or `error.statusCode`, but the CloudConvert SDK throws `new Error(res.statusText, { cause: res })` where `cause` is the raw `Response` object. The status code is on `error.cause.status`, not `error.status`.
**Why it happens:** The CloudConvert SDK uses native `Error` with `cause` (ES2022 feature) rather than a custom error class.
**How to avoid:** In `isRetryable()`, check `error.cause instanceof Response && error.cause.status`. Verified by reading CloudConvert SDK source: `CloudConvert.js` line 183-184.
**Warning signs:** All CloudConvert errors treated as non-retryable (or all treated as retryable).

### Pitfall 3: Template Variables Not Replaced When Filename Parsing Fails

**What goes wrong:** If the input PDF has a non-standard filename, `parseInputFilename()` returns null. Template variables `{{CLIENT_NAME}}` and `{{EXAM_DATE}}` remain as literal text in the prompt sent to Claude. Claude may interpret them as instructions or produce unexpected output.
**Why it happens:** Non-standard filenames from renamed or custom-sourced BIA reports.
**How to avoid:** This is the designed behavior per CONTEXT.md ("skip template replacement -- variables remain as-is"). However, the prompt.txt should be written so that unreplaced variables degrade gracefully. Verbose mode should log when template replacement is skipped.
**Warning signs:** Prompt contains literal `{{CLIENT_NAME}}` text when sent to Claude.

### Pitfall 4: Verbose Output Interfering with Pipeable stdout

**What goes wrong:** Verbose logging goes to stdout instead of stderr, breaking the `--dry-run` piping pattern (D-05: only markdown to stdout).
**Why it happens:** Using `console.log()` instead of `console.error()` for verbose output.
**How to avoid:** ALL verbose output MUST use `console.error()` (stderr). The existing pattern already does this correctly with ora (spinner to stderr).
**Warning signs:** `bia-summary report.pdf --dry-run --verbose | head` shows verbose lines mixed with markdown.

### Pitfall 5: Retry-After Header Ignored for CloudConvert

**What goes wrong:** CloudConvert returns 429 with a `Retry-After` header specifying how long to wait. The retry wrapper uses exponential backoff instead, resulting in either too-aggressive retries (triggering more 429s) or unnecessarily long waits.
**Why it happens:** Not parsing the `Retry-After` header from the CloudConvert error response.
**How to avoid:** In `calculateDelay()`, check `error.cause.headers.get("retry-after")` before falling back to exponential backoff. The CloudConvert API documentation confirms it sends `Retry-After` headers with 429 responses.
**Warning signs:** Repeated 429 errors during retry sequence.

## Code Examples

### Adding --verbose to Commander (CLI-03)

```typescript
// In src/cli.ts
program
  .option("--verbose", "Show step-by-step progress logging", false)
  .action(async (pdfFile: string, options: {
    dryRun: boolean;
    output?: string;
    verbose: boolean;
  }) => {
    // Pass verbose through to pipeline
    const result = await runPipeline(
      {
        inputPath,
        dryRun: options.dryRun,
        outputPath: options.output ? path.resolve(options.output) : undefined,
        verbose: options.verbose,
      },
      config,
    );
  });
```

### Anthropic SDK Error Classes for User-Friendly Messages (CLI-05)

```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript#handling-errors
import Anthropic from "@anthropic-ai/sdk";

// Error type mapping for user-friendly messages:
// Anthropic.BadRequestError      (400) -> "Invalid request to Claude API"
// Anthropic.AuthenticationError   (401) -> "Invalid Anthropic API key"
// Anthropic.PermissionDeniedError (403) -> "API key lacks required permissions"
// Anthropic.RateLimitError        (429) -> "Rate limit exceeded, retrying..."
// Anthropic.InternalServerError   (>=500) -> "Claude API server error, retrying..."
// Anthropic.APIConnectionError    (N/A) -> "Cannot connect to Claude API"

function formatApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Invalid ANTHROPIC_API_KEY. Check your .env file or environment variables.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Claude API rate limit exceeded. The request was retried but all attempts failed. Try again in a few minutes.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Cannot connect to Claude API. Check your internet connection.";
  }
  if (error instanceof Anthropic.InternalServerError) {
    return "Claude API is experiencing issues. The request was retried but all attempts failed. Try again later.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Claude API error (${error.status}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

### Configuring Anthropic Client with Retry (PDF-04)

```typescript
// In src/clients/claude.ts
const client = new Anthropic({
  maxRetries: 3, // SDK default is 2, requirement says max 3
});
```

### Verbose Logging in Pipeline

```typescript
// In src/pipeline.ts
function verboseLog(verbose: boolean, message: string): void {
  if (verbose) {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    console.error(`[${timestamp}] ${message}`);
  }
}

// Usage at each step:
verboseLog(options.verbose, `Prompt loaded (${prompt.length} chars)`);
verboseLog(options.verbose, `PDF file: ${options.inputPath} (${fileSize} bytes)`);
verboseLog(options.verbose, `Sending to Claude (model: claude-sonnet-4-20250514, max_tokens: 8192)`);
verboseLog(options.verbose, `Claude response received: ${result.inputTokens} input / ${result.outputTokens} output tokens`);
verboseLog(options.verbose, `Stop reason: ${result.stopReason}`);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom retry wrappers for Anthropic API | SDK built-in `maxRetries` option | SDK v0.6+ (2024) | No custom retry code needed for Claude calls |
| `String.replace()` (first match only) | `String.replaceAll()` (ES2021) | ES2021 / Node 16+ | Use `replaceAll` for template vars to handle multiple occurrences |

**Deprecated/outdated:**
- Building custom retry for Anthropic SDK is unnecessary as of SDK v0.6+ -- the SDK handles it natively

## Open Questions

1. **Verbose output during retry waits**
   - What we know: During a retry backoff (e.g., 5 seconds), the spinner continues spinning but gives no indication a retry is happening
   - What's unclear: Whether to update spinner text during retry or use verbose-only logging
   - Recommendation: Use the `onRetry` callback in `withRetry()` to update spinner text (e.g., "Retrying CloudConvert (attempt 2/3)...") regardless of verbose mode. In verbose mode, additionally log the specific error and delay.

2. **Template variable date format**
   - What we know: `parseInputFilename()` returns date as `YYYY_MM_DD`. The prompt would benefit from `DD/MM/YYYY` format (Italian convention).
   - What's unclear: Which format the user's prompt.txt expects
   - Recommendation: Convert to `DD/MM/YYYY` for `{{EXAM_DATE}}` since the tool targets Italian output. Document the format in verbose output.

## Sources

### Primary (HIGH confidence)
- [Anthropic TypeScript SDK - Retries](https://platform.claude.com/docs/en/api/sdks/typescript#retries) -- Built-in retry: 2 retries default, exponential backoff, respects Retry-After header, retries 429/500+/408/409/connection errors
- [Anthropic TypeScript SDK - Error Handling](https://platform.claude.com/docs/en/api/sdks/typescript#handling-errors) -- Error class hierarchy: BadRequestError, AuthenticationError, RateLimitError, InternalServerError, APIConnectionError
- [Anthropic API Errors](https://platform.claude.com/docs/en/api/errors) -- HTTP error codes: 429 rate_limit_error, 500 api_error, 529 overloaded_error
- CloudConvert SDK source code (`node_modules/cloudconvert/built/lib/CloudConvert.js` line 183-184) -- Confirmed NO built-in retry; throws `new Error(res.statusText, { cause: res })` on non-OK responses
- CloudConvert SDK source code (`node_modules/cloudconvert/built/lib/JobsResource.js`) -- `jobs.wait()` uses synchronous API endpoint, `jobs.create()` is standard POST

### Secondary (MEDIUM confidence)
- [CloudConvert API v2](https://cloudconvert.com/api/v2) -- Rate limiting with Retry-After header on 429 responses
- [GitHub: cloudconvert-node](https://github.com/cloudconvert/cloudconvert-node) -- SDK v3.0.0, no retry documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified in existing package.json
- Architecture: HIGH -- all integration points identified from reading actual source code
- Pitfalls: HIGH -- CloudConvert error structure verified by reading SDK source; Anthropic retry behavior verified from official docs
- Retry strategy: HIGH -- Anthropic SDK built-in retry confirmed from official docs; CloudConvert lack of retry confirmed from source code

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no fast-moving dependencies)
