import { llmConfig } from "./config.js";
import { OpenOXResponsesClient } from "./openoxResponsesClient.js";
import type { LLMTaskName } from "./types.js";

const client = new OpenOXResponsesClient();

export async function generateStructured<T>(params: {
  taskName: LLMTaskName;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, any>;
  mockResult: T;
  maxOutputTokens?: number;
}): Promise<T> {
  const startedAt = Date.now();
  if (llmConfig.mockMode) {
    logLLM(params.taskName, startedAt, true);
    return params.mockResult;
  }

  try {
    const result = await client.generateJson<T>(params);
    logLLM(params.taskName, startedAt, false);
    return result;
  } catch (error) {
    logLLM(params.taskName, startedAt, false, error);
    if (llmConfig.fallbackToMock) {
      return params.mockResult;
    }
    throw error;
  }
}

export async function generatePlainText(params: {
  taskName: LLMTaskName;
  systemPrompt: string;
  userPrompt: string;
  mockResult: string;
  maxOutputTokens?: number;
}): Promise<string> {
  const startedAt = Date.now();
  if (llmConfig.mockMode) {
    logLLM(params.taskName, startedAt, true);
    return params.mockResult;
  }

  try {
    const result = await client.generateText(params);
    logLLM(params.taskName, startedAt, false);
    return result;
  } catch (error) {
    logLLM(params.taskName, startedAt, false, error);
    if (llmConfig.fallbackToMock) {
      return params.mockResult;
    }
    throw error;
  }
}

export async function generatePlainTextWithImages(params: {
  taskName: LLMTaskName;
  systemPrompt: string;
  userPrompt: string;
  imagePaths: string[];
  mockResult: string;
  model?: string;
  maxOutputTokens?: number;
}): Promise<string> {
  const startedAt = Date.now();
  if (llmConfig.mockMode) {
    logLLM(params.taskName, startedAt, true, undefined, params.model);
    return params.mockResult;
  }

  try {
    const result = await client.generateTextWithImages(params);
    logLLM(params.taskName, startedAt, false, undefined, params.model);
    return result;
  } catch (error) {
    logLLM(params.taskName, startedAt, false, error, params.model);
    if (llmConfig.fallbackToMock) {
      return params.mockResult;
    }
    throw error;
  }
}

export async function generateStructuredWithImages<T>(params: {
  taskName: LLMTaskName;
  systemPrompt: string;
  userPrompt: string;
  imagePaths: string[];
  schemaName: string;
  schema: Record<string, any>;
  mockResult: T;
  model?: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const startedAt = Date.now();
  if (llmConfig.mockMode) {
    logLLM(params.taskName, startedAt, true, undefined, params.model);
    return params.mockResult;
  }

  try {
    const result = await client.generateJsonWithImages<T>(params);
    logLLM(params.taskName, startedAt, false, undefined, params.model);
    return result;
  } catch (error) {
    logLLM(params.taskName, startedAt, false, error, params.model);
    if (llmConfig.fallbackToMock) {
      return params.mockResult;
    }
    throw error;
  }
}

function logLLM(taskName: LLMTaskName, startedAt: number, mock: boolean, error?: unknown, modelOverride?: string) {
  const durationMs = Date.now() - startedAt;
  const suffix = error instanceof Error ? ` error=${"code" in error ? String(error.code) : error.name}` : "";
  console.log(`[LLM] task=${taskName} provider=${llmConfig.provider} model=${modelOverride ?? llmConfig.model} durationMs=${durationMs} mock=${mock}${suffix}`);
}
