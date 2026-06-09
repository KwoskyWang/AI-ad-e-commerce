import { readFile, writeFile } from "node:fs/promises";
import type { GarmentSession } from "./garmentTypes.js";
import { garmentSessionsPath } from "./garmentPaths.js";

interface SessionFile {
  sessions: GarmentSession[];
}

export async function saveGarmentSession(session: GarmentSession): Promise<void> {
  const file = await readSessionsFile();
  const sessions = [{ ...session, updatedAt: new Date().toISOString() }, ...file.sessions.filter((item) => item.sessionId !== session.sessionId)].slice(0, 200);
  await writeFile(garmentSessionsPath, JSON.stringify({ sessions }, null, 2), "utf8");
}

export async function getGarmentSession(sessionId: string): Promise<GarmentSession | undefined> {
  const file = await readSessionsFile();
  return file.sessions.find((session) => session.sessionId === sessionId);
}

export async function listGarmentSessionsForDevice(deviceId: string): Promise<GarmentSession[]> {
  const file = await readSessionsFile();
  return file.sessions
    .filter((session) => session.deviceId === deviceId)
    .sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt));
}

async function readSessionsFile(): Promise<SessionFile> {
  try {
    const raw = await readFile(garmentSessionsPath, "utf8");
    const parsed = JSON.parse(raw) as SessionFile;
    return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}
