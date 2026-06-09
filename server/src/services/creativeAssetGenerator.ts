import { randomUUID } from "node:crypto";
import type { CategoryAnalysis, CreativeAssetResult, CreativeDirection, DirectionalPromptAsset, ProductDiagnosis, ProductInfo } from "../schemas/productSchemas.js";
import { analyzeCategory } from "./categoryAnalyzer.js";
import { generateStructured } from "./llm/llmClient.js";
import { CreativeAssetResultSchema } from "./llm/schemas.js";
import { analyzeProduct, buildMockAnalysis } from "./productAnalyzer.js";

const ANIMALS = ["一只奶油色小猫", "一只蓬松小狗", "一只圆脸小熊猫", "一只短腿柯基", "一只安静布偶猫"];

export async function generateCreativeAssets(input: {
  product: ProductInfo;
  category?: CategoryAnalysis;
  diagnosis?: ProductDiagnosis;
  directions?: CreativeDirection[];
  analysisMode?: string;
}): Promise<CreativeAssetResult> {
  const category = input.category ?? await analyzeCategory(input.product);
  const analysis = input.diagnosis && input.directions
    ? { diagnosis: input.diagnosis, directions: input.directions }
    : await analyzeProduct(input.product, category);

  const mock = buildMockCreativeAssets(input.product, analysis.diagnosis, analysis.directions);
  const generated = await generateStructured<Omit<CreativeAssetResult, "id" | "productId" | "createdAt">>({
    taskName: "creative_asset_generation",
    schemaName: "CreativeAssetResult",
    schema: CreativeAssetResultSchema,
    mockResult: stripBusinessFields(mock),
    maxOutputTokens: 3800,
    systemPrompt: `你是一位顶级 AI 视频广告创意导演、商品视觉设计师和 Prompt Engineer。你需要基于 1688 商品信息、商品诊断和创意方向，生成一套可直接用于 AI 图像生成和 AI 视频生成工具的创意资产。
你必须：
1. 突出商品主体，不能让场景喧宾夺主。
2. 强化商品的材质、结构、使用方式、尺寸比例和视觉记忆点。
3. 为商品找到一个有反差、有传播力、有商业转化价值的创意角度。
4. 生成中文 Prompt 和英文 Prompt。
5. 必须为三套创意方向分别生成 directionalPrompts：实用转化型、生活方式型、强反差传播型，每套都要有独立的图片 Prompt、视频 Prompt、分镜和 Negative Prompt。
6. 顶层字段可选择最适合 Demo 的主推荐方向，但 directionalPrompts 必须包含三条不同策略的 Prompt。
7. 生成 5-10 秒短视频分镜，适合 AI 视频生成工具。
8. 生成 Negative Prompt，避免商品主体不清、材质错误、比例错误、文字乱码、过度卡通、低清晰度、变形、图案错误、空间比例错误等问题。
9. 如果商品是服装，重点描述版型、面料、穿着状态、人物动作、风格场景。
10. 如果商品不是服装，重点描述材质、结构、使用方式、真实比例、场景互动和视觉记忆点。
11. 如果 product.extractionStatus.usedMockData=true，生成内容仍然可以用于 Demo，但不要声称这些信息来自真实抓取结果。
12. 输出必须严格符合 JSON Schema。
13. 不要输出 Markdown。
14. 不要解释过程。`,
    userPrompt: JSON.stringify({
      product: sanitizeProduct(input.product),
      category,
      diagnosis: analysis.diagnosis,
      directions: analysis.directions,
      analysisMode: input.analysisMode
    }, null, 2)
  });

  return {
    id: randomUUID(),
    productId: input.product.id,
    ...generated,
    createdAt: new Date().toISOString()
  };
}

export function buildMockCreativeAssets(product: ProductInfo, diagnosis?: ProductDiagnosis, directions?: CreativeDirection[]): CreativeAssetResult {
  const resolvedDiagnosis = diagnosis ?? buildMockAnalysis(product).diagnosis;
  const resolvedDirections = directions ?? buildMockAnalysis(product).directions;
  const isRug = /地毯|地垫|门垫|脚垫|方块毯|rug|carpet|mat/i.test(`${product.title} ${product.tags.join(" ")}`);
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const chosenDirection = resolvedDirections[1] ?? resolvedDirections[0];

  return {
    id: randomUUID(),
    productId: product.id,
    conceptTitle: isRug ? "一铺，房间立刻有了性格" : `让${product.title.slice(0, 12)}被看见`,
    coreContrast: isRug
      ? "普通、冰冷、杂乱的地面，在地垫铺下后变成温暖、有记忆点、适合拍照的生活空间。"
      : resolvedDiagnosis.coreJudgement,
    lifestylePositioning: isRug
      ? "低成本空间改造道具，适合租房、办公室、卧室、直播间和内容电商场景。"
      : chosenDirection?.coreScene ?? "把 1688 商品转译成消费者能感知的生活方式表达。",
    imagePromptCN: isRug
      ? `商品主图改造 Prompt：以「${product.title}」为主体，完整展示地垫铺设在房间中的效果。画面为奶油色客厅或卧室，自然光，黑白棋盘格/拼接纹理清晰可见，边缘和厚度有局部放大，小面积加入${animal}趴在角落但不遮挡商品。整体高级、干净、温馨，适合电商主图和小红书封面。`
      : `商品主图改造 Prompt：以「${product.title}」为主体，使用干净高级的商业摄影构图，清晰展示商品全貌、材质、结构、尺寸比例和核心卖点，背景克制，不喧宾夺主。`,
    imagePromptEN: isRug
      ? `Product hero image prompt: feature "${product.title}" as the main subject, fully laid out in a warm cream-toned living room or bedroom. Natural light, clear checkerboard or modular texture, visible edges and thickness with close-up detail. Add ${animal} resting in one corner without covering the rug. Premium, clean, cozy, suitable for e-commerce hero image and social commerce cover.`
      : `Product hero image prompt: feature "${product.title}" as the main subject in a clean premium commercial composition. Show full shape, material, structure, scale and key selling points. Restrained background, strong product focus.`,
    videoPromptCN: isRug
      ? `5-10 秒竖屏 AI 视频广告。开场是一个普通、略显冷清的房间地面，镜头快速切到「${product.title}」被一块块铺开，黑白图案或拼接纹理形成强记忆点。暖色自然光进入房间，${animal}慢慢走上地垫，低头闻一闻，然后打哈欠、趴下伸懒腰。地垫始终是主体，必须清晰展示完整铺设效果、边缘、厚度、表面纹理和空间改造前后对比。氛围慵懒、温馨、治愈，适合小红书/抖音家居软装广告。`
      : `5-10 秒竖屏 AI 视频广告。以「${product.title}」为主体，先展示普通使用场景，再通过镜头切换突出商品出现后的视觉和功能变化。必须清晰呈现商品全貌、材质、结构和使用方式，节奏紧凑，商业广告质感。`,
    videoPromptEN: isRug
      ? `5-10 second vertical AI video ad. Start with an ordinary slightly cold room floor, then cut to "${product.title}" being laid piece by piece. The checkerboard or modular texture creates a strong visual memory. Warm natural light enters the room. ${animal} slowly walks onto the mat, sniffs the texture, yawns, lies down and stretches lazily. The rug must remain the main subject: full layout, edges, thickness, surface texture, and before-after room transformation clearly visible. Cozy, lazy, warm, healing home decor ad for social commerce.`
      : `5-10 second vertical AI video ad. Feature "${product.title}" as the main subject. Start from an ordinary use case, then reveal the visual and functional change brought by the product. Keep full product shape, material, structure and usage clear. Tight rhythm, premium commercial look.`,
    shotList: isRug
      ? [
          "俯拍开场：普通地面和铺设前空间状态，建立改造前对比。",
          "手部铺设：地垫一块块拼接，展示免胶和组合方式。",
          "低机位滑动：贴近地面扫过纹理、厚度和边缘。",
          `氛围动作：${animal}慢慢走上地垫，不能遮挡主体图案。`,
          "温馨收束：小动物打哈欠趴下，完整地垫和房间氛围同时入镜。",
          "产品定格：画面停在地垫全貌、图案记忆点和空间改造结果。"
        ]
      : [
          "开场：展示商品出现前的普通场景。",
          "主体亮相：商品进入画面中心，清晰呈现全貌。",
          "细节近景：展示材质、结构、尺寸比例和关键卖点。",
          "使用动作：表现商品如何被使用或解决问题。",
          "结果镜头：展示使用后的视觉或功能变化。",
          "收束定格：商品主体清晰占据画面中心。"
        ],
    negativePrompt: "商品主体不清晰、主体被遮挡、材质错误、比例错误、图案扭曲、边缘变形、文字乱码、水印、低清晰度、过度卡通、背景喧宾夺主、过曝、过暗、脏污、动物抢主体、与商品颜色不一致",
    directionalPrompts: buildDirectionalPrompts(product, resolvedDirections, isRug, animal),
    createdAt: new Date().toISOString()
  };
}

function buildDirectionalPrompts(
  product: ProductInfo,
  directions: CreativeDirection[],
  isRug: boolean,
  animal: string
): DirectionalPromptAsset[] {
  const fallbackDirections = buildMockAnalysis(product).directions;
  const resolved = directions.length >= 3 ? directions.slice(0, 3) : fallbackDirections;

  return resolved.map((direction, index) => {
    if (isRug) {
      const variants = [
        {
          conceptTitle: "3 秒铺出一块完整地面",
          coreContrast: "零散普通地面与整洁满铺效果形成直接转化对比。",
          imagePromptCN: `实用转化型商品图 Prompt：以「${product.title}」为主体，俯拍完整拼接铺设效果，清楚展示每块地垫边缘、厚度、免胶拼接方式和可扩展面积。画面干净、商业摄影、信息明确，不加入过多道具。`,
          imagePromptEN: `Practical conversion product image prompt: feature "${product.title}" as the main subject. Top-down view of the fully installed modular mat, clear tile edges, thickness, adhesive-free joining method and expandable coverage. Clean commercial photography, product information first, minimal props.`,
          videoPromptCN: `5-10 秒竖屏实用转化视频。镜头从空地面开始，手部快速铺下地垫，一块块拼接形成完整区域。重点展示免胶、边缘贴合、厚度、可自由组合，最后定格整洁办公室/房间地面。商品始终占据画面主体。`,
          videoPromptEN: `5-10 second vertical practical conversion video. Start with an empty floor, hands quickly place modular mat tiles piece by piece into a complete area. Highlight adhesive-free installation, tight edges, thickness and flexible combination. End on a clean office or room floor, product always dominant.`,
          shotList: [
            "俯拍空地面：建立铺设前状态。",
            "手部动作：第一块地垫贴合地面。",
            "连续拼接：多块地垫快速组合。",
            "边缘近景：展示厚度和拼接稳定性。",
            "全貌定格：整块地面变整洁。"
          ]
        },
        {
          conceptTitle: "一铺，房间像杂志里的家",
          coreContrast: "普通租房空间与温暖生活方式空间形成情绪反差。",
          imagePromptCN: `生活方式型商品图 Prompt：以「${product.title}」为主体，铺设在奶油色卧室或客厅中，自然阳光、柔软织物纹理、黑白棋盘格清晰可见，${animal}在边角轻轻趴着但不遮挡商品，氛围温馨克制。`,
          imagePromptEN: `Lifestyle product image prompt: feature "${product.title}" as the main subject in a cream-toned bedroom or living room. Natural sunlight, soft textile texture, clear checkerboard pattern. ${animal} rests at one corner without covering the product. Cozy, restrained, premium.`,
          videoPromptCN: `5-10 秒竖屏生活方式视频。普通房间铺上地垫后光线变暖，${animal}慢慢走上地垫、低头闻一闻、打哈欠趴下。重点展示地垫完整铺设效果、纹理、柔软感和空间氛围变化。`,
          videoPromptEN: `5-10 second vertical lifestyle video. After the mat is installed in an ordinary room, the light becomes warmer. ${animal} slowly walks onto it, sniffs the texture, yawns and lies down. Show full layout, texture, softness and room atmosphere transformation.`,
          shotList: [
            "普通房间开场：地面略显冷清。",
            "铺设完成切换：空间变得温暖。",
            "纹理近景：自然光扫过织物表面。",
            "互动镜头：小动物走上地垫。",
            "温馨收束：小动物打哈欠趴下，地垫全貌可见。"
          ]
        },
        {
          conceptTitle: "最后一块落下，房间换了气质",
          coreContrast: "杂乱无记忆点的地面与强图案空间形成强反差传播点。",
          imagePromptCN: `强反差传播型商品图 Prompt：以「${product.title}」为主体，采用铺设前后对比构图，一侧是普通灰暗地面，一侧是黑白棋盘格/拼接地垫满铺后的强视觉空间。商品图案准确、边缘清楚、比例真实。`,
          imagePromptEN: `High-contrast viral product image prompt: feature "${product.title}" as the main subject in a before-after split composition. One side: plain dull floor; the other: bold checkerboard modular mat fully installed. Accurate pattern, clear edges, realistic scale.`,
          videoPromptCN: `5-10 秒竖屏强反差视频。开场是杂乱普通地面，最后一块地垫落下瞬间，镜头节奏加快，空间切换成强记忆点的黑白图案满铺效果。商品主体清晰，不使用夸张特效遮挡图案。`,
          videoPromptEN: `5-10 second vertical high-contrast video. Start with a messy plain floor. As the final mat tile lands, the pace accelerates and the space transforms into a bold checkerboard full-floor look. Keep product clear; no excessive effects covering the pattern.`,
          shotList: [
            "杂乱地面开场：制造改造前反差。",
            "最后一块落下：动作成为转场点。",
            "快速推镜：图案从局部扩展到全貌。",
            "低机位扫过：展示边缘和空间比例。",
            "强视觉定格：黑白图案满铺占据画面。"
          ]
        }
      ];
      const variant = variants[index] ?? variants[0];
      return {
        directionId: direction.id,
        directionName: direction.name,
        ...variant,
        negativePrompt: "商品主体不清晰、主体被遮挡、图案扭曲、边缘变形、空间比例错误、材质错误、文字乱码、水印、低清晰度、过度卡通、动物遮挡主体、背景喧宾夺主"
      };
    }

    const commonNegative = "商品主体不清晰、主体被遮挡、版型错误、材质错误、比例错误、肢体变形、文字乱码、水印、低清晰度、过度卡通、背景喧宾夺主";
    const concepts = [
      {
        conceptTitle: "一眼看清版型和价格价值",
        coreContrast: "批发参数页转化为清楚、直接、可下单的商品展示。",
        imagePromptCN: `实用转化型商品图 Prompt：以「${product.title}」为主体，干净棚拍或浅灰背景，清楚展示正面轮廓、收腰/绑带结构、面料厚度和颜色，加入局部细节放大但不遮挡主体。`,
        imagePromptEN: `Practical conversion image prompt: feature "${product.title}" as the main subject on a clean studio or light gray background. Clearly show front silhouette, waist tie structure, fabric thickness and color with detail close-ups that do not cover the product.`,
        videoPromptCN: `5-10 秒竖屏实用转化视频。模特正面展示外套轮廓，转身展示侧面线条，手部拉近绑带和面料细节。重点让买家看清版型、厚度、收腰结构和冬季穿着效果。`,
        videoPromptEN: `5-10 second vertical practical conversion video. Model shows the coat silhouette from the front, turns to reveal side lines, then close-up on waist tie and fabric details. Make fit, thickness, waist structure and winter wearing effect clear.`,
        shotList: ["正面全身：展示外套整体轮廓。", "侧身转动：看清斗篷线条。", "手部细节：展示收腰绑带。", "面料近景：突出冬季厚度。", "定格：完整商品占据画面中心。"]
      },
      {
        conceptTitle: "冬天也可以很优雅",
        coreContrast: "厚重冬装与轻盈优雅气质形成生活方式反差。",
        imagePromptCN: `生活方式型商品图 Prompt：以「${product.title}」为主体，城市街角或暖色室内场景，自然光，模特穿着外套轻微走动，收腰线条、纯色毛呢质感和优雅气质清晰可见。`,
        imagePromptEN: `Lifestyle image prompt: feature "${product.title}" as the main subject in a city corner or warm indoor scene. Natural light, model walking gently, clear waistline, solid wool-like texture and elegant winter mood.`,
        videoPromptCN: `5-10 秒竖屏生活方式视频。冬季街角，模特穿着斗篷外套从冷风中走入暖光，绑带轻轻摆动，镜头强调优雅轮廓、纯色质感和通勤/约会都适用的氛围。`,
        videoPromptEN: `5-10 second vertical lifestyle video. On a winter street corner, a model in the cape coat walks from cool wind into warm light. Waist tie moves gently. Emphasize elegant silhouette, solid texture and commute-to-date versatility.`,
        shotList: ["冷色街角开场：建立冬季氛围。", "模特入镜：外套成为视觉中心。", "腰部近景：绑带轻微摆动。", "半身推镜：展示毛呢质感。", "暖光收束：优雅轮廓定格。"]
      },
      {
        conceptTitle: "普通外套，变成有气场的一件",
        coreContrast: "普通冬季穿搭与强轮廓斗篷外套形成气场反差。",
        imagePromptCN: `强反差传播型商品图 Prompt：以「${product.title}」为主体，前后对比构图，左侧普通臃肿冬装，右侧穿上纯色收腰斗篷外套后轮廓更挺、腰线更清晰。高级时尚杂志质感。`,
        imagePromptEN: `High-contrast viral image prompt: feature "${product.title}" as the main subject in a before-after composition. Left: ordinary bulky winter outfit. Right: solid waist-tie cape coat with stronger silhouette and clearer waistline. Premium fashion magazine look.`,
        videoPromptCN: `5-10 秒竖屏强反差视频。开场普通厚重冬装略显臃肿，快速转场后模特穿上斗篷外套，轮廓打开、腰线出现、步伐更有气场。商品版型和面料必须清晰。`,
        videoPromptEN: `5-10 second vertical high-contrast video. Start with a bulky ordinary winter outfit. Quick transition reveals the model in the cape coat: stronger silhouette, defined waistline, more confident walk. Keep product fit and fabric clear.`,
        shotList: ["普通冬装开场：显得厚重。", "快速转场：外套上身。", "低角度推镜：增强气场。", "腰线近景：突出收腰结构。", "杂志感定格：外套主体清晰。"]
      }
    ];
    return {
      directionId: direction.id,
      directionName: direction.name,
      ...(concepts[index] ?? concepts[0]),
      negativePrompt: commonNegative
    };
  });
}

function stripBusinessFields(asset: CreativeAssetResult): Omit<CreativeAssetResult, "id" | "productId" | "createdAt"> {
  const { id: _id, productId: _productId, createdAt: _createdAt, ...rest } = asset;
  return rest;
}

function sanitizeProduct(product: ProductInfo) {
  return {
    ...product,
    rawDetailText: product.rawDetailText?.slice(0, 3000)
  };
}
