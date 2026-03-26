export interface AppConfig {
  anthropicKey: string;
  cloudConvertKey: string;
}

export interface PipelineOptions {
  inputPath: string;
  dryRun: boolean;
  outputPath?: string;
}

export interface ParsedFilename {
  clientName: string;
  date: string; // YYYY_MM_DD format
}

export interface AnalysisResult {
  markdown: string;
  stopReason: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}
