import type { GarmentAnalysis } from "./garmentTypes.js";
import { llmConfig } from "./llm/config.js";
import { generateStructuredWithImages } from "./llm/llmClient.js";
import { GarmentAnalysisSchema } from "./llm/schemas.js";

export async function analyzeGarmentFromPhotos(params: {
  frontImagePath: string;
  backImagePath: string;
}): Promise<GarmentAnalysis> {
  return generateStructuredWithImages<GarmentAnalysis>({
    taskName: "garment_vision_analysis",
    schemaName: "GarmentAnalysis",
    schema: GarmentAnalysisSchema,
    imagePaths: [params.frontImagePath, params.backImagePath],
    model: llmConfig.visionModel,
    mockResult: mockGarmentAnalysis(),
    maxOutputTokens: 1200,
    systemPrompt: `你是一位资深服装版师、服装买手、四季青档口电商视觉顾问。你需要根据用户上传的衣服正面照和反面照，判断这件衣服的品类、款式、廓形、颜色、可能的材质、关键细节和适合视频展示的重点。
你必须遵守：
1. 只能基于图片可见信息判断；
2. 不要编造品牌、logo、吊牌、面料成分；
3. 不确定的地方要写入 riskNotes；
4. 如果看不清，明确说明；
5. 输出必须严格符合 JSON Schema；
6. 不要输出 Markdown；
7. 不要解释思考过程。`,
    userPrompt: "请分析这件服装的正面照和反面照，输出结构化 JSON。"
  });
}

export function mockGarmentAnalysis(): GarmentAnalysis {
  return {
    category: "女装外套",
    style: "通勤休闲，适合档口上新和短视频展示",
    silhouette: "略宽松直筒版型",
    color: "深色系，从图片看可能接近黑色或深灰色",
    materialGuess: "从图片看可能是梭织或皮感面料，具体成分页面未提供",
    keyDetails: ["正反面轮廓清楚", "肩线和袖型需要重点展示", "下摆长度影响上身比例", "细节需用近景确认"],
    displayFocus: ["正面整体版型", "背面轮廓", "袖口和领口细节", "侧面厚度和垂感", "模特转身时的上身效果"],
    riskNotes: ["当前为默认分析结果；如果图片不清晰，材质和颜色可能需要人工确认。"]
  };
}
