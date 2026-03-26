import CloudConvert from "cloudconvert";

/**
 * Convert a markdown string to PDF via the CloudConvert API.
 *
 * Uses a three-task job pipeline:
 * 1. import/raw - embeds the markdown content directly (no file upload needed)
 * 2. convert   - md-to-pdf conversion (Pandoc engine, auto-selected)
 * 3. export/url - generates a temporary download URL
 *
 * The API key must be passed explicitly -- the CloudConvert SDK does NOT
 * auto-read environment variables (unlike the Anthropic SDK).
 */
export async function convertMarkdownToPdf(
  markdown: string,
  apiKey: string,
): Promise<Buffer> {
  const cloudConvert = new CloudConvert(apiKey);

  // Step 1: Create job with import/raw + convert + export/url pipeline
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

  // Step 2: Wait for completion (SDK handles polling internally)
  const completed = await cloudConvert.jobs.wait(job.id);

  // Step 3: Get export URLs
  const exportUrls = cloudConvert.jobs.getExportUrls(completed);
  if (!exportUrls.length || !exportUrls[0].url) {
    throw new Error(
      "CloudConvert job completed but no export URL available",
    );
  }

  // Step 4: Download PDF immediately (URLs expire -- per Pitfall 3)
  const response = await fetch(exportUrls[0].url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: HTTP ${response.status}`);
  }

  // Step 5: Convert to Buffer and return
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
