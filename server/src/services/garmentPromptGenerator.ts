import type { BackgroundAsset, GarmentAnalysis, ModelAsset, ThreeViewSet } from "./garmentTypes.js";
import { generatePlainTextWithImages } from "./llm/llmClient.js";

export async function generateFinalGarmentVideoPrompt(params: {
  garmentAnalysis: GarmentAnalysis;
  selectedSet: ThreeViewSet;
  background: BackgroundAsset;
  modelAsset: ModelAsset;
  garmentThreeViewPath: string;
  videoReferenceImagePath: string;
}): Promise<string> {
  return generatePlainTextWithImages({
    taskName: "garment_video_prompt_generation",
    imagePaths: [params.garmentThreeViewPath, params.videoReferenceImagePath],
    mockResult: buildMockFinalVideoPrompt(params),
    maxOutputTokens: 3000,
    systemPrompt: "你是一位资深服装短视频导演和 AI 视频生成 Prompt Engineer。你只输出最终视频生成提示词全文，不要输出解释、标题外的说明、Markdown 或代码块。",
    userPrompt: `根据我上传的图片和提示词，来优化本服装和场景应该使用的视频生成提示词，请注意，你输出的提示词不要去变更参考图中服装的颜色，只需要生成8秒的视频，且只需要输出新的视频生成提示词全文即可，不需要输出任何其他内容。

上传图片说明：
1. 第一张图是服装标准电商三视图。
2. 第二张图是已经融合模特、服装和街景后的视频生成参考图。

服装识别信息：
${JSON.stringify(params.garmentAnalysis, null, 2)}

三视图方案：
${JSON.stringify(params.selectedSet, null, 2)}

模特参考：
${params.modelAsset.filename}

背景参考：
${params.background.filename}

参考提示词如下：
${REFERENCE_VIDEO_PROMPT}`
  });
}

function buildMockFinalVideoPrompt(params: {
  garmentAnalysis: GarmentAnalysis;
  selectedSet: ThreeViewSet;
  background: BackgroundAsset;
  modelAsset: ModelAsset;
}): string {
  return `生成一条 8 秒 9:16 竖屏春日女装街拍视频。参考上传的服装三视图和视频参考图，画面中只保留一位女模特，模特穿着这件${params.garmentAnalysis.color}、${params.garmentAnalysis.style}、${params.garmentAnalysis.silhouette}的服装，站在春日街景中自然向前走。背景参考「${params.background.filename}」的白色建筑、绿植、樱花树和温暖自然光，模特参考「${params.modelAsset.filename}」的人物比例、发型和白色运动鞋。镜头从全身构图开始，模特沿道路自然迈步，身体轻微转向镜头，手臂自然摆动，头发轻微飘动。服装必须完整清晰，保留翻领、胸前双口袋、纽扣、袖口、衣摆比例、纹理和彩色点缀，不要改变颜色和版型。光线从画面左上方洒下，人物脚下有真实接触阴影，边缘自然融合背景，整体是高级女装电商 Lookbook 风格，清新、明亮、温柔、年轻、轻奢。Negative Prompt：多个模特、三视图、脚不接地、贴图感、抠图白边、衣服图案丢失、服装变色、版型改变、手指变形、腿部畸形、背景扭曲、水印、乱码文字、低清晰度、卡通感、CG感。`;
}

const REFERENCE_VIDEO_PROMPT = `【生活方式型：一件浅蓝提花牛仔外套撑起春日轻奢出街感】

生成一条8秒春夏女装种草短视频，参考上传图片中的人物、服装、场景、光线和整体风格。场景为现代极简室内空间，暖米色墙面，右侧窗边自然光洒入，画面有轻微光影流动，背景包含简洁陈列架、陶艺摆件和干花花瓶，但背景不要抢主体。亚洲女性模特穿浅蓝色满版提花牛仔外套，内搭白色基础T恤，下身白色高腰短裤，搭配白色运动鞋。视频重点展示外套的浅蓝洗水质感、满版提花纹理、翻领、胸前双口袋、金属纽扣、袖口细节、短款衣摆和微宽松廓形。整体氛围清爽、轻奢、温柔、年轻化，像高级买手店里的春夏穿搭短片。人物动作自然、有生活感，但不要剧烈运动，商品始终清晰突出。

视频动作设计：视频从模特站在暖光空间中开始，她先自然看向镜头，然后缓慢向前走两小步。行走时头发轻轻晃动，衣摆和袖口随着步伐产生自然摆动。随后她轻轻转身约30度，展示外套侧面轮廓、肩线和短款比例。镜头切到中近景，她用一只手轻轻整理领口或袖口，动作细腻，不遮挡胸前口袋和主要图案。接着她从窗边暖光中自然回头，微微一笑，另一只手轻轻掠过衣摆，让牛仔面料产生真实褶皱。最后回到全身正面构图，模特自然站定，外套完整清晰露出，背景柔和虚化，阳光落在浅蓝牛仔外套表面，突出清爽高级的春夏出街感。

镜头分镜：01｜0-1秒：建立整体穿搭比例。02｜1-2.5秒：模特向前缓慢走两小步，牛仔外套衣摆和袖口自然摆动。03｜2.5-4秒：模特身体自然转向约30度，展示侧面轮廓、肩线结构、袖型、衣身厚度以及外套与白色短裤的比例。04｜4-5.5秒：切换为中近景，展示翻领、胸前双口袋、金属纽扣、浅蓝洗水质感、满版提花纹理和彩色点缀。05｜5.5-7秒：模特轻轻整理领口或袖口，衣服产生自然褶皱。06｜7-8秒：模特从窗边暖光中自然回头，全身正面定格，外套完整清晰露出。

Negative Prompt：衣服被手、头发、包袋、咖啡杯、围巾或任何道具遮挡；外套图案丢失；满版提花纹理模糊；图案跳变；浅蓝牛仔变成纯色布料；牛仔面料变成皮革、塑料、羽绒、丝绸、针织或亮面材质；外套版型变成长款、风衣、西装、衬衫、开衫或连衣裙；短款比例错误；肩线变形；胸前口袋消失；纽扣数量错误；袖口结构错误；衣摆不自然；衣服漂浮；布料不跟随身体运动；模特动作过大；跳舞；奔跑；夸张摆拍；人物比例失真；腿部过长或过短；手指变形；多余手指；面部僵硬；眼神空洞；走路姿势僵硬；背景过于抢眼；空间杂乱；过度虚化导致衣服不清晰；过曝；欠曝；低清晰度；过度磨皮；塑料皮肤；过度滤镜；卡通感；CG感；动漫感；新增无关logo；水印；乱码文字；品牌文字乱生成；画面闪烁；镜头晃动过大；服装细节在镜头之间不一致。`;
