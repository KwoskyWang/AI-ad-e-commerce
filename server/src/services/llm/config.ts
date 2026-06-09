import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(serverRoot, ".env"), override: true });

export const llmConfig = {
  provider: process.env.AI_PROVIDER || "openox",
  baseURL: process.env.OPENOX_BASE_URL || "https://openox.tech/v1",
  apiKey: process.env.OPENOX_API_KEY || "",
  model: process.env.OPENOX_MODEL || "gpt-5.5",
  visionModel: process.env.VISION_MODEL || process.env.OPENOX_MODEL || "gpt-5.5",
  reasoningEffort: process.env.OPENOX_REASONING_EFFORT || "high",
  store: parseBoolean(process.env.OPENOX_STORE, false),
  timeoutMs: parseNumber(process.env.OPENOX_TIMEOUT_MS, 120000),
  mockMode: parseBoolean(process.env.LLM_MOCK_MODE, false) || !process.env.OPENOX_API_KEY,
  fallbackToMock: parseBoolean(process.env.LLM_FALLBACK_TO_MOCK, true)
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["true", "1", "yes", "y"].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
