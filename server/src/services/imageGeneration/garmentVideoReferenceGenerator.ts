import { imageGenerationConfig } from "./config.js";
import { ImageGenerationClient } from "./imageGenerationClient.js";
import type { BackgroundAsset, ModelAsset, ThreeViewSet, VideoReferenceGenerationStatus } from "../garmentTypes.js";

const client = new ImageGenerationClient();

export async function generateVideoReferenceImage(params: {
  sessionId: string;
  selectedSet: ThreeViewSet;
  garmentThreeViewPath: string;
  modelAsset: ModelAsset & { localPath: string };
  background: BackgroundAsset;
  backgroundPath: string;
  fallbackImagePath: string;
  fallbackImageUrl: string;
  reqBaseURL: string;
}): Promise<{
  videoReferenceImageUrl: string;
  videoReferenceGenerationStatus: VideoReferenceGenerationStatus;
}> {
  const startedAt = Date.now();
  try {
    console.log("[VideoReferenceGeneration] start", {
      sessionId: params.sessionId,
      model: imageGenerationConfig.model,
      references: ["garment_three_view", "model", "background"]
    });
    const garmentReferencePath = isSVGPath(params.garmentThreeViewPath) ? params.fallbackImagePath : params.garmentThreeViewPath;
    if (garmentReferencePath !== params.garmentThreeViewPath) {
      console.warn("[VideoReferenceGeneration] replace_non_raster_garment_reference", {
        sessionId: params.sessionId
      });
    }
    const image = await client.generateImage(
      buildVideoReferencePrompt(),
      `${params.sessionId}-video-reference`,
      params.reqBaseURL,
      { referenceImagePaths: [garmentReferencePath, params.modelAsset.localPath, params.backgroundPath] }
    );
    console.log("[VideoReferenceGeneration] done", {
      sessionId: params.sessionId,
      durationMs: Date.now() - startedAt
    });
    return {
      videoReferenceImageUrl: image.url,
      videoReferenceGenerationStatus: {
        imageGenerationMode: "real_ai",
        usedMock: false,
        message: "已根据服装三视图、模特图和背景图生成视频参考图，。"
      }
    };
  } catch (error) {
    console.warn("[VideoReferenceGeneration] fallback_to_reference", {
      sessionId: params.sessionId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown video reference generation error"
    });
    if (!imageGenerationConfig.fallbackToMock) {
      throw error;
    }
    return {
      videoReferenceImageUrl: isSVGUrl(params.selectedSet.threeViewImageUrl ?? params.selectedSet.frontViewUrl)
        ? params.fallbackImageUrl
        : params.selectedSet.threeViewImageUrl ?? params.selectedSet.frontViewUrl,
      videoReferenceGenerationStatus: {
        imageGenerationMode: "mock_fallback",
        usedMock: true,
        message: "视频参考图生成失败，当前临时使用上传服装照片作为参考。"
      }
    };
  }
}

function isSVGUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return url.toLowerCase().endsWith(".svg");
  }
}

function isSVGPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".svg");
}

function buildVideoReferencePrompt(): string {
  return `三张参考图顺序为：1）服装三视图，2）女模特参考图，3）春日街景背景参考图。请生成一张真实街拍风格的视频生成参考图。

请将参考图中的女模特，融合到春日街景的参考图环境中。

只保留一位模特，不要生成三视图，不要生成多个模特。以模特参考图左侧的正面模特作为主要人物参考，保留她的脸部特征、发型、身材比例、白色运动鞋。可参考右侧侧面图来调整自然走路姿态，但最终画面中只能出现一个完整人物。

场景使用场景参考图中的春日街道：白色现代建筑、白色栏杆、绿植、盛开的白色樱花树、干净的道路、温暖自然阳光、树影洒在路面上。保持原街景的真实透视、空间深度和春日氛围。

人物位置：模特出现在街道中前景，站在道路中央偏左或中央位置，脚踩在真实路面上，沿着道路自然向前走。人物比例要合理，符合街景透视关系，模特全身高度约占画面高度的55%-65%，不要过大，不要过小，不要像贴图。

人物姿态：模特呈自然走动姿态，一只脚向前迈步，另一只脚在后方支撑，身体轻微转向镜头，肩膀放松，手臂自然摆动，表情自然温柔，眼神可以看向前方或微微看向画面左侧。头发有轻微自然飘动，整体像真实街拍，不要僵硬站立。

服装要求：服装必须完整清晰，保留纹理、彩色点缀、翻领、胸前双口袋、金属纽扣、袖口结构和衣摆比例。精确保留服装的版型、领口形状、袖型、袖口、结构、层次、花纹排列、颜色比例、面料质感，不要把服装改成其他颜色，不要丢失图案，不要改变版型，不要遮挡衣服主体。白色运动鞋保持干净清爽。

光影融合：人物光线必须匹配街景环境，使用春日下午自然光，光线从画面左上方和树枝间照射下来，在模特衣服、头发、腿部和鞋子上形成柔和自然的高光。模特脚下必须有真实接触阴影，阴影方向与街道树影一致。人物边缘要自然融入背景，不要有抠图边、白边或贴图感。

画面风格：真实春日街拍，高级女装电商Lookbook，清新、明亮、温柔、年轻、轻奢。背景轻微虚化但不要完全模糊，人物和服装清晰突出。整体色调为浅蓝、奶白、绿色、暖阳光色，画面干净高级。

画面要求：全身构图，人物完整露出，从头到脚都在画面内，脚不要被裁切。保持真实人体比例，真实皮肤质感，真实服装褶皱，真实路面接触关系。去除或不要生成水印、平台标识、乱码文字和多余文字。

Negative Prompt：多个模特，三视图，人物比例过大，人物比例过小，身体悬浮，脚不接地，没有脚底阴影，贴图感，抠图白边，光影不一致，衣服图案丢失，外套变纯色，牛仔外套变成衬衫、风衣、西装、针织衫或长外套，胸前口袋消失，纽扣错误，袖子变形，短款比例错误，手指变形，多余手指，腿部畸形，腿过长，头身比例异常，脸部变形，表情僵硬，走路姿势僵硬，背景变形，建筑扭曲，树枝穿过身体，花瓣遮挡衣服，过度磨皮，塑料皮肤，卡通感，CG感，低清晰度，过曝，欠曝，水印，乱码文字，新增无关logo,不要改衣服设计，不要换衣服款式，不要改变领口，不要改变袖子，不要改变腰带，不要改变裙子条纹，不要改变刺绣，不要省略花纹，不要简化纹样，不要改变颜色比例，不要把金边变成其他颜色，不要把红色边线去掉，不要把透明袖改成普通袖，不要把腰带改成普通腰封，不要生成类似风格的新服装，不要现代化改造，不要幻想化改造，不要随机添加装饰，不要去掉原有装饰，不要模糊服装细节。`;
}
