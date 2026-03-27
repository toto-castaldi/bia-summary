import { z } from "zod";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import type { AppConfig, TemplateVars } from "./types.js";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  CLOUDCONVERT_API_KEY: z.string().min(1, "CLOUDCONVERT_API_KEY is required"),
});

export function validateEnv(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join("."));
    console.error(`Missing required API keys: ${missing.join(", ")}`);
    console.error(
      "Set them in a .env file (working directory) or as environment variables."
    );
    process.exit(1);
  }
  return {
    anthropicKey: result.data.ANTHROPIC_API_KEY,
    cloudConvertKey: result.data.CLOUDCONVERT_API_KEY,
  };
}

export async function loadPrompt(
  pdfPath: string,
  templateVars?: TemplateVars,
): Promise<string> {
  const resolvedPdfPath = path.resolve(pdfPath);
  const promptPath = path.join(path.dirname(resolvedPdfPath), "prompt.txt");

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

  let content = await readFile(promptPath, "utf-8");

  if (templateVars?.clientName) {
    content = content.replaceAll("{{CLIENT_NAME}}", templateVars.clientName);
  }
  if (templateVars?.examDate) {
    const [y, m, d] = templateVars.examDate.split("_");
    content = content.replaceAll("{{EXAM_DATE}}", `${d}/${m}/${y}`);
  }

  return content;
}
