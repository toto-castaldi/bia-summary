import { loadPrompt } from "./config.js";
import { analyzePdf } from "./clients/claude.js";
import { convertMarkdownToPdf } from "./clients/cloudconvert.js";
import { generateOutputPath } from "./filename.js";
import { writeFile } from "node:fs/promises";
import type { PipelineOptions, AnalysisResult, AppConfig } from "./types.js";
import ora from "ora";

function validateResponse(result: AnalysisResult): void {
  // Truncation check (D-10)
  if (result.stopReason === "max_tokens") {
    console.error(
      "WARNING: Response was truncated (stop_reason: max_tokens). Summary may be incomplete.",
    );
  }

  // Math validation (D-09) -- best-effort regex extraction
  const { markdown } = result;

  // Extract FM (fat mass) in kg
  const fmMatch = markdown.match(
    /(?:massa grassa|FM|fat mass)[^0-9]*?(\d+[.,]\d+)\s*kg/i,
  );
  // Extract FFM (fat-free mass) in kg
  const ffmMatch = markdown.match(
    /(?:massa magra|FFM|fat-free mass)[^0-9]*?(\d+[.,]\d+)\s*kg/i,
  );
  // Extract body weight in kg
  const weightMatch = markdown.match(
    /(?:peso|weight)[^0-9]*?(\d+[.,]\d+)\s*kg/i,
  );

  if (fmMatch && ffmMatch && weightMatch) {
    const fm = parseFloat(fmMatch[1].replace(",", "."));
    const ffm = parseFloat(ffmMatch[1].replace(",", "."));
    const weight = parseFloat(weightMatch[1].replace(",", "."));
    const sum = fm + ffm;
    const diff = Math.abs(sum - weight);

    if (diff > 1.0) {
      console.error(
        `WARNING: Math check failed -- FM (${fm.toFixed(1)} kg) + FFM (${ffm.toFixed(1)} kg) = ${sum.toFixed(1)} kg, but body weight is ${weight.toFixed(1)} kg (difference: ${diff.toFixed(1)} kg)`,
      );
    }
  }

  // Extract TBW, ECW, ICW for water balance validation
  const tbwMatch = markdown.match(
    /(?:TBW|acqua totale|total body water)[^0-9]*?(\d+[.,]\d+)\s*(?:kg|l)/i,
  );
  const ecwMatch = markdown.match(
    /(?:ECW|acqua extracellulare|extracellular water)[^0-9]*?(\d+[.,]\d+)\s*(?:kg|l)/i,
  );
  const icwMatch = markdown.match(
    /(?:ICW|acqua intracellulare|intracellular water)[^0-9]*?(\d+[.,]\d+)\s*(?:kg|l)/i,
  );

  if (tbwMatch && ecwMatch && icwMatch) {
    const tbw = parseFloat(tbwMatch[1].replace(",", "."));
    const ecw = parseFloat(ecwMatch[1].replace(",", "."));
    const icw = parseFloat(icwMatch[1].replace(",", "."));
    const sum = ecw + icw;
    const diff = Math.abs(tbw - sum);

    if (diff > 0.5) {
      console.error(
        `WARNING: Math check failed -- ECW (${ecw.toFixed(1)} kg) + ICW (${icw.toFixed(1)} kg) = ${sum.toFixed(1)} kg, but TBW is ${tbw.toFixed(1)} kg`,
      );
    }
  }
}

export async function runPipeline(
  options: PipelineOptions,
  config: AppConfig,
): Promise<AnalysisResult> {
  // Step 1: Start spinner (to stderr per D-05)
  const spinner = ora({
    text: "Loading prompt...",
    stream: process.stderr,
  }).start();

  // Step 2: Load prompt from PDF's directory (D-01)
  const prompt = await loadPrompt(options.inputPath);
  spinner.text = "Analyzing BIA report with Claude...";

  // Step 3: Analyze PDF
  const result = await analyzePdf(options.inputPath, prompt);

  // Step 4: Validate response (D-09, D-10)
  validateResponse(result);

  // Step 5: Convert to PDF if not dry-run
  if (options.dryRun) {
    spinner.succeed("Analysis complete");
  } else {
    const outputPath = generateOutputPath(
      options.inputPath,
      result.markdown,
      options.outputPath,
    );

    spinner.text = "Converting to PDF via CloudConvert...";

    try {
      const pdfBuffer = await convertMarkdownToPdf(
        result.markdown,
        config.cloudConvertKey,
      );
      await writeFile(outputPath, pdfBuffer);
      spinner.succeed(`PDF saved: ${outputPath}`);
    } catch (error) {
      // D-07: On CloudConvert failure, save markdown as fallback
      const mdPath = outputPath.replace(/\.pdf$/i, ".md");
      await writeFile(mdPath, result.markdown, "utf-8");
      spinner.fail(
        `PDF conversion failed: ${error instanceof Error ? error.message : String(error)}\n` +
        `  Markdown saved as fallback: ${mdPath}`,
      );
    }
  }

  // Step 6: Return result
  return result;
}
