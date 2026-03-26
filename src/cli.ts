import { Command } from "commander";
import { validateEnv } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { access } from "node:fs/promises";
import path from "node:path";

const program = new Command();

program
  .name("bia-summary")
  .description("Generate a structured Italian summary from a BIA report PDF")
  .version("0.1.0")
  .argument("<pdf-file>", "Path to the BIA report PDF")
  .option("--dry-run", "Preview markdown output without PDF conversion", false)
  .action(async (pdfFile: string, options: { dryRun: boolean }) => {
    try {
      // Step 1: Validate environment (D-07, D-08)
      validateEnv();

      // Step 2: Validate PDF file exists
      const inputPath = path.resolve(pdfFile);
      try {
        await access(inputPath);
      } catch {
        console.error(`Error: File not found: ${inputPath}`);
        process.exit(1);
      }

      // Step 3: Run pipeline
      const result = await runPipeline({ inputPath, dryRun: options.dryRun });

      // Step 4: Output result (D-04, D-05)
      // Metadata header to stderr
      console.error(
        `\nModel: ${result.model} | Tokens: ${result.inputTokens} in / ${result.outputTokens} out | Stop: ${result.stopReason}`,
      );

      // Markdown to stdout (pipeable, D-05)
      process.stdout.write(result.markdown);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program.parse();
