import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { seedanceConfig } from "./config.js";

export interface UploadedTOSAsset {
  key: string;
  url: string;
}

export async function uploadFileToTOS(localPath: string, key: string): Promise<UploadedTOSAsset> {
  if (!seedanceConfig.tosAccessKeyId || !seedanceConfig.tosSecretAccessKey) {
    throw new Error("TOS AK/SK is not configured.");
  }

  const body = await readFile(localPath);
  const contentType = mimeTypeForPath(localPath);
  const host = `${seedanceConfig.tosBucket}.${seedanceConfig.tosS3Endpoint}`;
  const endpoint = `https://${host}/${encodeURI(key)}`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n") + "\n";
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    `/${encodeURI(key)}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${seedanceConfig.tosRegion}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex")
  ].join("\n");
  const signingKey = getSignatureKey(seedanceConfig.tosSecretAccessKey, dateStamp, seedanceConfig.tosRegion, "s3");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${seedanceConfig.tosAccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const startedAt = Date.now();
  console.log("[TOS] upload_start", {
    key,
    bucket: seedanceConfig.tosBucket,
    host,
    contentType,
    sizeBytes: body.byteLength,
    localFile: path.basename(localPath)
  });
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization
    },
    body
  });

  if (!response.ok) {
    const text = await safeText(response);
    console.warn("[TOS] upload_failed", {
      key,
      status: response.status,
      durationMs: Date.now() - startedAt,
      responsePreview: text
    });
    throw new Error(`TOS upload failed HTTP ${response.status}${text ? `: ${text}` : ""}`);
  }
  const uploaded = {
    key,
    url: `https://${seedanceConfig.tosBucketDomain}/${encodeURI(key)}`
  };
  console.log("[TOS] upload_done", {
    key,
    publicHost: seedanceConfig.tosBucketDomain,
    durationMs: Date.now() - startedAt,
    url: uploaded.url
  });
  await checkPublicURL(uploaded.url, "uploaded_asset");
  return uploaded;
}

export async function checkPublicURL(url: string, label: string): Promise<{ ok: boolean; status: number }> {
  const startedAt = Date.now();
  const host = safeURLHost(url);
  console.log("[TOS] public_check_start", { label, host });
  try {
    const headResponse = await fetch(url, { method: "HEAD" });
    if (headResponse.ok) {
      const result = { ok: true, status: headResponse.status };
      console.log("[TOS] public_check_done", {
        label,
        host,
        method: "HEAD",
        ok: result.ok,
        status: result.status,
        durationMs: Date.now() - startedAt
      });
      return result;
    }

    console.warn("[TOS] public_check_head_not_ok", {
      label,
      host,
      status: headResponse.status,
      fallback: "range_get"
    });
    const rangeResponse = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    const result = { ok: rangeResponse.ok || rangeResponse.status === 206, status: rangeResponse.status };
    console.log("[TOS] public_check_done", {
      label,
      host,
      method: "GET_RANGE",
      ok: result.ok,
      status: result.status,
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    console.warn("[TOS] public_check_failed", {
      label,
      host,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown TOS public check error"
    });
    return { ok: false, status: 0 };
  }
}

export function publicTOSURLForKey(key: string): string {
  return `https://${seedanceConfig.tosBucketDomain}/${encodeURI(key)}`;
}

export function createSignedTOSGetURL(key: string, expiresSeconds = seedanceConfig.tosSignedUrlExpiresSeconds): string {
  if (!seedanceConfig.tosAccessKeyId || !seedanceConfig.tosSecretAccessKey) {
    throw new Error("TOS AK/SK is not configured.");
  }

  const host = `${seedanceConfig.tosBucket}.${seedanceConfig.tosS3Endpoint}`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${seedanceConfig.tosRegion}/s3/aws4_request`;
  const credential = `${seedanceConfig.tosAccessKeyId}/${credentialScope}`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host"
  });
  const canonicalQuery = Array.from(query.entries())
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .sort()
    .join("&");
  const canonicalRequest = [
    "GET",
    `/${encodeURI(key)}`,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex")
  ].join("\n");
  const signingKey = getSignatureKey(seedanceConfig.tosSecretAccessKey, dateStamp, seedanceConfig.tosRegion, "s3");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  query.set("X-Amz-Signature", signature);
  const signedURL = `https://${host}/${encodeURI(key)}?${query.toString()}`;
  console.log("[TOS] signed_url_created", {
    key,
    host,
    expiresSeconds,
    urlHost: safeURLHost(signedURL)
  });
  return signedURL;
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function mimeTypeForPath(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".mp4":
      return "video/mp4";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).replace(/\s+/g, " ").slice(0, 500);
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
