import { randomUUID } from "node:crypto";
import type { CategoryAnalysis, CreativeDirection, ProductDiagnosis, ProductInfo } from "../schemas/productSchemas.js";
import { generateStructured } from "./llm/llmClient.js";
import { CreativeDirectionListSchema, ProductDiagnosisSchema } from "./llm/schemas.js";

export interface ProductAnalysisResult {
  category?: CategoryAnalysis;
  diagnosis: ProductDiagnosis;
  directions: CreativeDirection[];
}

export async function analyzeProduct(product: ProductInfo, category?: CategoryAnalysis): Promise<ProductAnalysisResult> {
  const mock = buildMockAnalysis(product);
  const sharedPayload = JSON.stringify({ product: sanitizeProduct(product), category }, null, 2);

  const diagnosis = await generateStructured<ProductDiagnosis>({
    taskName: "product_diagnosis",
    schemaName: "ProductDiagnosis",
    schema: ProductDiagnosisSchema,
    mockResult: mock.diagnosis,
    maxOutputTokens: 1800,
    systemPrompt: `你是一位资深电商商品策略专家、1688 采购分析专家、视觉创意总监和短视频广告策划。你擅长从 1688 商品详情页中提取商品价值，并把偏批发、偏参数化的商品信息转化成可被消费者理解的视觉卖点、采购决策洞察和短视频创意方向。
你必须遵守：
1. 不编造真实评论。
2. 如果没有评论，只能基于标题、图片、价格、参数、详情页公开文本做洞察。
3. 如果 product.extractionStatus.usedMockData=true，必须意识到当前是 Mock 演示数据，不要表述成“真实页面证明”。
4. 输出必须严格符合 JSON Schema。
5. 语言要专业、克制、有商业判断力。
6. 不要空泛地说“质量好”“性价比高”，必须结合商品本身说明为什么。
7. 必须区分 B2B 采购视角和 C 端消费者表达视角。
8. 必须输出可用于视觉创作的判断。
9. 如果商品是服装，要分析版型、材质、穿着场景、风格调性。
10. 如果商品不是服装，要分析材质、结构、使用方式、使用场景、视觉记忆点。
11. 不要输出 Markdown。
12. 不要解释过程。`,
    userPrompt: sharedPayload
  });

  const directionResult = await generateStructured<{ directions: CreativeDirection[] }>({
    taskName: "creative_direction",
    schemaName: "CreativeDirectionList",
    schema: CreativeDirectionListSchema,
    mockResult: { directions: mock.directions },
    maxOutputTokens: 2600,
    systemPrompt: `你是一位商业广告创意总监，擅长把 1688 商品从“批发参数页”转化成“可传播、可投放、可生成图像和视频的广告创意方向”。你需要为商品生成 3 套创意调优方案：实用转化型、生活方式型、强反差传播型。
你必须遵守：
1. 每个方向都要具体，不能泛泛而谈。
2. 每个方向都要突出商品主体。
3. 每个方向都要能指导商品图优化和短视频广告生成。
4. 如果商品不是服装，不要使用服装行业词汇。
5. 如果 product.extractionStatus.usedMockData=true，不要把 mock 数据说成真实抓取数据。
6. 输出必须严格符合 JSON Schema。
7. 不要输出 Markdown。
8. 不要解释过程。`,
    userPrompt: sharedPayload
  });

  return {
    category,
    diagnosis,
    directions: directionResult.directions
  };
}

export function buildMockAnalysis(product: ProductInfo): { diagnosis: ProductDiagnosis; directions: CreativeDirection[] } {
  const isRug = /地毯|地垫|门垫|脚垫|方块毯|carpet|rug|mat/i.test(`${product.title} ${product.tags.join(" ")}`);
  const diagnosis: ProductDiagnosis = isRug
    ? {
        coreJudgement: "这个商品不应该只被表达为“低价地垫”，而应该被包装成“低成本改造空间氛围的视觉道具”。",
        viralPotentialScore: 4,
        mainOpportunities: [
          "黑白棋盘格图案天然具有高识别度",
          "铺设前后对比非常适合短视频表达",
          "低客单价降低尝试门槛",
          "免胶拼接适合租房、办公室和临时场景"
        ],
        mainWeaknesses: [
          "批发页表达偏参数化，缺少生活方式包装",
          "商品质感需要通过近景镜头证明",
          "用户可能担心防滑、厚度、耐脏和边缘翘起"
        ],
        visualFocus: [
          "黑白棋盘格的大面积视觉冲击",
          "地垫边缘与地面的贴合细节",
          "手触摸表面的织物纹理",
          "铺设前后空间氛围变化",
          "低机位展示脚踩柔软感"
        ],
        contentHooks: [
          "一个普通房间，铺上地垫后突然像杂志里的家",
          "不刷墙不装修，只用地垫改变空间气质",
          "低成本改造出租屋和办公室地面"
        ],
        suitablePlatforms: ["抖音", "小红书", "视频号", "电商详情页", "跨境电商素材页"]
      }
    : {
        coreJudgement: "这个商品需要从批发参数表达转译为消费者能感知的使用价值和视觉记忆点。",
        viralPotentialScore: 3,
        mainOpportunities: product.sellingPoints.slice(0, 4),
        mainWeaknesses: ["页面信息偏采购语言", "缺少生活方式场景", "需要补充材质和使用效果镜头"],
        visualFocus: ["主体全貌", "材质细节", "使用方式", "尺寸比例", "场景前后变化"],
        contentHooks: ["把普通商品拍成可感知的生活解决方案", "用一个镜头证明它为什么值得买"],
        suitablePlatforms: ["抖音", "小红书", "视频号", "电商详情页"]
      };

  const directions: CreativeDirection[] = [
    {
      id: randomUUID(),
      name: "方向 A：实用转化型",
      targetAudience: "批发采购方、电商卖家、办公室或家庭场景采购者",
      coreScene: isRug ? "快速铺设、免胶拼接、按面积自由组合" : "直接展示商品功能、规格和使用方式",
      visualSuggestion: isRug ? "俯拍完整铺设过程，搭配局部厚度和边缘近景" : "干净背景中展示商品全貌、细节和使用步骤",
      videoHook: isRug ? "3 秒铺出一块完整地面，空间立刻变整洁" : "用一个动作说明商品解决了什么问题",
      imageOptimizationSuggestion: isRug ? "主图加入铺设前后对比和局部纹理放大" : "主图增加使用场景和核心卖点短标签",
      suitablePlatform: "电商详情页 / 视频号"
    },
    {
      id: randomUUID(),
      name: "方向 B：生活方式型",
      targetAudience: "租房青年、小户型家庭、软装爱好者、内容电商用户",
      coreScene: isRug ? "用低成本地垫改变房间氛围" : "把商品放进真实生活方式场景中",
      visualSuggestion: isRug ? "阳光、奶油色家具、黑白棋盘格、柔软触感、猫或人脚踩过的细节" : "自然光、克制道具、真实使用动作和材质近景",
      videoHook: isRug ? "一个普通房间，铺上地垫后突然变得像杂志里的家" : "普通场景因为一个商品变得更好看、更好用",
      imageOptimizationSuggestion: isRug ? "增加客厅/卧室生活方式图，弱化批发参数感" : "补充生活方式主图和使用前后对比",
      suitablePlatform: "小红书 / 抖音"
    },
    {
      id: randomUUID(),
      name: "方向 C：强反差传播型",
      targetAudience: "短视频内容创作者、视觉冲击型广告投放、兴趣电商用户",
      coreScene: isRug ? "杂乱地面到高记忆点空间的瞬间切换" : "商品使用前后的强烈视觉变化",
      visualSuggestion: isRug ? "前半段灰暗普通地面，后半段棋盘格满铺并加入温馨小动物" : "用光线、色彩和镜头节奏制造前后反差",
      videoHook: isRug ? "铺下最后一块地垫，整个房间像被重新设计" : "一个普通商品，在镜头里变成强记忆点",
      imageOptimizationSuggestion: isRug ? "主图强化黑白图案冲击和空间改造结果" : "主图做强对比构图，突出商品主体",
      suitablePlatform: "抖音 / 小红书"
    }
  ];

  return { diagnosis, directions };
}

function sanitizeProduct(product: ProductInfo) {
  return {
    ...product,
    rawDetailText: product.rawDetailText?.slice(0, 3000)
  };
}
