import { readFile, writeFile } from "node:fs/promises";
import { deviceUsagePath } from "./garmentPaths.js";

const DAILY_VIDEO_LIMIT = 3;
const TIME_ZONE = "Asia/Shanghai";

interface DeviceUsageRecord {
  date: string;
  successfulVideoCount: number;
  countedTaskIds: string[];
}

interface UsageFile {
  devices: Record<string, DeviceUsageRecord>;
}

export interface VideoQuota {
  deviceId: string;
  date: string;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

export async function getVideoQuota(deviceId: string): Promise<VideoQuota> {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const file = await readUsageFile();
  const record = todayRecord(file.devices[normalizedDeviceId]);
  return quotaFromRecord(normalizedDeviceId, record);
}

export async function ensureVideoQuotaAvailable(deviceId: string): Promise<VideoQuota> {
  const quota = await getVideoQuota(deviceId);
  if (quota.remaining <= 0) {
    const error = new Error("今日视频生成次数已用完，明天 00:00 后刷新。") as Error & { code: string; status: number };
    error.code = "DAILY_VIDEO_LIMIT_REACHED";
    error.status = 429;
    throw error;
  }
  return quota;
}

export async function markVideoGenerationSucceeded(deviceId: string | undefined, taskId: string): Promise<VideoQuota | undefined> {
  if (!deviceId || !taskId) return undefined;
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const file = await readUsageFile();
  const record = todayRecord(file.devices[normalizedDeviceId]);
  if (!record.countedTaskIds.includes(taskId)) {
    record.countedTaskIds.push(taskId);
    record.successfulVideoCount = Math.min(DAILY_VIDEO_LIMIT, record.successfulVideoCount + 1);
    file.devices[normalizedDeviceId] = record;
    await writeFile(deviceUsagePath, JSON.stringify(file, null, 2), "utf8");
  }
  return quotaFromRecord(normalizedDeviceId, record);
}

function quotaFromRecord(deviceId: string, record: DeviceUsageRecord): VideoQuota {
  const used = Math.min(DAILY_VIDEO_LIMIT, Math.max(0, record.successfulVideoCount));
  return {
    deviceId,
    date: record.date,
    limit: DAILY_VIDEO_LIMIT,
    used,
    remaining: Math.max(0, DAILY_VIDEO_LIMIT - used),
    resetAt: nextShanghaiMidnightISO()
  };
}

function todayRecord(existing: DeviceUsageRecord | undefined): DeviceUsageRecord {
  const today = shanghaiDateKey();
  if (!existing || existing.date !== today) {
    return { date: today, successfulVideoCount: 0, countedTaskIds: [] };
  }
  return {
    date: existing.date,
    successfulVideoCount: Number.isFinite(existing.successfulVideoCount) ? existing.successfulVideoCount : 0,
    countedTaskIds: Array.isArray(existing.countedTaskIds) ? existing.countedTaskIds : []
  };
}

async function readUsageFile(): Promise<UsageFile> {
  try {
    const raw = await readFile(deviceUsagePath, "utf8");
    const parsed = JSON.parse(raw) as UsageFile;
    return { devices: parsed && typeof parsed.devices === "object" && parsed.devices ? parsed.devices : {} };
  } catch {
    return { devices: {} };
  }
}

function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().slice(0, 128);
}

function shanghaiDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function nextShanghaiMidnightISO(): string {
  const now = new Date();
  const shanghaiNow = new Date(now.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const next = new Date(shanghaiNow);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  const offsetMs = shanghaiNow.getTime() - now.getTime();
  return new Date(next.getTime() - offsetMs).toISOString();
}
