import iconv from "iconv-lite";

export interface FetchAttempt {
  url: string;
  status?: number;
  blocked?: boolean;
  reason?: string;
}

export interface FetchedPage {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  html: string;
  headers: Headers;
  blocked: boolean;
  blockedReason?: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
];

export async function fetchPublicPage(url: URL, userAgentIndex = 0): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
        "Cache-Control": "no-cache",
        "User-Agent": USER_AGENTS[userAgentIndex % USER_AGENTS.length]
      },
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const html = decodeHtml(buffer, contentType);
    const blockedReason = detectBlocked(response, html);

    return {
      requestedUrl: url.toString(),
      finalUrl: response.url,
      status: response.status,
      html,
      headers: response.headers,
      blocked: Boolean(blockedReason),
      blockedReason
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFirstReadablePage(urls: URL[]): Promise<{ page?: FetchedPage; attempts: FetchAttempt[] }> {
  const attempts: FetchAttempt[] = [];

  for (const candidate of uniqueUrls(urls)) {
    for (let userAgentIndex = 0; userAgentIndex < USER_AGENTS.length; userAgentIndex += 1) {
      try {
        const page = await fetchPublicPage(candidate, userAgentIndex);
        attempts.push({
          url: candidate.toString(),
          status: page.status,
          blocked: page.blocked,
          reason: page.blockedReason
        });

        if (!page.blocked && page.status >= 200 && page.status < 400 && page.html.length > 200) {
          return { page, attempts };
        }
      } catch (error) {
        attempts.push({
          url: candidate.toString(),
          reason: error instanceof Error ? error.message : "fetch failed"
        });
      }
    }
  }

  return { attempts };
}

function decodeHtml(buffer: Buffer, contentType: string): string {
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = charsetMatch?.[1]?.trim().toLowerCase();
  if (charset && charset !== "utf-8" && charset !== "utf8") {
    try {
      return iconv.decode(buffer, charset);
    } catch {
      return buffer.toString("utf8");
    }
  }
  return buffer.toString("utf8");
}

function detectBlocked(response: Response, html: string): string | undefined {
  const headers = response.headers;
  const lower = html.toLowerCase();

  if (headers.get("bxpunish") || headers.get("x-sec-reason")) {
    return headers.get("x-sec-reason") || "platform security challenge";
  }

  const blockedSignals = [
    "login.taobao.com",
    "login.m.taobao.com",
    "punish-component",
    "nocaptcha",
    "captcha",
    "x5secdata",
    "____tmd_____",
    "baxia",
    "滑块验证",
    "验证码",
    "请登录"
  ];

  return blockedSignals.some((signal) => lower.includes(signal.toLowerCase()))
    ? "page requires login, captcha, or platform verification"
    : undefined;
}

function uniqueUrls(urls: URL[]): URL[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const key = url.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
