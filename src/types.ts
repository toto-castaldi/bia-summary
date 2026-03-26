export interface AppConfig {
  anthropicKey: string;
  cloudConvertKey: string;
}

export interface PipelineOptions {
  inputPath: string;
  dryRun: boolean;
}

export interface AnalysisResult {
  markdown: string;
  stopReason: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}
