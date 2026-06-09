import type { CategoryAnalysis, ProductInfo } from "../schemas/productSchemas.js";
import { generateStructured } from "./llm/llmClient.js";
import { CategoryAnalysisSchema } from "./llm/schemas.js";

export async function analyzeCategory(product: ProductInfo): Promise<CategoryAnalysis> {
  return generateStructured<CategoryAnalysis>({
    taskName: "category_analysis",
    schemaName: "CategoryAnalysis",
    schema: CategoryAnalysisSchema,
    mockResult: buildMockCategory(product),
    maxOutputTokens: 1400,
    systemPrompt: `你是一位资深 1688 商品分类专家、电商选品顾问和视觉创意策划。你需要基于 1688 商品标题、价格、图片描述、参数、详情文本和店铺信息，判断商品品类、使用场景、B2B 采购场景、C 端消费场景和视觉关键词。
你必须遵守：
1. 不编造页面没有提供的硬参数。
2. 如果信息不足，要在 riskNotes 中说明。
3. 如果商品是服装，要输出版型、材质、穿着场景、风格调性。
4. 如果商品不是服装，要输出材质、结构、使用方式、使用场景、视觉记忆点。
5. 如果 product.extractionStatus.usedMockData=true，要在判断中避免把 mock 数据误称为真实页面数据。
6. 输出必须严格符合 JSON Schema。
7. 不要输出 Markdown。
8. 不要解释过程。`,
    userPrompt: JSON.stringify({ product: sanitizeProduct(product) }, null, 2)
  });
}

export function buildMockCategory(product: ProductInfo): CategoryAnalysis {
  const text = `${product.title} ${product.tags.join(" ")}`;
  const isFashion = /女装|男装|童装|外套|夹克|裙|裤|衬衫|卫衣|穿搭/.test(text);
  const isRug = /地毯|地垫|脚垫|门垫|方块毯|carpet|rug|mat/i.test(text);

  if (isRug) {
    return {
      primaryCategory: "家居软装",
      secondaryCategory: "地毯地垫",
      productType: "拼接地毯 / 方块地垫",
      isFashionProduct: false,
      consumerScenario: "租房、卧室、办公室、直播间等低成本空间改造场景",
      b2bProcurementScenario: "跨境家居卖家、软装渠道、电商内容选品和办公室装修采购",
      visualKeywords: ["黑白棋盘格", "拼接铺设", "空间前后对比", "柔软织物纹理", "低机位触感"],
      materialKeywords: ["织物纹理", "地垫边缘", "拼接结构", "表面触感"],
      riskNotes: product.extractionStatus.usedMockData
        ? ["当前为 Mock 演示数据，不能表述为真实页面证明。", "页面未提供可读取评论。"]
        : ["页面未提供可读取评论。"]
    };
  }

  return {
    primaryCategory: isFashion ? "服装" : "综合商品",
    secondaryCategory: isFashion ? "穿搭单品" : "待细分品类",
    productType: isFashion ? "服饰商品" : "1688 商品",
    isFashionProduct: isFashion,
    consumerScenario: isFashion ? "通勤、出街、拍照和日常穿搭" : "基于商品使用方式延展消费者场景",
    b2bProcurementScenario: "电商卖家、内容电商选品方、渠道采购和小批量试单客户",
    visualKeywords: product.tags.slice(0, 6),
    materialKeywords: product.productFacts.map((fact) => fact.value).slice(0, 5),
    riskNotes: product.extractionStatus.usedMockData ? ["当前为 Mock 演示数据。"] : ["部分字段可能来自公开页面文本解析。"]
  };
}

function sanitizeProduct(product: ProductInfo) {
  return {
    ...product,
    rawDetailText: product.rawDetailText?.slice(0, 3000)
  };
}
