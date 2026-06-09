import type { ProductInfo } from "../../schemas/productSchemas.js";
import { JSON_OUTPUT_INSTRUCTIONS, type PromptDraft, type PromptTemplate } from "./types.js";

export const fashionPromptTemplate: PromptTemplate = {
  id: "fashion",
  label: "服装/女装",
  systemPrompt: `你是一位顶级时尚广告创意总监，擅长把服装电商商品转化为高反差、高记忆点、适合 AI 视频生成工具的广告创意。
你需要基于商品信息生成一份可直接用于视频生成 AI 的 Prompt。
创作时必须突出服装本身，不要让场景喧宾夺主。
请从用户评论中提取真实消费欲望，从商品卖点中提取视觉表达重点，从服装属性中提取风格方向。
结果必须具备反差感、视觉冲击力、短视频广告节奏、强商品呈现和服装行业审美。
${JSON_OUTPUT_INSTRUCTIONS}`,
  buildUserPayload: (product: ProductInfo, styleMode: string) => ({
    category: "fashion",
    styleMode,
    product
  }),
  generateMock: generateFashionMockPrompt
};

function generateFashionMockPrompt(product: ProductInfo): PromptDraft {
  const material = product.productFacts.find((fact) => fact.name.includes("材质"))?.value ?? "黑色微光泽面料";
  const scene = product.productFacts.find((fact) => fact.name.includes("适用场景"))?.value ?? "通勤与夜晚出街";
  const mainDesire = product.reviewInsights[0] ?? "突出显瘦比例与镜头质感";

  return {
    conceptTitle: "白天通勤，夜晚上镜",
    coreContrast: "同一件服装，在冷静办公楼与霓虹街角之间完成气质切换：白天克制利落，夜晚锋利耀眼。",
    visualStyle: "高级黑白时装大片 + 电光紫夜景广告；低饱和米白背景与湿润霓虹街面形成反差，强调面料质感、轮廓线条和穿着比例。",
    promptCN: `竖屏 9:16 时尚短视频广告，主角是一位自信的年轻女性，穿着「${product.title}」。开场在米白色极简办公室，冷白侧光照出${material}的微光泽，镜头从肩线缓慢推进到腰线，突出穿着比例。她合上电脑，走进电梯，灯光从白色切换为电光紫。下一秒来到雨后城市街角，服装在霓虹灯下呈现利落轮廓，步伐坚定，衣摆轻微摆动。画面必须始终清晰展示商品正面、肩线、袖口、细节和整体版型。节奏先安静后爆发，广告情绪从通勤冷静转为夜晚掌控感。消费洞察：${mainDesire}。适用场景：${scene}。电影级摄影，真实服装材质，强商品呈现，高级时装广告质感。`,
    promptEN: `Vertical 9:16 fashion short video ad. The hero is a confident young woman wearing "${product.title}". Start in a minimal warm off-white office, cool side light revealing the subtle texture of ${material}. The camera slowly pushes from the shoulder line to the waist, emphasizing proportion and silhouette. She closes her laptop and steps into an elevator; the lighting shifts from clean white to electric purple. Cut to a rainy city corner at night, where the garment catches neon reflections. Keep the product clearly visible at all times: front silhouette, shoulders, cuffs, construction details, and material texture. The rhythm moves from quiet control to bold night energy. Fashion editorial cinematography, realistic garment material, strong product focus, high-end AI video ad aesthetic.`,
    shotList: [
      "近景：冷白侧光扫过面料，展示材质质感与结构线条。",
      "中景：模特合上电脑起身，服装轮廓自然进入画面中心。",
      "转场：电梯门合上，白色灯光切换为电光紫，形成白天到夜晚的反差。",
      "低机位跟拍：雨后街面反射霓虹，模特向镜头走来，衣摆轻动。",
      "产品特写：袖口、领口、面料和版型细节连续切换，保持服装清晰。",
      "收束镜头：模特停在霓虹边缘回头，商品成为画面视觉中心。"
    ],
    negativePrompt: "低清晰度、廉价电商棚拍、过度磨皮、衣服变形、错误拉链、错误袖子数量、手指畸形、脸部崩坏、背景喧宾夺主、logo 水印、文字乱码、过曝、过暗、塑料质感、卡通风、与商品颜色不一致"
  };
}
