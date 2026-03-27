import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import type { AnalysisResult } from "../types.js";

export async function analyzePdf(
  pdfPath: string,
  promptContent: string,
): Promise<AnalysisResult> {
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  const client = new Anthropic({ maxRetries: 3 });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
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
          {
            type: "text",
            text: promptContent,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text response");
  }

  return {
    markdown: textBlock.text,
    stopReason: response.stop_reason ?? "unknown",
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
