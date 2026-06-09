import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BackgroundAsset } from "./garmentTypes.js";
import { backgroundsDir, publicURL } from "./garmentPaths.js";

const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const fallbackName = "default-studio-background.svg";

export async function getRandomBackground(reqBaseURL: string): Promise<BackgroundAsset> {
  const files = await listBackgroundFiles();
  if (files.length > 0) {
    const filename = files[Math.floor(Math.random() * files.length)];
    return {
      id: `background_${path.parse(filename).name}`,
      filename,
      url: publicURL(reqBaseURL, "/assets/backgrounds", filename),
      isFallback: false
    };
  }

  await writeFallbackBackground();
  return {
    id: "background_default",
    filename: fallbackName,
    url: publicURL(reqBaseURL, "/assets/backgrounds", fallbackName),
    isFallback: true
  };
}

async function listBackgroundFiles(): Promise<string[]> {
  try {
    const entries = await readdir(backgroundsDir);
    return entries.filter((file) => supportedExtensions.has(path.extname(file).toLowerCase()));
  } catch {
    return [];
  }
}

async function writeFallbackBackground() {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F5F1EA"/>
      <stop offset="0.55" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#E8E1DA"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="120" y="220" width="840" height="1480" rx="70" fill="#ffffff" opacity="0.34" stroke="#d9d0c7"/>
  <text x="540" y="980" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="46" font-weight="700" fill="#171412">默认服装拍摄背景</text>
</svg>`.trim();
  await writeFile(path.join(backgroundsDir, fallbackName), svg, "utf8");
}
