import { ImageGenerationClient } from "./imageGenerationClient.js";
import { imageGenerationConfig } from "./config.js";
import { generateMockThreeViewSet, generateMockThreeViewSets } from "./mockThreeViewGenerator.js";
import type { GenerateThreeViewSetsParams, GenerateThreeViewSetsResult } from "./types.js";
import type { ThreeViewSet } from "../garmentTypes.js";

const client = new ImageGenerationClient();

interface ThreeViewStyle {
  id: string;
  title: string;
  description: string;
  tags: string[];
  style: string;
}

export async function generateThreeViewSets(params: GenerateThreeViewSetsParams): Promise<GenerateThreeViewSetsResult> {
  const startedAt = Date.now();
  try {
    console.log("[ThreeViewGeneration] start", {
      sessionId: params.sessionId,
      model: imageGenerationConfig.model,
      mode: imageGenerationConfig.mode,
      timeoutMs: imageGenerationConfig.timeoutMs
    });
    const styles: ThreeViewStyle[] = [
      { id: "set_1", title: "标准电商三视图", description: "一张图包含正面、侧面、背面，适合详情页和视频生成参考。", tags: ["标准", "商拍", "三视图"], style: "标准电商三视图，简洁背景，接近服装档口商拍效果，清楚展示正面、侧面和背面" }
    ];

    const sets = await Promise.all(styles.map((item) => generateSingleThreeViewSet(params, item, startedAt)));
    const mockCount = sets.filter((item) => item.isMock).length;

    console.log("[ThreeViewGeneration] done", {
      sessionId: params.sessionId,
      setCount: sets.length,
      realCount: sets.length - mockCount,
      mockCount,
      durationMs: Date.now() - startedAt
    });
    return {
      sets,
      generationStatus: {
        imageGenerationMode: mockCount === 0 ? "real_ai" : mockCount === sets.length ? "mock_fallback" : "partial_real_with_mock_fallback",
        usedMock: mockCount > 0,
        message: mockCount === 0
          ? "已使用 AI 生成三视图。"
          : mockCount === sets.length
            ? "图片生成服务暂时不可用，当前展示 Mock 演示三视图。"
            : `已生成 ${sets.length - mockCount} 张真实 AI 三视图，${mockCount} 张因超时使用 Mock 演示。`
      }
    };
  } catch (error) {
    console.warn("[ImageGeneration] fallback_to_mock=true", {
      sessionId: params.sessionId,
      model: imageGenerationConfig.model,
      mode: imageGenerationConfig.mode,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown image generation error"
    });
    if (!imageGenerationConfig.fallbackToMock) {
      throw error;
    }
    return generateMockThreeViewSets(params, error instanceof Error ? "图片生成服务暂时不可用" : "图片生成失败");
  }
}

async function generateSingleThreeViewSet(
  params: GenerateThreeViewSetsParams,
  item: ThreeViewStyle,
  startedAt: number
): Promise<ThreeViewSet> {
  try {
    console.log("[ThreeViewGeneration] set_start", { sessionId: params.sessionId, setId: item.id, title: item.title });
    const threeView = await client.generateImage(
      buildPrompt(params, item.style),
      `${params.sessionId}-${item.id}-three-view`,
      params.reqBaseURL,
      { referenceImagePaths: [params.frontImagePath, params.backImagePath] }
    );
    console.log("[ThreeViewGeneration] set_done", {
      sessionId: params.sessionId,
      setId: item.id,
      mode: "real_ai",
      durationMs: Date.now() - startedAt
    });
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      threeViewImageUrl: threeView.url,
      frontViewUrl: threeView.url,
      sideViewUrl: threeView.url,
      backViewUrl: threeView.url,
      styleTags: item.tags,
      generationMode: "real_ai",
      isMock: false,
      mockReason: null
    };
  } catch (error) {
    console.warn("[ThreeViewGeneration] set_fallback_to_mock", {
      sessionId: params.sessionId,
      setId: item.id,
      model: imageGenerationConfig.model,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown image generation error"
    });
    if (!imageGenerationConfig.fallbackToMock) {
      throw error;
    }
    return generateMockThreeViewSet(params, item, "该方案生成超时，已使用 Mock 演示三视图。");
  }
}

function buildPrompt(params: GenerateThreeViewSetsParams, style: string): string {
  const analysis = params.garmentAnalysis;
  return [
    "请直接生成一张完整的服装三视图成品图，不要生成三张独立图片，也不要输出拼图说明。",
    "这张图必须基于用户上传的服装正面照和反面照生成，正反面照片是主要参考，文字信息只用于辅助理解。",
    "最终画面必须是同一张图片，横向排列三个完整视图：左侧正面视图，中间侧面视图，右侧背面视图。",
    "三视图之间保持等宽间距，服装高度和比例一致，背景统一，像服装商品标准三视图排版。",
    `服装信息：${analysis.category}，${analysis.style}，${analysis.silhouette}，${analysis.color}，${analysis.materialGuess}。`,
    `关键细节：${analysis.keyDetails.join("、")}。`,
    `风格：${style}。`,
    "要求衣服平整，结构清晰，三个视图都完整可见，正面、侧面、背面区别明确；侧面视图应根据正反面照片合理推断，但不能改变服装品类和版型。",
    "必须保持原衣服的颜色、版型、长度、领口、袖口、下摆、扣子、拉链、图案和所有可见设计细节。",
    "不要新增品牌 logo，不要改变品类，不要改变衣长、袖长、裤长、裙长。",
    "背景简洁，光线均匀，适合电商详情页和 AI 视频生成参考。",
    "Negative Prompt: 衣服变形、颜色错误、图案错乱、凭空增加 logo、乱码文字、多余纽扣、错误拉链、袖子数量错误、衣长变化、版型变化、面料质感错误、低清晰度、过度卡通、边缘破碎、比例异常、背景过于复杂、主体不完整。"
  ].join("\n");
}
