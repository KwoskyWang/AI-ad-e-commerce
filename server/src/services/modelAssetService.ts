import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ModelAsset } from "./garmentTypes.js";
import { modelsDir, publicURL } from "./garmentPaths.js";

const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export interface ModelAssetWithPath extends ModelAsset {
  localPath: string;
}

export async function getRandomModelAsset(reqBaseURL: string): Promise<ModelAssetWithPath> {
  const files = await listModelFiles();
  if (files.length === 0) {
    const error = new Error("请先把模特照片放到 server/assets/models。") as Error & { code: string; status: number };
    error.code = "MODEL_ASSET_NOT_FOUND";
    error.status = 400;
    throw error;
  }

  const filename = files[Math.floor(Math.random() * files.length)];
  return {
    id: `model_${path.parse(filename).name}`,
    filename,
    url: publicURL(reqBaseURL, "/assets/models", filename),
    localPath: path.join(modelsDir, filename),
    isFallback: false
  };
}

async function listModelFiles(): Promise<string[]> {
  try {
    const entries = await readdir(modelsDir);
    return entries.filter((file) => supportedExtensions.has(path.extname(file).toLowerCase()));
  } catch {
    return [];
  }
}
