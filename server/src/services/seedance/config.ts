function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["true", "1", "yes", "y"].includes(value.toLowerCase());
}

export const seedanceConfig = {
  arkBaseURL: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
  arkApiKey: process.env.ARK_API_KEY || "",
  model: process.env.SEEDANCE_MODEL || "ep-20260604164423-ggl5k",
  ratio: process.env.SEEDANCE_RATIO || "16:9",
  duration: parseNumber(process.env.SEEDANCE_DURATION, 11),
  generateAudio: parseBoolean(process.env.SEEDANCE_GENERATE_AUDIO, true),
  watermark: parseBoolean(process.env.SEEDANCE_WATERMARK, false),
  pollIntervalMs: parseNumber(process.env.SEEDANCE_POLL_INTERVAL_MS, 10000),
  timeoutMs: parseNumber(process.env.SEEDANCE_TIMEOUT_MS, 900000),
  tosRegion: process.env.TOS_REGION || "cn-beijing",
  tosEndpoint: process.env.TOS_ENDPOINT || "tos-cn-beijing.volces.com",
  tosS3Endpoint: process.env.TOS_S3_ENDPOINT || "tos-s3-cn-beijing.volces.com",
  tosBucket: process.env.TOS_BUCKET || "seedance-sources",
  tosBucketDomain: process.env.TOS_BUCKET_DOMAIN || "seedance-sources.tos-cn-beijing.volces.com",
  tosAccessKeyId: process.env.TOS_ACCESS_KEY_ID || process.env.TOS_AK || "",
  tosSecretAccessKey: process.env.TOS_SECRET_ACCESS_KEY || process.env.TOS_SK || "",
  referenceVideoFilename: process.env.SEEDANCE_REFERENCE_VIDEO_FILENAME || "video-case.mp4",
  referenceVideoUrl: process.env.SEEDANCE_REFERENCE_VIDEO_URL || "",
  tosSignedUrlExpiresSeconds: parseNumber(process.env.TOS_SIGNED_URL_EXPIRES_SECONDS, 3600),
  fallbackWithoutReferenceVideoOnSensitive: parseBoolean(process.env.SEEDANCE_FALLBACK_WITHOUT_REFERENCE_VIDEO_ON_SENSITIVE, true)
};
