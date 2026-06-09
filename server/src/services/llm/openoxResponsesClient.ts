import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { llmConfig } from "./config.js";
import { LLMProviderError } from "./types.js";

interface GenerateJsonParams {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, any>;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GenerateTextParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GenerateJsonWithImagesParams extends GenerateJsonParams {
  imagePaths: string[];
  model?: string;
}

interface GenerateTextWithImagesParams extends GenerateTextParams {
  imagePaths: string[];
  model?: string;
}

export class OpenOXResponsesClient {
  async generateJson<T>(params: GenerateJsonParams): Promise<T> {
    try {
      const text = await this.requestText({
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        textFormat: {
          type: "json_schema",
          name: params.schemaName,
          strict: true,
          schema: params.schema
        }
      });
      return parseJson<T>(text);
    } catch (error) {
      if (error instanceof LLMProviderError && error.code === "LLM_PROVIDER_ERROR") {
        const text = await this.requestText({
          systemPrompt: params.systemPrompt,
          userPrompt: `${params.userPrompt}\n\n请只返回严格 JSON，不要 Markdown，不要解释，不要代码块。`,
          maxOutputTokens: params.maxOutputTokens,
          temperature: params.temperature,
          textFormat: { type: "json_object" }
        });
        return parseJson<T>(text);
      }
      throw error;
    }
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    return this.requestText({
      ...params,
      textFormat: { type: "text" }
    });
  }

  async generateTextWithImages(params: GenerateTextWithImagesParams): Promise<string> {
    const images = await Promise.all(params.imagePaths.map(pathToDataURL));
    return this.requestText({
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      maxOutputTokens: params.maxOutputTokens,
      temperature: params.temperature,
      model: params.model ?? llmConfig.visionModel,
      imageDataURLs: images,
      textFormat: { type: "text" }
    });
  }

  async generateJsonWithImages<T>(params: GenerateJsonWithImagesParams): Promise<T> {
    try {
      const images = await Promise.all(params.imagePaths.map(pathToDataURL));
      const text = await this.requestText({
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        model: params.model ?? llmConfig.visionModel,
        imageDataURLs: images,
        textFormat: {
          type: "json_schema",
          name: params.schemaName,
          strict: true,
          schema: params.schema
        }
      });
      return parseJson<T>(text);
    } catch (error) {
      if (error instanceof LLMProviderError && error.code === "LLM_PROVIDER_ERROR") {
        const images = await Promise.all(params.imagePaths.map(pathToDataURL));
        const text = await this.requestText({
          systemPrompt: params.systemPrompt,
          userPrompt: `${params.userPrompt}\n\n请只返回严格 JSON，不要 Markdown，不要解释，不要代码块。`,
          maxOutputTokens: params.maxOutputTokens,
          temperature: params.temperature,
          model: params.model ?? llmConfig.visionModel,
          imageDataURLs: images,
          textFormat: { type: "json_object" }
        });
        return parseJson<T>(text);
      }
      throw error;
    }
  }

  private async requestText(params: GenerateTextParams & { textFormat: Record<string, any>; model?: string; imageDataURLs?: string[] }): Promise<string> {
    if (!llmConfig.apiKey) {
      throw new LLMProviderError({
        code: "LLM_PROVIDER_ERROR",
        message: "LLM API key is not configured.",
        provider: llmConfig.provider,
        model: params.model ?? llmConfig.model
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), llmConfig.timeoutMs);
    const userContent = [
      { type: "input_text", text: params.userPrompt },
      ...(params.imageDataURLs ?? []).map((imageURL) => ({ type: "input_image", image_url: imageURL }))
    ];
    const body = {
      model: params.model ?? llmConfig.model,
      store: llmConfig.store,
      reasoning: {
        effort: llmConfig.reasoningEffort
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: params.systemPrompt }]
        },
        {
          role: "user",
          content: userContent
        }
      ],
      text: {
        format: params.textFormat
      },
      ...(params.maxOutputTokens ? { max_output_tokens: params.maxOutputTokens } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {})
    };

    try {
      const response = await fetch(`${llmConfig.baseURL.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new LLMProviderError({
          code: "LLM_PROVIDER_ERROR",
          message: `LLM provider returned HTTP ${response.status}.`,
          provider: llmConfig.provider,
          model: params.model ?? llmConfig.model,
          status: response.status
        });
      }

      const data = (await response.json()) as any;
      const text = extractOutputText(data);
      if (!text) {
        throw new LLMProviderError({
          code: "LLM_EMPTY_RESPONSE",
          message: "LLM provider returned an empty response.",
          provider: llmConfig.provider,
          model: params.model ?? llmConfig.model
        });
      }
      return text;
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMProviderError({
          code: "LLM_TIMEOUT",
          message: "LLM request timed out.",
          provider: llmConfig.provider,
          model: params.model ?? llmConfig.model
        });
      }
      throw new LLMProviderError({
        code: "LLM_PROVIDER_ERROR",
        message: error instanceof Error ? error.message : "LLM provider request failed.",
        provider: llmConfig.provider,
        model: params.model ?? llmConfig.model
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function pathToDataURL(path: string): Promise<string> {
  const bytes = await readFile(path);
  if (bytes.byteLength > 12 * 1024 * 1024) {
    throw new LLMProviderError({
      code: "LLM_PROVIDER_ERROR",
      message: "Image is too large for vision input.",
      provider: llmConfig.provider,
      model: llmConfig.visionModel
    });
  }
  return `data:${mimeTypeForPath(path)};base64,${bytes.toString("base64")}`;
}

function mimeTypeForPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}

function extractOutputText(response: any): string | undefined {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }

  return undefined;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const extracted = extractFirstJsonObject(text);
    if (extracted) {
      try {
        return JSON.parse(extracted) as T;
      } catch {
        // Fall through to sanitized error.
      }
    }
    throw new LLMProviderError({
      code: "LLM_JSON_PARSE_ERROR",
      message: "Failed to parse LLM JSON response.",
      provider: llmConfig.provider,
      model: llmConfig.model
    });
  }
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return null;
}
