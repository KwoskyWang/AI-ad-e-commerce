import type { CategoryAnalysis, ProductInfo } from "../schemas/productSchemas.js";
import { generateStructured } from "./llm/llmClient.js";
import { SellingPointExtractionSchema } from "./llm/schemas.js";

export interface SellingPointExtractionResult {
  sellingPoints: string[];
  procurementInsights: string[];
  visualSellingPoints: string[];
  riskNotes: string[];
}

export async function extractSellingPoints(product: ProductInfo, category?: CategoryAnalysis): Promise<SellingPointExtractionResult> {
  const mockResult = buildMockSellingPoints(product);
  return generateStructured<SellingPointExtractionResult>({
    taskName: "selling_point_extraction",
    schemaName: "SellingPointExtraction",
    schema: SellingPointExtractionSchema,
    mockResult,
    maxOutputTokens: 1800,
    systemPrompt: `你是一位 1688 商品卖点提炼专家和商业视觉策划。你需要把页面原始标题、参数、详情文本压缩成短卖点、采购洞察和可用于图像/视频表现的视觉卖点。
要求：
1. 每条 sellingPoint 不超过 40 个中文字。
2. procurementInsights 更偏 B2B 采购。
3. visualSellingPoints 更偏图像和视频表现。
4. 不编造真实评论。
5. 不编造确定的材质/规格。
6. 如果页面没有提供，只能说“页面未明确”。
7. 如果 product.extractionStatus.usedMockData=true，不要把 mock 数据说成真实页面数据。
8. 输出严格 JSON，不要 Markdown，不要解释过程。`,
    userPrompt: JSON.stringify({ product: sanitizeProduct(product), category }, null, 2)
  });
}

export function buildMockSellingPoints(product: ProductInfo): SellingPointExtractionResult {
  const text = `${product.title} ${product.tags.join(" ")}`;
  const isRug = /地毯|地垫|门垫|脚垫|方块毯|rug|carpet|mat/i.test(text);
  if (isRug) {
    return {
      sellingPoints: [
        "低成本快速改变空间氛围",
        "黑白棋盘格自带视觉记忆点",
        "免胶拼接，适合租房改造",
        "可按面积自由组合",
        "适合拍摄前后对比短视频",
        "单价低，具备批发优势"
      ],
      procurementInsights: [
        "适合软装卖家、跨境家居卖家和办公室装修采购。",
        "价格区间低，适合以低成本空间改造做核心卖点。",
        "采购方可能关注厚度、防滑、耐脏和拼接稳定性。",
        "用于 C 端广告时，应弱化批发属性，强化生活方式。"
      ],
      visualSellingPoints: ["铺设前后对比", "黑白图案冲击", "地垫边缘厚度", "脚踩柔软感", "小动物互动"],
      riskNotes: ["页面未提供可直接读取的评论数据。"]
    };
  }

  return {
    sellingPoints: compactSellingPoints(product).slice(0, 6),
    procurementInsights: compactProcurementInsights(product).slice(0, 6),
    visualSellingPoints: product.tags.slice(0, 6),
    riskNotes: product.extractionStatus.usedMockData ? ["当前为 Mock 演示数据。"] : []
  };
}

function compactSellingPoints(product: ProductInfo): string[] {
  const title = product.title;
  const tags = product.tags.join("、");
  const points = [
    /女装|外套|斗篷|毛呢|服装/.test(`${title} ${tags}`) ? "斗篷外套轮廓适合镜头展示" : undefined,
    /收腰|绑带/.test(title) ? "收腰绑带可突出腰线变化" : undefined,
    /冬季|毛呢/.test(title) ? "冬季毛呢质感适合近景表现" : undefined,
    /跨境|亚马逊/.test(title) ? "适合跨境女装店铺选品" : undefined,
    product.price ? `价格区间 ${product.price} 便于测款` : undefined,
    tags ? `${tags} 可作为内容标签` : undefined
  ].filter((value): value is string => Boolean(value));

  return points.length > 0
    ? points
    : product.sellingPoints.map((point) => point.length > 40 ? `${point.slice(0, 39)}…` : point);
}

function compactProcurementInsights(product: ProductInfo): string[] {
  return [
    product.price ? `价格吸引点：${product.price} 适合小批量测款。` : "价格吸引点：页面未明确，需要结合规格判断。",
    product.shopName || product.companyName ? "批发采购价值：可围绕供应商稳定性继续评估。" : "批发采购价值：页面店铺信息需继续核验。",
    "使用场景：可延展为通勤、出街、冬季穿搭内容。",
    "潜在顾虑：需关注面料厚度、尺码稳定性和色差。",
    "适合客户类型：跨境女装卖家、直播间和内容电商选品。",
    "广告情绪点：突出优雅轮廓和冬季氛围感。"
  ];
}

function sanitizeProduct(product: ProductInfo) {
  return {
    ...product,
    rawDetailText: product.rawDetailText?.slice(0, 3000)
  };
}
