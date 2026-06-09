import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request } from "express";

interface UploadedImage {
  path: string;
  filename: string;
  mimeType: string;
}

export interface GarmentImageUpload {
  frontImage: UploadedImage;
  backImage: UploadedImage;
}

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxUploadBytes = 18 * 1024 * 1024;

export async function parseGarmentImageUpload(req: Request, uploadDir: string): Promise<GarmentImageUpload> {
  const contentType = req.headers["content-type"] ?? "";
  const boundary = boundaryFromContentType(contentType);
  if (!boundary) throw uploadError("INVALID_UPLOAD", "照片上传失败，请重新选择或重新拍照。");

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxUploadBytes) throw uploadError("UPLOAD_TOO_LARGE", "照片太大，请重新选择较小的图片。");
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks);
  const files = parseMultipartFiles(body, boundary);
  const front = files.get("frontImage");
  const back = files.get("backImage");
  if (!front) throw uploadError("MISSING_FRONT_IMAGE", "请先上传衣服正面照。");
  if (!back) throw uploadError("MISSING_BACK_IMAGE", "请先上传衣服反面照。");

  return {
    frontImage: await saveUploadedImage(front, uploadDir, "front"),
    backImage: await saveUploadedImage(back, uploadDir, "back")
  };
}

function boundaryFromContentType(contentType: string): string | undefined {
  const match = contentType.match(/boundary=([^;]+)/i);
  return match?.[1]?.replace(/^"|"$/g, "");
}

interface MultipartFile {
  fieldName: string;
  originalFilename: string;
  mimeType: string;
  data: Buffer;
}

function parseMultipartFiles(body: Buffer, boundary: string): Map<string, MultipartFile> {
  const files = new Map<string, MultipartFile>();
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = 0;

  while (cursor < body.length) {
    const partStart = body.indexOf(delimiter, cursor);
    if (partStart < 0) break;
    const contentStart = partStart + delimiter.length;
    if (body.subarray(contentStart, contentStart + 2).toString() === "--") break;

    const headersStart = contentStart + (body.subarray(contentStart, contentStart + 2).toString() === "\r\n" ? 2 : 0);
    const headersEnd = body.indexOf(Buffer.from("\r\n\r\n"), headersStart);
    if (headersEnd < 0) break;
    const nextPartStart = body.indexOf(delimiter, headersEnd + 4);
    if (nextPartStart < 0) break;

    const headers = body.subarray(headersStart, headersEnd).toString("utf8");
    const rawData = body.subarray(headersEnd + 4, Math.max(headersEnd + 4, nextPartStart - 2));
    const fieldName = /name="([^"]+)"/.exec(headers)?.[1];
    const originalFilename = /filename="([^"]*)"/.exec(headers)?.[1] ?? "image";
    const mimeType = /Content-Type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? "application/octet-stream";
    if (fieldName && originalFilename && rawData.byteLength > 0) {
      files.set(fieldName, { fieldName, originalFilename, mimeType, data: Buffer.from(rawData) });
    }
    cursor = nextPartStart;
  }

  return files;
}

async function saveUploadedImage(file: MultipartFile, uploadDir: string, prefix: string): Promise<UploadedImage> {
  if (!allowedTypes.has(file.mimeType)) throw uploadError("INVALID_IMAGE_TYPE", "请上传 JPG、PNG 或 WebP 图片。");
  const extension = extensionForMime(file.mimeType);
  const filename = `${prefix}-${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, file.data);
  return { path: filePath, filename, mimeType: file.mimeType };
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}

function uploadError(code: string, message: string): Error & { code: string; status: number } {
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = code;
  error.status = 400;
  return error;
}
