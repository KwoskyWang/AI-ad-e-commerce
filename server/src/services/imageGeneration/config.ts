import { llmConfig } from "../llm/config.js";

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["true", "1", "yes", "y"].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export const imageGenerationConfig = {
  baseURL: llmConfig.baseURL,
  apiKey: process.env.OPENOX_IMAGE_API_KEY || process.env.IMAGE_GENERATION_API_KEY || "",
  model: process.env.IMAGE_GENERATION_MODEL || "gpt-image-1",
  mode: process.env.IMAGE_GENERATION_MODE || "real",
  fallbackToMock: parseBoolean(process.env.IMAGE_GENERATION_FALLBACK_TO_MOCK, true),
  timeoutMs: parseNumber(process.env.IMAGE_GENERATION_TIMEOUT_MS, 180000),
  concurrency: Math.max(1, Math.min(4, parseNumber(process.env.IMAGE_GENERATION_CONCURRENCY, 2)))
};
