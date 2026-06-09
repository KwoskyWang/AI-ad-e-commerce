import { randomUUID } from "node:crypto";
import type { ProductInfo } from "../schemas/productSchemas.js";
import type { Platform } from "../utils/url.js";
import { detectPlatform, platformLabel } from "../utils/url.js";
import { fetchFirstReadablePage } from "./httpFetcher.js";
import { parseProductFromHtml } from "./htmlProductParser.js";

const IMAGE_BASE = "https://images.unsplash.com";

export async function extractGenericProduct(url: URL): Promise<ProductInfo> {
  const platform = detectPlatform(url);
  const { page } = await fetchFirstReadablePage([url]);
  if (page) {
    const parsed = parseProductFromHtml(page.html, {
      sourceUrl: url.toString(),
      platform
    });
    if (parsed) return parsed;
  }

  return buildMockProduct(url, platform);
}

export function buildMockProduct(url: URL, platform: Platform): ProductInfo {
  const id = randomUUID();
  if (platform === "1688") {
    return {
      id,
      sourceUrl: url.toString(),
      normalizedUrl: url.toString(),
      platform: "1688",
      platformProductId: url.pathname.match(/(\d{5,})/)?.[1] ?? url.searchParams.get("id") ?? undefined,
      title: "跨境批发拼接地毯免胶粘贴地垫全铺地毯整铺方块毯办公室满铺地垫",
      price: "¥1.85-7.50",
      minOrderQuantity: "按规格起批",
      shopName: "义乌市熙然装饰材料有限公司",
      companyName: "义乌市熙然装饰材料有限公司",
      locationText: "浙江 金华",
      categoryText: "家居软装 / 地毯地垫",
      coverImageUrl: `${IMAGE_BASE}/photo-1600166898405-da9535204843?auto=format&fit=crop&w=1200&q=85`,
      imageUrls: [
        `${IMAGE_BASE}/photo-1600166898405-da9535204843?auto=format&fit=crop&w=1200&q=85`,
        `${IMAGE_BASE}/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85`,
        `${IMAGE_BASE}/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=85`
      ],
      tags: ["批发", "跨境", "地毯", "地垫", "拼接", "免胶", "办公室", "满铺"],
      productFacts: [
        { name: "类型", value: "拼接地毯 / 方块地垫" },
        { name: "图案", value: "黑白棋盘格" },
        { name: "使用方式", value: "免胶粘贴，拼接铺设" },
        { name: "适用场景", value: "办公室、租房、卧室、直播间、软装改造" },
        { name: "视觉特点", value: "强对比图案，空间改造感明显" },
        { name: "表面感受", value: "柔软、亲肤、具有织物纹理" },
        { name: "采购特点", value: "低单价，适合批量采购和跨境销售" }
      ],
      sellingPoints: [
        "低成本快速改变空间氛围",
        "黑白棋盘格自带视觉记忆点",
        "免胶拼接，适合租房改造",
        "可按面积自由组合",
        "适合拍摄前后对比短视频",
        "单价低，具备批发优势"
      ],
      procurementInsights: [
        "适合软装卖家、跨境家居卖家、办公室装修采购和内容电商选品。",
        "价格区间低，适合以低成本空间改造为核心卖点。",
        "黑白棋盘格具有较强视觉传播力，适合短视频前后对比。",
        "采购方可能关心厚度、防滑、耐脏、拼接稳定性和实际铺设效果。",
        "用于 C 端广告时，应弱化批发属性，强化生活方式和空间氛围。"
      ],
      reviewInsights: [
        "当前页面未提供可直接读取的评论数据，以下洞察基于商品标题、图片、价格、店铺、参数与公开详情信息生成。"
      ],
      reviews: [],
      rawDetailText: "Mock 1688 Demo 商品：拼接地毯、免胶地垫、办公室满铺、黑白棋盘格、跨境批发。",
      extractionStatus: {
        source: "mock_fallback",
        canReadPublicPage: false,
        hasLoginOrCaptchaBlock: false,
        commentsAvailable: false,
        usedMockData: true,
        mockReason: "未能从 1688 页面提取足够商品字段",
        extractedFields: [],
        missingFields: ["title", "price", "images", "shopName", "productFacts", "reviews"],
        message: "当前页面未能读取到足够的真实商品信息，已展示 Mock 演示数据。"
      },
      extractedAt: new Date().toISOString()
    };
  }

  return {
    id,
    sourceUrl: url.toString(),
    normalizedUrl: url.toString(),
    platform: platformLabel(platform),
    platformProductId: url.searchParams.get("id") ?? undefined,
    title: "黑色廓形短款皮夹克女秋冬高级感机车外套",
    price: "¥399",
    minOrderQuantity: undefined,
    shopName: platform === "generic" ? "Runway Mock Atelier" : "摩登衣橱旗舰店",
    companyName: undefined,
    locationText: undefined,
    categoryText: "服装",
    coverImageUrl: `${IMAGE_BASE}/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1200&q=85`,
    imageUrls: [
      `${IMAGE_BASE}/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1200&q=85`,
      `${IMAGE_BASE}/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85`,
      `${IMAGE_BASE}/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=1200&q=85`,
      `${IMAGE_BASE}/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85`
    ],
    tags: ["机车风", "短款", "显瘦", "秋冬", "黑色", "高级感"],
    productFacts: [
      { name: "材质", value: "PU 皮革面料，细腻微光泽" },
      { name: "颜色", value: "深黑色" },
      { name: "版型", value: "短款廓形，利落肩线" },
      { name: "厚度", value: "中等偏厚，适合秋冬叠穿" },
      { name: "适用季节", value: "秋季、初冬、春季夜晚" },
      { name: "尺码", value: "S / M / L / XL，建议按肩宽选择" },
      { name: "适用场景", value: "通勤、夜晚出街、拍照、短途旅行" }
    ],
    sellingPoints: [
      "短款比例自然提高腰线，让腿部线条更利落",
      "黑色百搭且有视觉收缩感，适配裙装、牛仔裤和长靴",
      "廓形肩线强化头肩比，镜头前更有力量感",
      "适合白天通勤与夜晚出街，两种气质切换明显",
      "微光泽皮面在侧光下能呈现更强服装质感"
    ],
    procurementInsights: [
      "该商品适合内容电商、直播间搭配、服饰店铺测款和短视频广告素材。",
      "采购方可能关注面料质感、尺码稳定性、退换货风险和上身效果。",
      "广告表达应把版型、比例和场景切换拍清楚。"
    ],
    reviewInsights: [
      "多数用户关注显瘦和提高腰线，说明比例感是关键购买欲望",
      "评论反复提到质感好、拍照出片，适合强化镜头中的材质细节",
      "尺码略偏小，广告表达应避免过度强调紧身，转向利落廓形",
      "通勤和夜晚出街的双场景反差，是短视频创意的天然切入点"
    ],
    reviews: [
      { username: "A***7", content: "上身真的显瘦，短款刚好卡在腰线上，配高腰裤很好看。", rating: "5", dateText: "2026-01-18" },
      { username: "M***i", content: "皮面不是很廉价的亮，拍照很有质感，晚上灯光下更好看。", rating: "5", dateText: "2026-01-20" },
      { username: "N***o", content: "尺码有一点偏小，里面想穿厚毛衣的话建议拍大一码。", rating: "4", dateText: "2026-01-22" },
      { username: "K***2", content: "通勤穿不夸张，下班换个红唇就很有机车感。", rating: "5", dateText: "2026-01-24" },
      { username: "L***y", content: "物流很快，肩线很挺，不会塌，显得头肩比不错。", rating: "5", dateText: "2026-01-25" },
      { username: "C***n", content: "黑色很百搭，配半裙和牛仔裤都可以，秋天使用率很高。", rating: "5", dateText: "2026-01-29" }
    ],
    rawDetailText: "Mock fashion demo product.",
    extractionStatus: {
      source: "manual_mock",
      canReadPublicPage: false,
      hasLoginOrCaptchaBlock: false,
      commentsAvailable: true,
      usedMockData: true,
      mockReason: "手动演示模式",
      extractedFields: [],
      missingFields: [],
      message: "当前为 mock 数据。"
    },
    extractedAt: new Date().toISOString()
  };
}
