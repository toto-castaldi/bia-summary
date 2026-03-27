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
  .option("-o, --output <path>", "Custom output path for the generated PDF")
  .option("--verbose", "Show step-by-step progress logging", false)
  .action(async (pdfFile: string, options: { dryRun: boolean; output?: string; verbose: boolean }) => {
    try {
      // Step 1: Validate environment (D-07, D-08)
      const config = validateEnv();

      // Step 2: Validate PDF file exists
      const inputPath = path.resolve(pdfFile);
      try {
        await access(inputPath);
      } catch {
        console.error(`Error: File not found: ${inputPath}`);
        process.exit(1);
      }

      // Step 3: Run pipeline
      const result = await runPipeline(
        {
          inputPath,
          dryRun: options.dryRun,
          verbose: options.verbose,
          outputPath: options.output ? path.resolve(options.output) : undefined,
        },
        config,
      );

      // Step 4: Output result (D-04, D-05)
      // Always show metadata to stderr
      console.error(
        `\nModel: ${result.model} | Tokens: ${result.inputTokens} in / ${result.outputTokens} out | Stop: ${result.stopReason}`,
      );

      // Markdown to stdout only in dry-run mode (D-05)
      if (options.dryRun) {
        process.stdout.write(result.markdown);
      }
    } catch (error) {
      // Pipeline spinner.fail already displayed user-friendly message for API errors.
      // Show error here for non-pipeline failures (file access, etc.)
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
