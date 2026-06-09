import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateThreeViewSetsParams, GenerateThreeViewSetsResult } from "./types.js";
import type { ThreeViewSet } from "../garmentTypes.js";
import { publicURL, threeViewsDir } from "../garmentPaths.js";

export async function generateMockThreeViewSets(params: GenerateThreeViewSetsParams, mockReason = "图片生成服务暂时不可用"): Promise<GenerateThreeViewSetsResult> {
  const variants = [
    { id: "set_1", title: "标准电商三视图", description: "一张图包含正面、侧面、背面，适合详情页和视频生成参考。", tags: ["标准", "商拍", "三视图"] }
  ];

  const sets = await Promise.all(variants.map(async (variant) => {
    const threeViewName = `${params.sessionId}-${variant.id}-three-view.svg`;
    await writeFile(path.join(threeViewsDir, threeViewName), threeViewPlaceholderSVG(variant.title, params.garmentAnalysis), "utf8");
    const threeViewUrl = publicURL(params.reqBaseURL, "/generated/three-views", threeViewName);

    return {
      id: variant.id,
      title: variant.title,
      description: variant.description,
      threeViewImageUrl: threeViewUrl,
      frontViewUrl: threeViewUrl,
      sideViewUrl: threeViewUrl,
      backViewUrl: threeViewUrl,
      styleTags: variant.tags,
      generationMode: "mock_fallback",
      isMock: true,
      mockReason
    };
  }));

  return {
    sets,
    generationStatus: {
      imageGenerationMode: "mock_fallback",
      usedMock: true,
      message: "图片生成服务暂时不可用，当前展示 Mock 演示三视图。"
    }
  };
}

export async function generateMockThreeViewSet(
  params: GenerateThreeViewSetsParams,
  variant: { id: string; title: string; description: string; tags: string[] },
  mockReason = "图片生成服务暂时不可用"
): Promise<ThreeViewSet> {
  const threeViewName = `${params.sessionId}-${variant.id}-three-view.svg`;
  await writeFile(path.join(threeViewsDir, threeViewName), threeViewPlaceholderSVG(variant.title, params.garmentAnalysis), "utf8");
  const threeViewUrl = publicURL(params.reqBaseURL, "/generated/three-views", threeViewName);

  return {
    id: variant.id,
    title: variant.title,
    description: variant.description,
    threeViewImageUrl: threeViewUrl,
    frontViewUrl: threeViewUrl,
    sideViewUrl: threeViewUrl,
    backViewUrl: threeViewUrl,
    styleTags: variant.tags,
    generationMode: "mock_fallback",
    isMock: true,
    mockReason
  };
}

function threeViewPlaceholderSVG(title: string, analysis: { category: string; silhouette: string; color: string }): string {
  const safeTitle = escapeXML(title);
  const details = escapeXML(`${analysis.category} · ${analysis.silhouette} · ${analysis.color}`);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#F5F1EA"/>
  <rect x="80" y="80" width="1440" height="760" rx="44" fill="#ffffff" opacity="0.86" stroke="#d8d1c8"/>
  <g transform="translate(230 190)">
    <text x="0" y="-40" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="34" font-weight="700" fill="#171412">正面</text>
    <path d="M-80 80 C-118 150 -124 310 -104 455 L-78 620 C-54 655 54 655 78 620 L104 455 C124 310 118 150 80 80 L35 38 C10 58 -10 58 -35 38 Z" fill="#1f1d1a" opacity="0.9"/>
    <path d="M0 60 L0 625" stroke="#f5f1ea" stroke-width="8" opacity="0.58"/>
  </g>
  <g transform="translate(800 190)">
    <text x="0" y="-40" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="34" font-weight="700" fill="#171412">侧面</text>
    <path d="M-28 70 C-76 150 -88 330 -66 510 L-44 630 C-22 655 44 655 60 620 L72 480 C88 310 72 145 28 70 Z" fill="#1f1d1a" opacity="0.86"/>
    <path d="M0 70 C-8 250 -6 460 16 625" stroke="#f5f1ea" stroke-width="8" opacity="0.58"/>
  </g>
  <g transform="translate(1370 190)">
    <text x="0" y="-40" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="34" font-weight="700" fill="#171412">背面</text>
    <path d="M-82 82 C-116 168 -126 332 -106 458 L-80 620 C-54 656 54 656 80 620 L106 458 C126 332 116 168 82 82 L36 38 C10 58 -10 58 -36 38 Z" fill="#1f1d1a" opacity="0.9"/>
    <path d="M-48 105 C-20 130 20 130 48 105" stroke="#f5f1ea" stroke-width="8" fill="none" opacity="0.58"/>
  </g>
  <text x="800" y="900" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="38" font-weight="700" fill="#11100f">三视图 Mock 演示</text>
  <text x="800" y="948" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="25" fill="#6a6259">${safeTitle} · ${details}</text>
</svg>`.trim();
}

function escapeXML(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "\"": return "&quot;";
      case "'": return "&apos;";
      default: return char;
    }
  });
}
