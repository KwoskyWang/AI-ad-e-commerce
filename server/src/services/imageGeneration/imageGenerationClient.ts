import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { imageGenerationConfig } from "./config.js";
import { publicURL, threeViewsDir } from "../garmentPaths.js";

export interface GeneratedImage {
  url: string;
  filename: string;
}

interface GenerateImageOptions {
  referenceImagePaths?: string[];
}

export class ImageGenerationClient {
  async generateImage(prompt: string, filename: string, reqBaseURL: string, options: GenerateImageOptions = {}): Promise<GeneratedImage> {
    if (!imageGenerationConfig.apiKey || imageGenerationConfig.mode === "mock") {
      throw new Error("Image generation is not configured.");
    }

    if (options.referenceImagePaths?.length) {
      try {
        return await this.generateImageEdit(prompt, filename, reqBaseURL, options.referenceImagePaths);
      } catch (error) {
        console.warn("[ImageGeneration] reference_generation_failed", {
          model: imageGenerationConfig.model,
          filename,
          referenceImageCount: options.referenceImagePaths.length,
          fallback: "mock",
          error: error instanceof Error ? error.message : "Unknown image edit error"
        });
        throw error;
      }
    }

    return this.generateImageFromText(prompt, filename, reqBaseURL);
  }

  private async generateImageFromText(prompt: string, filename: string, reqBaseURL: string): Promise<GeneratedImage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), imageGenerationConfig.timeoutMs);
    const startedAt = Date.now();
    const endpoint = `${imageGenerationConfig.baseURL.replace(/\/$/, "")}/images/generations`;
    console.log("[ImageGeneration] request_start", {
      model: imageGenerationConfig.model,
      endpoint,
      filename,
      inputMode: "text_only",
      timeoutMs: imageGenerationConfig.timeoutMs
    });
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${imageGenerationConfig.apiKey}`
        },
        body: JSON.stringify({
          model: imageGenerationConfig.model,
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        }),
        signal: controller.signal
      });

      console.log("[ImageGeneration] provider_response", {
        model: imageGenerationConfig.model,
        filename,
        status: response.status,
        durationMs: Date.now() - startedAt
      });

      if (!response.ok) {
        const errorText = await safeErrorText(response);
        throw new Error(`Image provider returned HTTP ${response.status}${errorText ? `: ${errorText}` : ""}`);
      }
      const data = await response.json() as any;
      return await saveProviderImage(data, filename, reqBaseURL, startedAt);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Image generation timed out after ${imageGenerationConfig.timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async generateImageEdit(prompt: string, filename: string, reqBaseURL: string, referenceImagePaths: string[]): Promise<GeneratedImage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), imageGenerationConfig.timeoutMs);
    const startedAt = Date.now();
    const endpoint = `${imageGenerationConfig.baseURL.replace(/\/$/, "")}/images/edits`;
    console.log("[ImageGeneration] request_start", {
      model: imageGenerationConfig.model,
      endpoint,
      filename,
      inputMode: "image_edit",
      referenceImageCount: referenceImagePaths.length,
      timeoutMs: imageGenerationConfig.timeoutMs
    });

    try {
      const formData = new FormData();
      formData.append("model", imageGenerationConfig.model);
      formData.append("prompt", prompt);
      formData.append("n", "1");
      formData.append("size", "1024x1024");
      formData.append("response_format", "b64_json");

      for (let index = 0; index < referenceImagePaths.length; index += 1) {
        const imagePath = referenceImagePaths[index];
        const bytes = await readFile(imagePath);
        const blob = new Blob([bytes], { type: mimeTypeForPath(imagePath) });
        formData.append("image", blob, `reference-${index + 1}${extensionForMime(blob.type)}`);
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${imageGenerationConfig.apiKey}`
        },
        body: formData,
        signal: controller.signal
      });

      console.log("[ImageGeneration] provider_response", {
        model: imageGenerationConfig.model,
        filename,
        endpoint,
        status: response.status,
        durationMs: Date.now() - startedAt
      });

      if (!response.ok) {
        const errorText = await safeErrorText(response);
        throw new Error(`Image edit provider returned HTTP ${response.status}${errorText ? `: ${errorText}` : ""}`);
      }

      const data = await response.json() as any;
      return await saveProviderImage(data, filename, reqBaseURL, startedAt);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Image edit timed out after ${imageGenerationConfig.timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function ensurePNG(filename: string): string {
  return filename.toLowerCase().endsWith(".png") ? filename : `${filename}.png`;
}

async function saveProviderImage(data: any, filename: string, reqBaseURL: string, startedAt: number): Promise<GeneratedImage> {
  const first = Array.isArray(data?.data) ? data.data[0] : undefined;
  if (typeof first?.b64_json === "string") {
    const outputName = ensurePNG(filename);
    await writeFile(path.join(threeViewsDir, outputName), Buffer.from(first.b64_json, "base64"));
    console.log("[ImageGeneration] image_saved", {
      filename: outputName,
      source: "b64_json",
      durationMs: Date.now() - startedAt
    });
    return { filename: outputName, url: publicURL(reqBaseURL, "/generated/three-views", outputName) };
  }
  if (typeof first?.url === "string") {
    console.log("[ImageGeneration] download_start", { filename, durationMs: Date.now() - startedAt });
    const imageResponse = await fetch(first.url);
    if (!imageResponse.ok) throw new Error("Failed to download generated image.");
    const outputName = ensurePNG(filename);
    await writeFile(path.join(threeViewsDir, outputName), Buffer.from(await imageResponse.arrayBuffer()));
    console.log("[ImageGeneration] image_saved", {
      filename: outputName,
      source: "url",
      durationMs: Date.now() - startedAt
    });
    return { filename: outputName, url: publicURL(reqBaseURL, "/generated/three-views", outputName) };
  }
  throw new Error("Image provider returned no usable image.");
}

function mimeTypeForPath(imagePath: string): string {
  switch (path.extname(imagePath).toLowerCase()) {
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

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return "";
  }
}
