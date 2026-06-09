import type { ProductInfo } from "../../schemas/productSchemas.js";
import { JSON_OUTPUT_INSTRUCTIONS, type PromptDraft, type PromptTemplate } from "./types.js";

const ANIMALS = ["一只奶油色小猫", "一只蓬松小狗", "一只圆脸小熊猫", "一只短腿柯基", "一只安静布偶猫"];

export const rugPromptTemplate: PromptTemplate = {
  id: "rug",
  label: "地毯/地垫",
  systemPrompt: `你是一位擅长家居生活方式广告的创意导演，尤其擅长把地毯、地垫、家居软装商品转化为温馨、有记忆点、适合 AI 视频生成工具的短视频广告创意。
你需要基于商品信息生成一份可直接用于视频生成 AI 的 Prompt。
创作时必须突出当前地毯或地垫本身：纹理、图案、边缘、厚度、铺设空间、脚感和家居氛围都要清楚可见。
允许加入一只随机可爱小动物，例如小猫、小狗、小熊猫、柯基或布偶猫。小动物只能服务于商品氛围，不能遮挡主体商品；它可以在地毯上打哈欠、慢慢走动、趴下、伸懒腰，呈现慵懒、温馨、治愈的家居感。
画面应该适合短视频广告，强调柔软、舒适、温暖、生活方式和购买欲。
${JSON_OUTPUT_INSTRUCTIONS}`,
  buildUserPayload: (product: ProductInfo, styleMode: string) => ({
    category: "rug",
    styleMode,
    creativeConstraint: "地毯/地垫必须是主体，随机可爱小动物只能作为氛围辅助，不能遮挡商品纹理和全貌。",
    allowedAnimals: ANIMALS,
    product
  }),
  generateMock: generateRugMockPrompt
};

function generateRugMockPrompt(product: ProductInfo): PromptDraft {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const material = product.productFacts.find((fact) => /材质|面料|绒|纤维/.test(fact.name))?.value ?? "柔软细密的表面纹理";
  const color = product.productFacts.find((fact) => /颜色|图案|花色/.test(fact.name))?.value ?? "温暖低饱和家居色调";
  const scene = product.productFacts.find((fact) => /场景|空间|适用/.test(fact.name))?.value ?? "客厅、卧室、入户区域";

  return {
    conceptTitle: "一块地毯，把家放慢",
    coreContrast: "外面的世界很快，家里的这块地毯很慢：一只可爱小动物在地毯上打哈欠、走动、趴下，放大柔软、安静、被治愈的生活感。",
    visualStyle: "暖调自然光家居广告 + 近距离材质特写；浅米白、木色、柔和阴影，镜头低机位贴近地面，突出地毯纹理、厚度、边缘和铺在空间里的完整效果。",
    promptCN: `竖屏 9:16 家居生活方式短视频广告，主体商品是「${product.title}」。画面必须始终以当前地毯/地垫为视觉中心，清晰展示它的整体铺设效果、边缘、厚度、表面纹理和${color}。场景是${scene}，清晨或午后暖色自然光洒进房间，木地板、浅色沙发、低矮茶几作为克制背景。一只随机出现的可爱小动物：${animal}，慢慢走到地毯上，先低头闻一闻纹理，然后在地毯中央打哈欠、转一圈、趴下伸懒腰，表现慵懒温馨的家居氛围。镜头必须避免小动物遮挡商品全貌，动作要温柔缓慢，重点表现地毯的柔软脚感、亲肤质感和让空间变温暖的能力。材质信息：${material}。电影级真实家居摄影，柔和景深，真实织物细节，治愈、安静、有购买欲的短视频广告。`,
    promptEN: `Vertical 9:16 home lifestyle short video ad. The main subject is the rug or floor mat: "${product.title}". Keep the rug clearly visible as the visual center at all times, showing the full layout, edges, thickness, surface texture, and ${color}. The scene is ${scene}, lit by warm morning or afternoon natural light, with wood flooring, a light sofa, and a low coffee table as restrained background elements. A randomly chosen cute animal appears: ${animal}. It slowly walks onto the rug, sniffs the texture, yawns, circles once, then lies down and stretches lazily. The animal must enhance the cozy feeling without covering the rug's pattern or full shape. Emphasize softness, comfort underfoot, tactile fabric detail, and the way the rug makes the room feel warmer. Cinematic realistic home photography, soft depth of field, true textile detail, calm cozy mood, strong product focus.`,
    shotList: [
      "俯拍开场：完整展示地毯/地垫铺在空间里的形状、尺寸比例和边缘。",
      "低机位慢推：镜头贴近地面掠过表面纹理，展示绒感、编织和厚度。",
      `氛围镜头：${animal}从画面边缘慢慢走上地毯，脚步轻，不能遮挡商品主体。`,
      "动作镜头：小动物在地毯上打哈欠、转圈、趴下，呈现慵懒温馨感。",
      "产品特写：地毯边缘、图案、厚度和柔软表面连续切换，保持真实材质。",
      "收束镜头：暖光下地毯占据画面中心，小动物安静趴在一角，空间变得柔软安定。"
    ],
    negativePrompt: "地毯被遮挡、商品主体不清晰、动物过大、动物抢主体、脏污地面、廉价样板间、过度卡通、低清晰度、纹理糊掉、错误透视、过曝、过暗、强反光、水印、文字乱码、变形边缘、图案扭曲、与商品颜色不一致"
  };
}
