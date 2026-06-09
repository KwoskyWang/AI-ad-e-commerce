import { mkdir } from "node:fs/promises";
import path from "node:path";

export const serverRoot = path.resolve(process.cwd());
export const garmentUploadsDir = path.join(serverRoot, "uploads", "garments");
export const threeViewsDir = path.join(serverRoot, "generated", "three-views");
export const backgroundsDir = path.join(serverRoot, "assets", "backgrounds");
export const modelsDir = path.join(serverRoot, "assets", "models");
export const dataDir = path.join(serverRoot, "data");
export const garmentSessionsPath = path.join(dataDir, "garment-sessions.json");
export const deviceUsagePath = path.join(dataDir, "device-usage.json");

export async function ensureRuntimeDirs() {
  await Promise.all([
    mkdir(garmentUploadsDir, { recursive: true }),
    mkdir(threeViewsDir, { recursive: true }),
    mkdir(backgroundsDir, { recursive: true }),
    mkdir(modelsDir, { recursive: true }),
    mkdir(dataDir, { recursive: true })
  ]);
}

export function publicURL(reqBaseURL: string, route: string, filename: string): string {
  return `${reqBaseURL}${route}/${encodeURIComponent(filename)}`;
}
