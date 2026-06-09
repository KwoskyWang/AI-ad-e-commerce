import { seedanceConfig } from "./config.js";

export interface SeedanceTaskCreationResult {
  taskId: string;
  status: string;
}

export interface SeedanceTaskStatusResult {
  taskId: string;
  status: string;
  videoUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  isDone: boolean;
  isFailed: boolean;
}

export class SeedanceProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responsePreview: string
  ) {
    super(message);
    this.name = "SeedanceProviderError";
  }

  get isReferenceVideoSensitive(): boolean {
    return this.responsePreview.includes("InputVideoSensitiveContentDetected");
  }
}

export async function createSeedanceTask(params: {
  prompt: string;
  garmentImageUrl: string;
  videoReferenceImageUrl: string;
  referenceVideoUrl?: string;
}): Promise<SeedanceTaskCreationResult> {
  if (!seedanceConfig.arkApiKey) {
    throw new Error("ARK_API_KEY is not configured.");
  }

  const startedAt = Date.now();
  console.log("[Seedance] task_create_start", {
    model: seedanceConfig.model,
    ratio: seedanceConfig.ratio,
    duration: seedanceConfig.duration,
    generateAudio: seedanceConfig.generateAudio,
    watermark: seedanceConfig.watermark,
    promptLength: params.prompt.length,
    contentItems: params.referenceVideoUrl ? 4 : 3,
    imageHosts: [safeURLHost(params.garmentImageUrl), safeURLHost(params.videoReferenceImageUrl)],
    referenceVideoHost: params.referenceVideoUrl ? safeURLHost(params.referenceVideoUrl) : "none"
  });

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: params.prompt
    },
    {
      type: "image_url",
      image_url: { url: params.garmentImageUrl },
      role: "reference_image"
    },
    {
      type: "image_url",
      image_url: { url: params.videoReferenceImageUrl },
      role: "reference_image"
    }
  ];
  if (params.referenceVideoUrl) {
    content.push({
      type: "video_url",
      video_url: { url: params.referenceVideoUrl },
      role: "reference_video"
    });
  }

  const createResponse = await fetch(`${seedanceConfig.arkBaseURL.replace(/\/$/, "")}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${seedanceConfig.arkApiKey}`
    },
    body: JSON.stringify({
      model: seedanceConfig.model,
      content,
      generate_audio: seedanceConfig.generateAudio,
      ratio: seedanceConfig.ratio,
      duration: seedanceConfig.duration,
      watermark: seedanceConfig.watermark
    })
  });

  if (!createResponse.ok) {
    const text = await safeText(createResponse);
    console.warn("[Seedance] task_create_failed", {
      status: createResponse.status,
      durationMs: Date.now() - startedAt,
      responsePreview: text
    });
    throw new SeedanceProviderError(
      `Seedance task create failed HTTP ${createResponse.status}${text ? `: ${text}` : ""}`,
      createResponse.status,
      text
    );
  }

  const created = await createResponse.json() as any;
  const taskId = extractTaskId(created);
  if (!taskId) {
    throw new Error("Seedance task create response did not include task id.");
  }

  const status = extractStatus(created);
  console.log("[Seedance] task_created", {
    taskId,
    status,
    durationMs: Date.now() - startedAt
  });
  return { taskId, status };
}

export async function getSeedanceTaskStatus(taskId: string): Promise<SeedanceTaskStatusResult> {
  if (!seedanceConfig.arkApiKey) {
    throw new Error("ARK_API_KEY is not configured.");
  }

  const startedAt = Date.now();
  console.log("[Seedance] task_status_query_start", { taskId });
  const response = await fetch(`${seedanceConfig.arkBaseURL.replace(/\/$/, "")}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${seedanceConfig.arkApiKey}`
    }
  });

  if (!response.ok) {
    const text = await safeText(response);
    console.warn("[Seedance] task_status_query_failed", {
      taskId,
      status: response.status,
      durationMs: Date.now() - startedAt,
      responsePreview: text
    });
    throw new Error(`Seedance task query failed HTTP ${response.status}${text ? `: ${text}` : ""}`);
  }

  const data = await response.json() as any;
  const status = extractStatus(data);
  const videoUrl = extractVideoUrl(data);
  const failureCode = extractFailureCode(data);
  const failureMessage = extractFailureMessage(data);
  const result = {
    taskId,
    status,
    videoUrl,
    failureCode,
    failureMessage,
    isDone: Boolean(videoUrl) && isSuccessStatus(status),
    isFailed: isFailureStatus(status)
  };
  console.log("[Seedance] task_status_query_done", {
    taskId,
    status,
    hasVideoUrl: Boolean(videoUrl),
    failureCode,
    failureMessage,
    isDone: result.isDone,
    isFailed: result.isFailed,
    durationMs: Date.now() - startedAt,
    responsePreview: result.isFailed || (isSuccessStatus(status) && !videoUrl) ? safeJSONPreview(data) : undefined
  });
  return result;
}

function extractTaskId(response: any): string | undefined {
  return firstString(
    response?.id,
    response?.task_id,
    response?.taskId,
    response?.data?.id,
    response?.data?.task_id,
    response?.data?.taskId
  );
}

function extractStatus(response: any): string {
  return firstString(
    response?.status,
    response?.data?.status,
    response?.task?.status,
    response?.result?.status
  ) ?? "unknown";
}

function extractVideoUrl(response: any): string | undefined {
  const candidates = [
    response?.video_url,
    response?.videoUrl,
    response?.url,
    response?.data?.video_url,
    response?.data?.videoUrl,
    response?.data?.url,
    response?.result?.video_url,
    response?.result?.videoUrl,
    response?.result?.url,
    response?.content?.video_url,
    response?.content?.videoUrl,
    response?.content?.video_url?.url,
    response?.data?.content?.video_url,
    response?.data?.content?.videoUrl,
    response?.data?.content?.video_url?.url
  ];
  const direct = firstString(...candidates);
  if (direct) return direct;

  const arrays = [response?.content, response?.data?.content, response?.output, response?.data?.output, response?.result?.content];
  for (const array of arrays) {
    if (!Array.isArray(array)) continue;
    for (const item of array) {
      const url = firstString(item?.video_url?.url, item?.video_url, item?.url);
      if (url) return url;
    }
  }
  return undefined;
}

function extractFailureCode(response: any): string | undefined {
  return firstString(
    response?.error?.code,
    response?.data?.error?.code,
    response?.task?.error?.code,
    response?.result?.error?.code,
    response?.code,
    response?.data?.code,
    response?.failure_code,
    response?.data?.failure_code
  );
}

function extractFailureMessage(response: any): string | undefined {
  return firstString(
    response?.error?.message,
    response?.data?.error?.message,
    response?.task?.error?.message,
    response?.result?.error?.message,
    response?.message,
    response?.data?.message,
    response?.failure_message,
    response?.data?.failure_message
  );
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function isSuccessStatus(status: string): boolean {
  return ["succeeded", "success", "completed", "done", "finished"].includes(status.toLowerCase());
}

function isFailureStatus(status: string): boolean {
  return ["failed", "error", "cancelled", "canceled", "expired"].includes(status.toLowerCase());
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return "";
  }
}

function safeJSONPreview(value: unknown): string {
  try {
    return JSON.stringify(value).replace(/\s+/g, " ").slice(0, 800);
  } catch {
    return "";
  }
}

function safeURLHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid_url";
  }
}
