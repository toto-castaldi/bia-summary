import path from "node:path";
import type { ParsedFilename } from "./types.js";

/**
 * Parse the Bodygram input PDF filename to extract client name and date.
 * Pattern: "DD_MM_YYYY - Client Name - Report di stampa _ Bodygram.pdf"
 * This is the PRIMARY path per D-02.
 */
export function parseInputFilename(
  filename: string,
): ParsedFilename | null {
  const match = filename.match(
    /^(\d{2})_(\d{2})_(\d{4})\s*-\s*(.+?)\s*-\s*Report di stampa/i,
  );

  if (!match) return null;

  const [, day, month, year, clientName] = match;
  return {
    clientName: clientName.trim(),
    date: `${year}_${month}_${day}`,
  };
}

/**
 * Extract client name and date from Claude's markdown output.
 * FALLBACK path per D-02 when filename parsing fails.
 * Looks for "Nome: ..." and "Data esame: DD/MM/YYYY" patterns.
 */
export function extractFromMarkdown(
  markdown: string,
): ParsedFilename | null {
  const nameMatch = markdown.match(/\*?\*?Nome\*?\*?:\s*(.+)/i);

  if (!nameMatch) return null;

  const clientName = nameMatch[1].trim();

  const dateMatch = markdown.match(
    /\*?\*?Data\s*(?:esame|visita)?\*?\*?:\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/i,
  );

  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return {
      clientName,
      date: `${year}_${month.padStart(2, "0")}_${day.padStart(2, "0")}`,
    };
  }

  // Use current date if no date found in markdown
  const now = new Date();
  const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
  return { clientName, date: dateStr };
}

/**
 * Generate the output filename from parsed data.
 * Format: "YYYY_MM_DD - Client Name - Riassunto BIA.pdf" per D-03.
 */
export function generateOutputFilename(parsed: ParsedFilename): string {
  return `${parsed.date} - ${parsed.clientName} - Riassunto BIA.pdf`;
}

/**
 * Generate the full output path for the PDF.
 *
 * Resolution order (per D-02):
 * 1. If customOutputPath provided (--output flag, CLI-04), use it directly
 * 2. Try parseInputFilename on the input PDF filename (PRIMARY)
 * 3. Try extractFromMarkdown from Claude's output (FALLBACK)
 * 4. Use current date with generic name (LAST RESORT)
 *
 * Output is placed in the same directory as the input PDF per D-03.
 */
export function generateOutputPath(
  inputPath: string,
  markdown: string,
  customOutputPath?: string,
): string {
  if (customOutputPath) {
    return path.resolve(customOutputPath);
  }

  const inputDir = path.dirname(inputPath);
  const inputBasename = path.basename(inputPath);

  // Primary: parse input filename
  const fromFilename = parseInputFilename(inputBasename);
  if (fromFilename) {
    return path.join(inputDir, generateOutputFilename(fromFilename));
  }

  // Fallback: extract from markdown
  const fromMarkdown = extractFromMarkdown(markdown);
  if (fromMarkdown) {
    return path.join(inputDir, generateOutputFilename(fromMarkdown));
  }

  // Last resort: generic name with current date
  const now = new Date();
  const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
  return path.join(inputDir, `${dateStr} - Riassunto BIA.pdf`);
}
