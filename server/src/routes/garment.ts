import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import { getRandomBackground } from "../services/backgroundService.js";
import { backgroundsDir, garmentUploadsDir, modelsDir, publicURL, threeViewsDir } from "../services/garmentPaths.js";
import { parseGarmentImageUpload } from "../services/multipartImageUpload.js";
import { analyzeGarmentFromPhotos } from "../services/garmentVisionAnalyzer.js";
import { generateThreeViewSets } from "../services/imageGeneration/garmentThreeViewGenerator.js";
import { saveGarmentSession, getGarmentSession, listGarmentSessionsForDevice } from "../services/garmentSessionStore.js";
import { generateFinalGarmentVideoPrompt } from "../services/garmentPromptGenerator.js";
import { getRandomModelAsset } from "../services/modelAssetService.js";
import { generateVideoReferenceImage } from "../services/imageGeneration/garmentVideoReferenceGenerator.js";
import { checkPublicURL, createSignedTOSGetURL, publicTOSURLForKey, uploadFileToTOS } from "../services/seedance/tosClient.js";
import { createSeedanceTask, getSeedanceTaskStatus, SeedanceProviderError } from "../services/seedance/seedanceClient.js";
import { seedanceConfig } from "../services/seedance/config.js";
import { ensureVideoQuotaAvailable, getVideoQuota, markVideoGenerationSucceeded } from "../services/deviceUsageStore.js";
import { refreshSeedanceStatus, runningMaterialTasks, runningVideoTasks, startMaterialTask, startVideoTask } from "../services/garmentAsyncWorkflow.js";
import type { GarmentSession } from "../services/garmentTypes.js";

export const garmentRouter = Router();

garmentRouter.get("/video-quota", async (req, res, next) => {
  try {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : "";
    if (!deviceId.trim()) {
      return res.status(400).json({ error: { code: "MISSING_DEVICE_ID", message: "缺少设备信息。", details: {} } });
    }
    res.json(await getVideoQuota(deviceId));
  } catch (error) {
    next(error);
  }
});

garmentRouter.get("/session-status", async (req, res, next) => {
  try {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    if (!sessionId.trim()) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "缺少生成记录。", details: {} } });
    }
    const session = await getGarmentSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "生成记录已失效，请重新上传照片。", details: {} } });
    }
    res.json({
      sessionId: session.sessionId,
      hasThreeView: session.sets.length > 0,
      hasVideoReference: Boolean(session.videoReferenceImageUrl),
      hasFinalPrompt: Boolean(session.finalVideoPrompt),
      seedanceTaskId: session.seedanceTaskId ?? null,
      generatedVideoUrl: session.generatedVideoUrl ?? null,
      createdAt: session.createdAt
    });
  } catch (error) {
    next(error);
  }
});

garmentRouter.get("/tasks", async (req, res, next) => {
  try {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : "";
    if (!deviceId.trim()) {
      return res.status(400).json({ error: { code: "MISSING_DEVICE_ID", message: "缺少设备信息。", details: {} } });
    }
    const sessions = await listGarmentSessionsForDevice(deviceId);
    res.json({
      deviceId,
      tasks: sessions.map((session) => summarizeSession(session))
    });
  } catch (error) {
    next(error);
  }
});

garmentRouter.get("/tasks/:sessionId", async (req, res, next) => {
  try {
    const session = await refreshSeedanceStatus(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "生成记录已失效，请重新上传照片。", details: {} } });
    }
    res.json(summarizeSession(session));
  } catch (error) {
    next(error);
  }
});

garmentRouter.post("/material-tasks", async (req, res, next) => {
  const startedAt = Date.now();
  const sessionId = randomUUID();
  try {
    const reqBaseURL = requestBaseURL(req);
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : "";
    if (!deviceId.trim()) {
      return res.status(400).json({ error: { code: "MISSING_DEVICE_ID", message: "缺少设备信息。", details: {} } });
    }
    console.log("[AsyncGarmentMaterial] upload_request_start", {
      sessionId,
      deviceId,
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"] ?? "unknown"
    });
    const uploaded = await parseGarmentImageUpload(req, garmentUploadsDir);
    const frontImageUrl = publicURL(reqBaseURL, "/uploads/garments", uploaded.frontImage.filename);
    const backImageUrl = publicURL(reqBaseURL, "/uploads/garments", uploaded.backImage.filename);
    const session: GarmentSession = {
      sessionId,
      deviceId,
      status: "queued",
      currentStage: "queued",
      progressMessage: "照片已上传，正在排队生成素材。",
      frontImagePath: uploaded.frontImage.path,
      backImagePath: uploaded.backImage.path,
      frontImageUrl,
      backImageUrl,
      sets: [],
      createdAt: new Date().toISOString()
    };
    await saveGarmentSession(session);
    console.log("[AsyncGarmentMaterial] upload_saved", {
      sessionId,
      deviceId,
      frontFile: uploaded.frontImage.filename,
      backFile: uploaded.backImage.filename,
      durationMs: Date.now() - startedAt
    });
    startMaterialTask({
      sessionId,
      selectedSetId: "set_1",
      reqBaseURL,
      uploadPreparedSeedanceAssets
    });
    res.status(202).json(summarizeSession(session));
  } catch (error) {
    console.warn("[AsyncGarmentMaterial] upload_failed", {
      sessionId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown async upload error"
    });
    next(error);
  }
});

garmentRouter.post("/tasks/:sessionId/generate-video", async (req, res, next) => {
  try {
    const { selectedSetId, deviceId } = req.body ?? {};
    if (typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ error: { code: "MISSING_DEVICE_ID", message: "缺少设备信息。", details: {} } });
    }
    const session = await getGarmentSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "生成记录已失效，请重新上传照片。", details: {} } });
    }
    if (!session.videoReferenceImageUrl) {
      return res.status(400).json({ error: { code: "MATERIAL_NOT_READY", message: "视频素材还在生成中，请稍后再试。", details: {} } });
    }
    const nextSession: GarmentSession = {
      ...session,
      deviceId,
      status: "video_processing",
      currentStage: "video_queued",
      progressMessage: "视频任务已开始，请稍后回来查看结果。"
    };
    await saveGarmentSession(nextSession);
    startVideoTask({
      sessionId: session.sessionId,
      selectedSetId: typeof selectedSetId === "string" ? selectedSetId : session.selectedSet?.id ?? "set_1",
      deviceId,
      reqBaseURL: requestBaseURL(req),
      uploadPreparedSeedanceAssets
    });
    res.status(202).json(summarizeSession(nextSession));
  } catch (error) {
    next(error);
  }
});

garmentRouter.post("/generate-three-view-sets", async (req, res, next) => {
  const startedAt = Date.now();
  let sessionId = "";
  try {
    const reqBaseURL = requestBaseURL(req);
    sessionId = randomUUID();
    console.log("[GarmentWorkflow] upload_request_start", {
      sessionId,
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"] ?? "unknown"
    });
    const uploaded = await parseGarmentImageUpload(req, garmentUploadsDir);
    console.log("[GarmentWorkflow] upload_saved", {
      sessionId,
      frontFile: uploaded.frontImage.filename,
      backFile: uploaded.backImage.filename,
      durationMs: Date.now() - startedAt
    });

    console.log("[GarmentWorkflow] vision_analysis_start", { sessionId });
    const garmentAnalysis = await analyzeGarmentFromPhotos({
      frontImagePath: uploaded.frontImage.path,
      backImagePath: uploaded.backImage.path
    });
    console.log("[GarmentWorkflow] vision_analysis_done", {
      sessionId,
      category: garmentAnalysis.category,
      style: garmentAnalysis.style,
      durationMs: Date.now() - startedAt
    });

    const frontImageUrl = publicURL(reqBaseURL, "/uploads/garments", uploaded.frontImage.filename);
    const backImageUrl = publicURL(reqBaseURL, "/uploads/garments", uploaded.backImage.filename);
    console.log("[GarmentWorkflow] three_view_generation_start", { sessionId });
    const { sets, generationStatus } = await generateThreeViewSets({
      frontImagePath: uploaded.frontImage.path,
      backImagePath: uploaded.backImage.path,
      frontImageUrl,
      backImageUrl,
      garmentAnalysis,
      sessionId,
      reqBaseURL
    });
    console.log("[GarmentWorkflow] three_view_generation_done", {
      sessionId,
      usedMock: generationStatus.usedMock,
      mode: generationStatus.imageGenerationMode,
      setCount: sets.length,
      durationMs: Date.now() - startedAt
    });

    await saveGarmentSession({
      sessionId,
      frontImagePath: uploaded.frontImage.path,
      backImagePath: uploaded.backImage.path,
      frontImageUrl,
      backImageUrl,
      garmentAnalysis,
      sets,
      generationStatus,
      createdAt: new Date().toISOString()
    });
    console.log("[GarmentWorkflow] response_sent", {
      sessionId,
      durationMs: Date.now() - startedAt
    });

    res.json({ sessionId, garmentAnalysis, sets, generationStatus });
  } catch (error) {
    console.warn("[GarmentWorkflow] request_failed", {
      sessionId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown workflow error"
    });
    next(error);
  }
});

garmentRouter.post("/prepare-video-prompts", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const { sessionId, selectedSetId } = req.body ?? {};
    if (typeof sessionId !== "string" || typeof selectedSetId !== "string") {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "请选择一组三视图。", details: {} } });
    }

    const session = await getGarmentSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "生成记录已失效，请重新上传照片。", details: {} } });
    }
    const selectedSet = session.sets.find((item) => item.id === selectedSetId);
    if (!selectedSet) {
      return res.status(404).json({ error: { code: "SET_NOT_FOUND", message: "请选择一组三视图。", details: {} } });
    }

    const background = await getRandomBackground(requestBaseURL(req));
    const modelAsset = await getRandomModelAsset(requestBaseURL(req));
    const garmentThreeViewPath = resolvePublicAssetPath(selectedSet.threeViewImageUrl ?? selectedSet.frontViewUrl);
    const backgroundPath = path.join(backgroundsDir, background.filename);
    console.log("[GarmentMaterialWorkflow] video_reference_generation_start", {
      sessionId,
      selectedSetId,
      model: modelAsset.filename,
      background: background.filename,
      isFallbackBackground: background.isFallback === true
    });
    const { videoReferenceImageUrl, videoReferenceGenerationStatus } = await generateVideoReferenceImage({
      sessionId,
      selectedSet,
      garmentThreeViewPath,
      modelAsset,
      background,
      backgroundPath,
      fallbackImagePath: session.frontImagePath,
      fallbackImageUrl: session.frontImageUrl,
      reqBaseURL: requestBaseURL(req)
    });
    console.log("[GarmentMaterialWorkflow] video_reference_generation_done", {
      sessionId,
      selectedSetId,
      usedMock: videoReferenceGenerationStatus.usedMock,
      durationMs: Date.now() - startedAt
    });

    const videoReferenceImagePath = resolvePublicAssetPath(videoReferenceImageUrl);
    const tosPreparedAssets = await uploadPreparedSeedanceAssets({
      sessionId,
      selectedSetId,
      garmentThreeViewPath,
      videoReferenceImagePath,
      garmentFallbackRasterPath: session.frontImagePath,
      videoReferenceFallbackRasterPath: session.frontImagePath,
      throwOnFailure: false
    });

    await saveGarmentSession({
      ...session,
      selectedSet,
      background,
      modelAsset: stripLocalPath(modelAsset),
      videoReferenceImageUrl,
      videoReferenceGenerationStatus,
      ...tosPreparedAssets
    });

    res.json({
      sessionId: session.sessionId,
      garmentAnalysis: session.garmentAnalysis,
      selectedSet,
      modelAsset: stripLocalPath(modelAsset),
      background,
      videoReferenceImageUrl,
      videoReferenceGenerationStatus,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("[GarmentMaterialWorkflow] request_failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown prompt workflow error"
    });
    next(error);
  }
});

garmentRouter.post("/generate-video-prompt", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const { sessionId, selectedSetId } = req.body ?? {};
    if (typeof sessionId !== "string" || typeof selectedSetId !== "string") {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "请选择一组三视图。", details: {} } });
    }

    const session = await getGarmentSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "生成记录已失效，请重新上传照片。", details: {} } });
    }
    const selectedSet = session.selectedSet ?? session.sets.find((item) => item.id === selectedSetId);
    const garmentAnalysis = session.garmentAnalysis;
    const background = session.background;
    const modelAsset = session.modelAsset;
    const videoReferenceImageUrl = session.videoReferenceImageUrl;
    if (!selectedSet || !garmentAnalysis || !background || !modelAsset || !videoReferenceImageUrl) {
      return res.status(400).json({ error: { code: "MATERIAL_NOT_READY", message: "请先生成视频参考图。", details: {} } });
    }

    console.log("[GarmentPromptWorkflow] final_prompt_generation_start", { sessionId, selectedSetId });
    const finalVideoPrompt = await generateFinalGarmentVideoPrompt({
      garmentAnalysis,
      selectedSet,
      background,
      modelAsset,
      garmentThreeViewPath: resolvePublicAssetPath(selectedSet.threeViewImageUrl ?? selectedSet.frontViewUrl),
      videoReferenceImagePath: resolvePublicAssetPath(videoReferenceImageUrl)
    });
    console.log("[GarmentPromptWorkflow] final_prompt_generation_done", {
      sessionId,
      selectedSetId,
      durationMs: Date.now() - startedAt
    });

    await saveGarmentSession({ ...session, selectedSet, finalVideoPrompt });
    res.json({
      sessionId,
      prompt: finalVideoPrompt,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("[GarmentPromptWorkflow] request_failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown final prompt workflow error"
    });
    next(error);
  }
});

garmentRouter.post("/generate-video", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const { sessionId, selectedSetId, prompt, deviceId } = req.body ?? {};
    if (typeof sessionId !== "string" || typeof selectedSetId !== "string") {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "请选择一组三视图。", details: {} } });
    }
    if (typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ error: { code: "MISSING_DEVICE_ID", message: "缺少设备信息。", details: {} } });
    }

    const session = await getGarmentSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "生成记录已失效，请重新上传照片。", details: {} } });
    }
    const selectedSet = session.selectedSet ?? session.sets.find((item) => item.id === selectedSetId);
    const finalPrompt = typeof prompt === "string" && prompt.trim() ? prompt.trim() : session.finalVideoPrompt;
    if (!selectedSet || !session.videoReferenceImageUrl || !finalPrompt) {
      return res.status(400).json({ error: { code: "MATERIAL_NOT_READY", message: "请先生成视频提示词。", details: {} } });
    }

    console.log("[SeedanceWorkflow] submit_start", {
      sessionId,
      selectedSetId,
      deviceId,
      promptLength: finalPrompt.length
    });
    const quota = await ensureVideoQuotaAvailable(deviceId);
    console.log("[SeedanceWorkflow] quota_checked", {
      sessionId,
      deviceId,
      used: quota.used,
      remaining: quota.remaining,
      limit: quota.limit
    });

    let garmentImageKey = session.tosGarmentImageKey;
    let videoReferenceImageKey = session.tosVideoReferenceImageKey;
    let garmentImagePublicUrl = session.tosGarmentImageUrl;
    let videoReferenceImagePublicUrl = session.tosVideoReferenceImageUrl;
    if (!garmentImageKey || !videoReferenceImageKey || !garmentImagePublicUrl || !videoReferenceImagePublicUrl) {
      const garmentThreeViewPath = resolvePublicAssetPath(selectedSet.threeViewImageUrl ?? selectedSet.frontViewUrl);
      const videoReferenceImagePath = resolvePublicAssetPath(session.videoReferenceImageUrl);
      const uploaded = await uploadPreparedSeedanceAssets({
        sessionId,
        selectedSetId,
        garmentThreeViewPath,
        videoReferenceImagePath,
        garmentFallbackRasterPath: session.frontImagePath,
        videoReferenceFallbackRasterPath: session.frontImagePath,
        throwOnFailure: true
      });
      garmentImageKey = uploaded.tosGarmentImageKey;
      videoReferenceImageKey = uploaded.tosVideoReferenceImageKey;
      garmentImagePublicUrl = uploaded.tosGarmentImageUrl;
      videoReferenceImagePublicUrl = uploaded.tosVideoReferenceImageUrl;
      await saveGarmentSession({ ...session, selectedSet, finalVideoPrompt: finalPrompt, ...uploaded });
    } else {
      console.log("[SeedanceWorkflow] reuse_prepared_tos_assets", {
        sessionId,
        selectedSetId,
        garmentImageKey,
        garmentImagePublicUrl,
        videoReferenceImageKey,
        videoReferenceImagePublicUrl
      });
    }

    if (!garmentImageKey || !videoReferenceImageKey || !garmentImagePublicUrl || !videoReferenceImagePublicUrl) {
      return res.status(502).json({
        error: {
          code: "TOS_UPLOAD_FAILED",
          message: "视频素材上传失败，请稍后重试。",
          details: {}
        }
      });
    }

    const garmentImageUrl = createSignedTOSGetURL(garmentImageKey);
    const videoReferenceImageUrl = createSignedTOSGetURL(videoReferenceImageKey);
    console.log("[SeedanceWorkflow] sources_ready", {
      sessionId,
      selectedSetId,
      garmentImagePublicUrl,
      videoReferenceImagePublicUrl,
      garmentImageSignedHost: safeURLHost(garmentImageUrl),
      videoReferenceImageSignedHost: safeURLHost(videoReferenceImageUrl)
    });

    const referenceVideoPublicUrl = seedanceConfig.referenceVideoUrl || publicTOSURLForKey(seedanceConfig.referenceVideoFilename);
    const referenceVideoUrl = seedanceConfig.referenceVideoUrl || createSignedTOSGetURL(seedanceConfig.referenceVideoFilename);
    console.log("[SeedanceWorkflow] reference_video_check_start", {
      sessionId,
      referenceVideo: seedanceConfig.referenceVideoFilename,
      publicUrl: referenceVideoPublicUrl,
      checkUrlHost: safeURLHost(referenceVideoUrl),
      usesExplicitReferenceVideoUrl: Boolean(seedanceConfig.referenceVideoUrl)
    });
    const referenceVideoCheck = await checkPublicURL(referenceVideoUrl, "seedance_reference_video");
    console.log("[SeedanceWorkflow] reference_video_check_done", {
      sessionId,
      ok: referenceVideoCheck.ok,
      status: referenceVideoCheck.status
    });
    if (!referenceVideoCheck.ok) {
      console.warn("[SeedanceWorkflow] reference_video_unavailable_skip_submit", {
        sessionId,
        referenceVideoPublicUrl,
        checkedHost: safeURLHost(referenceVideoUrl),
        status: referenceVideoCheck.status,
        durationMs: Date.now() - startedAt
      });
      return res.status(502).json({
        error: {
          code: "REFERENCE_VIDEO_UNAVAILABLE",
          message: "参考视频不可访问，请检查对象存储中的 video-case.mp4。",
          details: {
            status: referenceVideoCheck.status
          }
        }
      });
    }

    console.log("[SeedanceWorkflow] task_submit_start", {
      sessionId,
      garmentImageHost: safeURLHost(garmentImageUrl),
      videoReferenceImageHost: safeURLHost(videoReferenceImageUrl),
      referenceVideo: seedanceConfig.referenceVideoUrl ? "explicit_url" : seedanceConfig.referenceVideoFilename,
      referenceVideoHost: safeURLHost(referenceVideoUrl),
      model: seedanceConfig.model,
      ratio: seedanceConfig.ratio,
      duration: seedanceConfig.duration
    });
    let result;
    try {
      result = await createSeedanceTask({
        prompt: `最高优先级：最终视频必须是真实真人实拍风格、商业服装街拍广告片质感，不是动漫、不是插画、不是CG、不是3D渲染。上传的人物参考图如果包含动漫脸或动漫角色，只作为服装结构、发型长度、身体姿态、三视图角度、身材比例和穿搭轮廓参考，不要继承动漫画风、动漫脸型、二次元眼睛、线稿边缘、赛璐璐阴影或卡通比例。请将参考人物真人化转译为真实亚洲年轻女性模特：真实人脸、真实五官比例、自然眼睛大小、真实鼻梁和嘴唇、自然皮肤纹理、真实头身比例、真实骨相和真实光影。角色看起来像真人模特在真实街景中被相机拍摄，而不是动漫角色真人化滤镜。
Reference image is not a style reference. It is only a clothing, pose, hairstyle length and body-shape reference. Final output must be photorealistic live-action video with a real Asian female model.
\n\n${finalPrompt},不要动漫脸，不要二次元大眼睛，不要漫画感，不要插画感，不要赛璐璐渲染，不要线稿边缘，不要2D角色感，不要3D娃娃脸，不要CG皮肤，不要游戏角色感，不要AI网红脸过度磨皮，不要塑料皮肤，不要瓷娃娃质感，不要夸张小下巴，不要过大的眼睛，不要过尖的鼻子，不要过小的嘴，不要头大身小，不要动漫头身比例，不要cosplay感，不要像虚拟偶像。
no anime face, no manga eyes, no cel shading, no illustration style, no line art, no cartoon proportions, no 3D doll face, no CGI skin, no virtual idol look, no cosplay look, no stylized character face, no oversized eyes, no tiny nose, no porcelain skin.
\n\n
视频参考：针对参考视频，只参考动作节奏、身体姿态、运镜轨迹和构图，不参考人物外貌、脸型、发型、服装、画风、颜色和动漫比例。不要动漫风格，不要卡通感，不要赛璐璐渲染，不要大眼睛，不要夸张肢体变形，保持真实人体比例和真实物理运动。`,
        garmentImageUrl,
        videoReferenceImageUrl,
        referenceVideoUrl
      });
    } catch (error) {
      if (
        error instanceof SeedanceProviderError &&
        error.isReferenceVideoSensitive &&
        seedanceConfig.fallbackWithoutReferenceVideoOnSensitive
      ) {
        console.warn("[SeedanceWorkflow] reference_video_sensitive_retry_without_video", {
          sessionId,
          status: error.status,
          referenceVideo: seedanceConfig.referenceVideoUrl ? "explicit_url" : seedanceConfig.referenceVideoFilename
        });
        result = await createSeedanceTask({
          prompt: `${finalPrompt}\n\n注意：本次生成不使用参考视频，只参考上传的服装三视图和视频参考图，请保持画面稳定、动作自然、服装主体清晰。`,
          garmentImageUrl,
          videoReferenceImageUrl
        });
      } else {
        throw error;
      }
    }
    console.log("[SeedanceWorkflow] task_submitted", {
      sessionId,
      taskId: result.taskId,
      status: result.status,
      durationMs: Date.now() - startedAt
    });

    await saveGarmentSession({
      ...session,
      selectedSet,
      finalVideoPrompt: finalPrompt,
      deviceId,
      seedanceTaskId: result.taskId
    });
    res.json({
      sessionId,
      taskId: result.taskId,
      status: result.status || "submitted",
      quota,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("[SeedanceWorkflow] request_failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown seedance workflow error"
    });
    next(error);
  }
});

garmentRouter.post("/video-task-status", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const { sessionId, taskId } = req.body ?? {};
    if (typeof sessionId !== "string" || typeof taskId !== "string") {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "缺少视频任务信息。", details: {} } });
    }

    const session = await getGarmentSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "生成记录已失效，请重新上传照片。", details: {} } });
    }
    if (session.seedanceTaskId && session.seedanceTaskId !== taskId) {
      return res.status(400).json({ error: { code: "TASK_MISMATCH", message: "视频任务不匹配，请重新生成。", details: {} } });
    }

    console.log("[SeedanceWorkflow] task_status_check", { sessionId, taskId });
    const status = await getSeedanceTaskStatus(taskId);
    console.log("[SeedanceWorkflow] task_status_done", {
      sessionId,
      taskId,
      status: status.status,
      hasVideoUrl: Boolean(status.videoUrl),
      failureCode: status.failureCode,
      failureMessage: status.failureMessage,
      isDone: status.isDone,
      isFailed: status.isFailed,
      durationMs: Date.now() - startedAt
    });

    if (status.videoUrl && status.isDone) {
      const quota = await markVideoGenerationSucceeded(session.deviceId, taskId);
      await saveGarmentSession({
        ...session,
        seedanceTaskId: taskId,
        generatedVideoUrl: status.videoUrl
      });
      console.log("[SeedanceWorkflow] quota_incremented", {
        sessionId,
        taskId,
        deviceId: session.deviceId,
        used: quota?.used,
        remaining: quota?.remaining
      });
    } else if (!session.seedanceTaskId) {
      await saveGarmentSession({ ...session, seedanceTaskId: taskId });
    }

    res.json({
      sessionId,
      taskId,
      status: status.status,
      videoUrl: status.isDone ? status.videoUrl : null,
      failureCode: status.failureCode ?? null,
      failureMessage: status.failureMessage ?? null,
      isDone: status.isDone,
      isFailed: status.isFailed,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("[SeedanceWorkflow] task_status_failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown seedance status error"
    });
    next(error);
  }
});

export const backgroundsRouter = Router();

backgroundsRouter.get("/random", async (req, res, next) => {
  try {
    res.json(await getRandomBackground(requestBaseURL(req)));
  } catch (error) {
    next(error);
  }
});

function requestBaseURL(req: { protocol: string; get(name: string): string | undefined }): string {
  return `${req.protocol}://${req.get("host")}`;
}

function stripLocalPath<T extends { localPath?: string }>(asset: T): Omit<T, "localPath"> {
  const { localPath: _localPath, ...publicAsset } = asset;
  return publicAsset;
}

async function uploadPreparedSeedanceAssets(params: {
  sessionId: string;
  selectedSetId: string;
  garmentThreeViewPath: string;
  videoReferenceImagePath: string;
  garmentFallbackRasterPath?: string;
  videoReferenceFallbackRasterPath?: string;
  throwOnFailure?: boolean;
}): Promise<{
  tosGarmentImageKey?: string;
  tosGarmentImageUrl?: string;
  tosVideoReferenceImageKey?: string;
  tosVideoReferenceImageUrl?: string;
}> {
  const startedAt = Date.now();
  const prefix = `runway-prompt-studio/${params.sessionId}`;
  console.log("[SeedanceMaterialUpload] upload_sources_start", {
    sessionId: params.sessionId,
    selectedSetId: params.selectedSetId,
    garmentThreeViewFile: path.basename(params.garmentThreeViewPath),
    videoReferenceFile: path.basename(params.videoReferenceImagePath),
    tosBucket: seedanceConfig.tosBucket,
    tosHost: seedanceConfig.tosBucketDomain
  });

  try {
    const garmentUploadPath = seedanceCompatibleImagePath(params.garmentThreeViewPath, params.garmentFallbackRasterPath, "garment_three_view");
    const referenceUploadPath = seedanceCompatibleImagePath(params.videoReferenceImagePath, params.videoReferenceFallbackRasterPath, "video_reference");
    const garmentUpload = await uploadFileToTOS(garmentUploadPath, `${prefix}/garment-three-view${uploadExtension(garmentUploadPath)}`);
    const referenceUpload = await uploadFileToTOS(referenceUploadPath, `${prefix}/video-reference${uploadExtension(referenceUploadPath)}`);
    console.log("[SeedanceMaterialUpload] upload_sources_done", {
      sessionId: params.sessionId,
      selectedSetId: params.selectedSetId,
      garmentImageKey: garmentUpload.key,
      garmentImageUrl: garmentUpload.url,
      videoReferenceImageKey: referenceUpload.key,
      videoReferenceImageUrl: referenceUpload.url,
      durationMs: Date.now() - startedAt
    });
    return {
      tosGarmentImageKey: garmentUpload.key,
      tosGarmentImageUrl: garmentUpload.url,
      tosVideoReferenceImageKey: referenceUpload.key,
      tosVideoReferenceImageUrl: referenceUpload.url
    };
  } catch (error) {
    console.warn("[SeedanceMaterialUpload] upload_sources_failed", {
      sessionId: params.sessionId,
      selectedSetId: params.selectedSetId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown TOS upload error"
    });
    if (params.throwOnFailure) {
      throw error;
    }
    return {};
  }
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

function seedanceCompatibleImagePath(primaryPath: string, fallbackPath: string | undefined, label: string): string {
  if (isRasterImage(primaryPath)) return primaryPath;
  if (fallbackPath && isRasterImage(fallbackPath)) {
    console.warn("[SeedanceMaterialUpload] replace_non_raster_reference", {
      label,
      originalFile: path.basename(primaryPath),
      replacementFile: path.basename(fallbackPath)
    });
    return fallbackPath;
  }
  return primaryPath;
}

function isRasterImage(filePath: string): boolean {
  return [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(filePath).toLowerCase());
}

function uploadExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".svg"].includes(ext)) return ext;
  return ".jpg";
}

function safeURLHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid_url";
  }
}

function summarizeSession(session: GarmentSession) {
  const status = session.status ?? inferSessionStatus(session);
  return {
    sessionId: session.sessionId,
    deviceId: session.deviceId ?? null,
    status,
    currentStage: session.currentStage ?? null,
    progressMessage: session.progressMessage ?? statusMessage(status),
    errorMessage: session.errorMessage ?? null,
    frontImageUrl: session.frontImageUrl,
    backImageUrl: session.backImageUrl,
    garmentAnalysis: session.garmentAnalysis ?? null,
    sets: session.sets,
    generationStatus: session.generationStatus ?? null,
    selectedSet: session.selectedSet ?? session.sets[0] ?? null,
    modelAsset: session.modelAsset ?? null,
    background: session.background ?? null,
    videoReferenceImageUrl: session.videoReferenceImageUrl ?? null,
    videoReferenceGenerationStatus: session.videoReferenceGenerationStatus ?? null,
    finalVideoPrompt: session.finalVideoPrompt ?? null,
    seedanceTaskId: session.seedanceTaskId ?? null,
    generatedVideoUrl: session.generatedVideoUrl ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt ?? session.createdAt,
    completedAt: session.completedAt ?? null,
    isInProgress: !["completed", "failed"].includes(status)
  };
}

function inferSessionStatus(session: GarmentSession): string {
  if (session.generatedVideoUrl) return "completed";
  if (session.seedanceTaskId) return "video_processing";
  if (session.videoReferenceImageUrl) return "ready_for_video";
  if (session.sets.length > 0) return "processing";
  return "queued";
}

function statusMessage(status: string): string {
  switch (status) {
    case "queued":
      return "照片已上传，正在排队。";
    case "processing":
      return "正在生成服装素材。";
    case "ready_for_video":
      return "视频素材已准备好，可以生成视频。";
    case "video_processing":
      return "视频正在生成中。";
    case "completed":
      return "视频已生成。";
    case "failed":
      return "任务失败，请重新尝试。";
    default:
      return "任务处理中。";
  }
}
