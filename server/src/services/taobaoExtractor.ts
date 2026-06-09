import type { ProductInfo } from "../schemas/productSchemas.js";
import type { Platform } from "../utils/url.js";
import { extractNumericId } from "../utils/url.js";
import { ExtractionBlockedError } from "./extractionErrors.js";
import { buildMockProduct } from "./genericExtractor.js";
import { fetchFirstReadablePage } from "./httpFetcher.js";
import { parseProductFromHtml } from "./htmlProductParser.js";

export async function extractTaobaoProduct(url: URL, platform: Platform): Promise<ProductInfo> {
  const candidates = buildTaobaoCandidateUrls(url, platform);
  const { page, attempts } = await fetchFirstReadablePage(candidates);

  if (page) {
    const parsed = parseProductFromHtml(page.html, {
      sourceUrl: url.toString(),
      platform
    });
    if (parsed) return parsed;
  }

  // Taobao/Tmall pages frequently require login, captcha, or anti-bot checks.
  // We intentionally stop here instead of trying to bypass those protections.
  if (attempts.some((attempt) => attempt.blocked)) {
    throw new ExtractionBlockedError("淘宝/天猫页面需要登录、验证码或平台验证，暂时无法自动提取。");
  }

  return buildMockProduct(url, platform);
}

function buildTaobaoCandidateUrls(url: URL, platform: Platform): URL[] {
  const id = extractNumericId(url);
  const urls = [url];

  if (id) {
    urls.push(
      new URL(`https://detail.tmall.com/item.htm?id=${id}`),
      new URL(`https://detail.tmall.com/item_o.htm?id=${id}`),
      new URL(`https://item.taobao.com/item.htm?id=${id}`),
      new URL(`https://h5.m.taobao.com/awp/core/detail.htm?id=${id}`),
      new URL(`https://main.m.taobao.com/security-h5-detail/home?id=${id}`),
      new URL(`https://market.m.taobao.com/app/detail-project/pages/pages/index?id=${id}`)
    );
  }

  return platform === "tmall" ? urls : [url, ...urls.slice(3), ...urls.slice(1, 3)];
}
