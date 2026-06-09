import path from "node:path";
import { backgroundsDir, garmentUploadsDir, modelsDir, publicURL, threeViewsDir } from "./garmentPaths.js";
import { analyzeGarmentFromPhotos } from "./garmentVisionAnalyzer.js";
import { getGarmentSession, saveGarmentSession } from "./garmentSessionStore.js";
import type { GarmentSession, ThreeViewSet } from "./garmentTypes.js";
import { generateFinalGarmentVideoPrompt } from "./garmentPromptGenerator.js";
import { getRandomBackground } from "./backgroundService.js";
import { getRandomModelAsset } from "./modelAssetService.js";
import { generateThreeViewSets } from "./imageGeneration/garmentThreeViewGenerator.js";
import { generateVideoReferenceImage } from "./imageGeneration/garmentVideoReferenceGenerator.js";
import { checkPublicURL, createSignedTOSGetURL, publicTOSURLForKey } from "./seedance/tosClient.js";
import { createSeedanceTask, getSeedanceTaskStatus, SeedanceProviderError } from "./seedance/seedanceClient.js";
import { seedanceConfig } from "./seedance/config.js";
import { ensureVideoQuotaAvailable, markVideoGenerationSucceeded } from "./deviceUsageStore.js";

type UploadPreparedAssets = (params: {
  sessionId: string;
  selectedSetId: string;
  garmentThreeViewPath: string;
  videoReferenceImagePath: string;
  garmentFallbackRasterPath?: string;
  videoReferenceFallbackRasterPath?: string;
  throwOnFailure?: boolean;
}) => Promise<{
  tosGarmentImageKey?: string;
  tosGarmentImageUrl?: string;
  tosVideoReferenceImageKey?: string;
  tosVideoReferenceImageUrl?: string;
}>;

export const runningMaterialTasks = new Set<string>();
export const runningVideoTasks = new Set<string>();

export function startMaterialTask(params: {
  sessionId: string;
  selectedSetId: string;
  reqBaseURL: string;
  uploadPreparedSeedanceAssets: UploadPreparedAssets;
}): void {
  if (runningMaterialTasks.has(params.sessionId)) return;
  runningMaterialTasks.add(params.sessionId);
  void runMaterialTask(params).finally(() => runningMaterialTasks.delete(params.sessionId));
}

export function startVideoTask(params: {
  sessionId: string;
  selectedSetId: string;
  deviceId: string;
  reqBaseURL: string;
  uploadPreparedSeedanceAssets: UploadPreparedAssets;
}): void {
  if (runningVideoTasks.has(params.sessionId)) return;
  runningVideoTasks.add(params.sessionId);
  void runVideoTask(params).finally(() => runningVideoTasks.delete(params.sessionId));
}

export async function refreshSeedanceStatus(sessionId: string): Promise<GarmentSession | undefined> {
  const session = await getGarmentSession(sessionId);
  if (!session?.seedanceTaskId || session.generatedVideoUrl || session.status === "failed") return session;
  const status = await getSeedanceTaskStatus(session.seedanceTaskId);
  if (status.isDone && status.videoUrl) {
    const quota = await markVideoGenerationSucceeded(session.deviceId, session.seedanceTaskId);
    const updated = await updateSession(session, {
      status: "completed",
      currentStage: "completed",
      progressMessage: "视频已生成。",
      generatedVideoUrl: status.videoUrl,
      completedAt: new Date().toISOString()
    });
    console.log("[AsyncGarmentVideo] quota_incremented", {
      sessionId,
      taskId: session.seedanceTaskId,
      deviceId: session.deviceId,
      used: quota?.used,
      remaining: quota?.remaining
    });
    return updated;
  }
  if (status.isFailed) {
    return updateSession(session, {
      status: "failed",
      currentStage: "video_failed",
      errorMessage: status.failureMessage || status.failureCode || "视频生成失败，请稍后重试。",
      progressMessage: "视频生成失败。"
    });
  }
  return updateSession(session, {
    status: "video_processing",
    currentStage: "video_processing",
    progressMessage: `视频正在生成中，当前状态：${status.status || "processing"}。`
  });
}

async function runMaterialTask(params: {
  sessionId: string;
  selectedSetId: string;
  reqBaseURL: string;
  uploadPreparedSeedanceAssets: UploadPreparedAssets;
}): Promise<void> {
  const startedAt = Date.now();
  let session = await getGarmentSession(params.sessionId);
  if (!session) return;
  try {
    session = await updateSession(session, {
      status: "processing",
      currentStage: "vision_analysis",
      progressMessage: "正在分析衣服款式。"
    });
    console.log("[AsyncGarmentMaterial] vision_analysis_start", { sessionId: params.sessionId });
    const garmentAnalysis = await analyzeGarmentFromPhotos({
      frontImagePath: session.frontImagePath,
      backImagePath: session.backImagePath
    });
    session = await updateSession(session, {
      garmentAnalysis,
      currentStage: "three_view_generation",
      progressMessage: "正在生成服装三视图。"
    });
    console.log("[AsyncGarmentMaterial] three_view_generation_start", { sessionId: params.sessionId });
    const { sets, generationStatus } = await generateThreeViewSets({
      frontImagePath: session.frontImagePath,
      backImagePath: session.backImagePath,
      frontImageUrl: session.frontImageUrl,
      backImageUrl: session.backImageUrl,
      garmentAnalysis,
      sessionId: session.sessionId,
      reqBaseURL: params.reqBaseURL
    });
    const selectedSet = sets.find((item) => item.id === params.selectedSetId) ?? sets[0];
    session = await updateSession(session, {
      sets,
      selectedSet,
      generationStatus,
      currentStage: "video_reference_generation",
      progressMessage: "正在生成视频参考图。"
    });
    if (!selectedSet) throw new Error("三视图生成失败，请重新上传照片。");

    const background = await getRandomBackground(params.reqBaseURL);
    const modelAsset = await getRandomModelAsset(params.reqBaseURL);
    const garmentThreeViewPath = resolvePublicAssetPath(selectedSet.threeViewImageUrl ?? selectedSet.frontViewUrl);
    const backgroundPath = path.join(backgroundsDir, background.filename);
    const { videoReferenceImageUrl, videoReferenceGenerationStatus } = await generateVideoReferenceImage({
      sessionId: session.sessionId,
      selectedSet,
      garmentThreeViewPath,
      modelAsset,
      background,
      backgroundPath,
      fallbackImagePath: session.frontImagePath,
      fallbackImageUrl: session.frontImageUrl,
      reqBaseURL: params.reqBaseURL
    });
    const videoReferenceImagePath = resolvePublicAssetPath(videoReferenceImageUrl);
    const tosPreparedAssets = await params.uploadPreparedSeedanceAssets({
      sessionId: session.sessionId,
      selectedSetId: selectedSet.id,
      garmentThreeViewPath,
      videoReferenceImagePath,
      garmentFallbackRasterPath: session.frontImagePath,
      videoReferenceFallbackRasterPath: session.frontImagePath,
      throwOnFailure: false
    });
    await updateSession(session, {
      status: "ready_for_video",
      currentStage: "ready_for_video",
      progressMessage: "视频素材已准备好。",
      background,
      modelAsset: stripLocalPath(modelAsset),
      videoReferenceImageUrl,
      videoReferenceGenerationStatus,
      ...tosPreparedAssets
    });
    console.log("[AsyncGarmentMaterial] done", {
      sessionId: params.sessionId,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    console.warn("[AsyncGarmentMaterial] failed", {
      sessionId: params.sessionId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown material task error"
    });
    const latest = await getGarmentSession(params.sessionId);
    if (latest) {
      await updateSession(latest, {
        status: "failed",
        currentStage: "material_failed",
        errorMessage: "素材生成失败，请重新上传照片。",
        progressMessage: "素材生成失败。"
      });
    }
  }
}

async function runVideoTask(params: {
  sessionId: string;
  selectedSetId: string;
  deviceId: string;
  reqBaseURL: string;
  uploadPreparedSeedanceAssets: UploadPreparedAssets;
}): Promise<void> {
  const startedAt = Date.now();
  let session = await getGarmentSession(params.sessionId);
  if (!session) return;
  try {
    const selectedSet = session.selectedSet ?? session.sets.find((item) => item.id === params.selectedSetId);
    const garmentAnalysis = session.garmentAnalysis;
    const background = session.background;
    const modelAsset = session.modelAsset;
    const videoReferenceImageUrl = session.videoReferenceImageUrl;
    if (!selectedSet || !garmentAnalysis || !background || !modelAsset || !videoReferenceImageUrl) {
      throw new Error("视频素材还没准备好。");
    }
    await ensureVideoQuotaAvailable(params.deviceId);
    session = await updateSession(session, {
      deviceId: params.deviceId,
      selectedSet,
      status: "video_processing",
      currentStage: "prompt_generation",
      progressMessage: "正在生成视频提示词。"
    });
    const finalVideoPrompt = await generateFinalGarmentVideoPrompt({
      garmentAnalysis,
      selectedSet,
      background,
      modelAsset,
      garmentThreeViewPath: resolvePublicAssetPath(selectedSet.threeViewImageUrl ?? selectedSet.frontViewUrl),
      videoReferenceImagePath: resolvePublicAssetPath(videoReferenceImageUrl)
    });
    session = await updateSession(session, {
      finalVideoPrompt,
      currentStage: "seedance_submit",
      progressMessage: "正在提交视频生成任务。"
    });
    const urls = await ensureTOSAssets(session, selectedSet, params.uploadPreparedSeedanceAssets);
    const referenceVideoPublicUrl = seedanceConfig.referenceVideoUrl || publicTOSURLForKey(seedanceConfig.referenceVideoFilename);
    const referenceVideoUrl = seedanceConfig.referenceVideoUrl || createSignedTOSGetURL(seedanceConfig.referenceVideoFilename);
    const referenceVideoCheck = await checkPublicURL(referenceVideoUrl, "seedance_reference_video");
    if (!referenceVideoCheck.ok) {
      throw new Error(`参考视频不可访问：${referenceVideoPublicUrl}`);
    }

    let result;
    try {
      result = await createSeedanceTask({
        prompt: buildSeedancePrompt(finalVideoPrompt),
        garmentImageUrl: urls.garmentImageUrl,
        videoReferenceImageUrl: urls.videoReferenceImageUrl,
        referenceVideoUrl
      });
    } catch (error) {
      if (
        error instanceof SeedanceProviderError &&
        error.isReferenceVideoSensitive &&
        seedanceConfig.fallbackWithoutReferenceVideoOnSensitive
      ) {
        result = await createSeedanceTask({
          prompt: `${finalVideoPrompt}\n\n注意：本次生成不使用参考视频，只参考上传的服装三视图和视频参考图，请保持画面稳定、动作自然、服装主体清晰。`,
          garmentImageUrl: urls.garmentImageUrl,
          videoReferenceImageUrl: urls.videoReferenceImageUrl
        });
      } else {
        throw error;
      }
    }
    session = await updateSession(session, {
      seedanceTaskId: result.taskId,
      status: "video_processing",
      currentStage: "video_processing",
      progressMessage: "视频任务已提交，可以稍后回来查看结果。"
    });
    console.log("[AsyncGarmentVideo] task_submitted", {
      sessionId: params.sessionId,
      taskId: result.taskId,
      durationMs: Date.now() - startedAt
    });
    await refreshSeedanceStatus(session.sessionId);
  } catch (error) {
    console.warn("[AsyncGarmentVideo] failed", {
      sessionId: params.sessionId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown video task error"
    });
    const latest = await getGarmentSession(params.sessionId);
    if (latest) {
      await updateSession(latest, {
        status: "failed",
        currentStage: "video_failed",
        errorMessage: error instanceof Error ? error.message : "视频生成失败，请稍后重试。",
        progressMessage: "视频生成失败。"
      });
    }
  }
}

async function ensureTOSAssets(
  session: GarmentSession,
  selectedSet: ThreeViewSet,
  uploadPreparedSeedanceAssets: UploadPreparedAssets
): Promise<{ garmentImageUrl: string; videoReferenceImageUrl: string }> {
  let garmentImageKey = session.tosGarmentImageKey;
  let videoReferenceImageKey = session.tosVideoReferenceImageKey;
  if (!garmentImageKey || !videoReferenceImageKey) {
    const uploaded = await uploadPreparedSeedanceAssets({
      sessionId: session.sessionId,
      selectedSetId: selectedSet.id,
      garmentThreeViewPath: resolvePublicAssetPath(selectedSet.threeViewImageUrl ?? selectedSet.frontViewUrl),
      videoReferenceImagePath: resolvePublicAssetPath(session.videoReferenceImageUrl ?? session.frontImageUrl),
      garmentFallbackRasterPath: session.frontImagePath,
      videoReferenceFallbackRasterPath: session.frontImagePath,
      throwOnFailure: true
    });
    garmentImageKey = uploaded.tosGarmentImageKey;
    videoReferenceImageKey = uploaded.tosVideoReferenceImageKey;
    await updateSession(session, uploaded);
  }
  if (!garmentImageKey || !videoReferenceImageKey) throw new Error("视频素材上传失败，请稍后重试。");
  return {
    garmentImageUrl: createSignedTOSGetURL(garmentImageKey),
    videoReferenceImageUrl: createSignedTOSGetURL(videoReferenceImageKey)
  };
}

async function updateSession(session: GarmentSession, patch: Partial<GarmentSession>): Promise<GarmentSession> {
  const next = { ...session, ...patch, updatedAt: new Date().toISOString() };
  await saveGarmentSession(next);
  return next;
}

function stripLocalPath<T extends { localPath?: string }>(asset: T): Omit<T, "localPath"> {
  const { localPath: _localPath, ...publicAsset } = asset;
  return publicAsset;
}

function resolvePublicAssetPath(urlString: string): string {
  const pathname = new URL(urlString).pathname;
  const filename = decodeURIComponent(path.basename(pathname));
  if (pathname.startsWith("/uploads/garments/")) return path.join(garmentUploadsDir, filename);
  if (pathname.startsWith("/generated/three-views/")) return path.join(threeViewsDir, filename);
  if (pathname.startsWith("/assets/backgrounds/")) return path.join(backgroundsDir, filename);
  if (pathname.startsWith("/assets/models/")) return path.join(modelsDir, filename);
  return path.join(threeViewsDir, filename);
}

function buildSeedancePrompt(finalPrompt: string): string {
  return `最高优先级：最终视频必须是真实真人实拍风格、商业服装街拍广告片质感，不是动漫、不是插画、不是CG、不是3D渲染。上传的人物参考图如果包含动漫脸或动漫角色，只作为服装结构、发型长度、身体姿态、三视图角度、身材比例和穿搭轮廓参考，不要继承动漫画风、动漫脸型、二次元眼睛、线稿边缘、赛璐璐阴影或卡通比例。请将参考人物真人化转译为真实亚洲年轻女性模特：真实人脸、真实五官比例、自然眼睛大小、真实鼻梁和嘴唇、自然皮肤纹理、真实头身比例、真实骨相和真实光影。
\n\n${finalPrompt}
\n\nno anime face, no manga eyes, no cel shading, no illustration style, no line art, no cartoon proportions, no 3D doll face, no CGI skin, no virtual idol look, no cosplay look, no stylized character face, no oversized eyes, no porcelain skin.
\n\n视频参考：针对参考视频，只参考动作节奏、身体姿态、运镜轨迹和构图，不参考人物外貌、脸型、发型、服装、画风、颜色和动漫比例。`;
}
