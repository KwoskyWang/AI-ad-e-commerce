import type { ProductInfo } from "../schemas/productSchemas.js";
import { extractNumericId } from "../utils/url.js";
import { ExtractionBlockedError } from "./extractionErrors.js";
import { buildMockProduct } from "./genericExtractor.js";
import { fetchFirstReadablePage } from "./httpFetcher.js";
import { parseProductFromHtml } from "./htmlProductParser.js";

export async function extract1688Product(url: URL): Promise<ProductInfo> {
  const candidates = build1688CandidateUrls(url);
  const { page, attempts } = await fetchFirstReadablePage(candidates);

  if (page) {
    const parsed = parseProductFromHtml(page.html, {
      sourceUrl: url.toString(),
      platform: "1688"
    });
    if (parsed) return parsed;
  }

  if (attempts.some((attempt) => attempt.blocked)) {
    throw new ExtractionBlockedError("1688 页面需要登录、验证码或平台验证，暂时无法自动提取。");
  }

  return buildMockProduct(url, "1688");
}

function build1688CandidateUrls(url: URL): URL[] {
  const id = extractNumericId(url);
  const urls = [url];

  if (id) {
    urls.push(
      new URL(`https://detail.1688.com/offer/${id}.html`),
      new URL(`https://m.1688.com/offer/${id}.html`),
      new URL(`https://m.1688.com/offer/${id}.html?callByHgJs=1`),
      new URL(`https://laputa.1688.com/offer/ajax/OfferDesc.do?offerId=${id}`)
    );
  }

  return urls;
}
