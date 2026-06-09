export type Platform = "taobao" | "tmall" | "1688" | "generic";

export function parseHttpUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function detectPlatform(url: URL): Platform {
  const hostname = url.hostname.toLowerCase();
  if (hostname.includes("1688.com")) return "1688";
  if (hostname.includes("taobao.com")) return "taobao";
  if (hostname.includes("tmall.com")) return "tmall";
  return "generic";
}

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case "taobao":
      return "Taobao";
    case "tmall":
      return "Tmall";
    case "1688":
      return "1688";
    default:
      return "Generic Web";
  }
}

export function extractNumericId(url: URL): string | null {
  const queryId = url.searchParams.get("id") || url.searchParams.get("itemId") || url.searchParams.get("offerId");
  if (queryId && /^\d{5,}$/.test(queryId)) return queryId;

  const pathMatch = url.pathname.match(/(?:offer|item|detail)?\/?(\d{5,})(?:\.html)?/);
  return pathMatch?.[1] ?? null;
}
