import type { ProductInfo } from "../schemas/productSchemas.js";
import { extractNumericId, parseHttpUrl } from "../utils/url.js";
import { buildMockProduct } from "./genericExtractor.js";
import { fetchFirstReadablePage } from "./httpFetcher.js";
import { parseProductFromHtml } from "./htmlProductParser.js";
import { buildMockSellingPoints } from "./sellingPointExtractor.js";

export async function extract1688Product(rawUrl: string | URL): Promise<ProductInfo> {
  const inputUrl = rawUrl instanceof URL ? rawUrl : parseHttpUrl(rawUrl);
  if (!inputUrl || !is1688Url(inputUrl)) {
    throw new Error("当前 Demo 仅支持 1688 商品详情页链接");
  }

  const normalizedUrl = normalize1688Url(inputUrl);
  const candidates = build1688CandidateUrls(normalizedUrl);
  const { page, attempts } = await fetchFirstReadablePage(candidates);

  if (page) {
    const parsed = parseProductFromHtml(page.html, {
      sourceUrl: inputUrl.toString(),
      normalizedUrl: normalizedUrl.toString(),
      platform: "1688"
    });
    if (parsed) {
      const quality = getExtractionQuality(parsed);
      if (quality.score >= 3) {
        const realProduct: ProductInfo = {
          ...parsed,
          platform: "1688",
          platformProductId: parseOfferId(normalizedUrl) ?? parsed.platformProductId,
          extractionStatus: {
            source: "real_1688_page",
            canReadPublicPage: true,
            hasLoginOrCaptchaBlock: false,
            commentsAvailable: false,
            usedMockData: false,
            extractedFields: quality.extractedFields,
            missingFields: quality.missingFields,
            message: "已读取 1688 公开页面信息。"
          }
        };
        return enrichProductSellingPoints(realProduct);
      }

      return build1688MockFallback(inputUrl, normalizedUrl, false, "未能从 1688 页面提取足够商品字段", quality.extractedFields);
    }
  }

  const blocked = attempts.some((attempt) => attempt.blocked);
  return build1688MockFallback(
    inputUrl,
    normalizedUrl,
    blocked,
    blocked ? "页面需要登录或验证" : "未能从 1688 页面提取足够商品字段"
  );
}

async function enrichProductSellingPoints(product: ProductInfo): Promise<ProductInfo> {
  const extracted = buildMockSellingPoints(product);
  return {
    ...product,
    sellingPoints: extracted.sellingPoints.length > 0 ? extracted.sellingPoints.slice(0, 8) : product.sellingPoints,
    procurementInsights: extracted.procurementInsights.length > 0 ? extracted.procurementInsights.slice(0, 8) : product.procurementInsights
  };
}

function build1688MockFallback(
  inputUrl: URL,
  normalizedUrl: URL,
  blocked: boolean,
  reason: string,
  extractedFields: string[] = []
): ProductInfo {
  const product = buildMockProduct(normalizedUrl, "1688");
  return {
    ...product,
    sourceUrl: inputUrl.toString(),
    normalizedUrl: normalizedUrl.toString(),
    platformProductId: parseOfferId(normalizedUrl) ?? product.platformProductId,
    extractionStatus: {
      source: "mock_fallback",
      canReadPublicPage: false,
      hasLoginOrCaptchaBlock: blocked,
      commentsAvailable: false,
      usedMockData: true,
      mockReason: reason,
      extractedFields,
      missingFields: getMissingFieldsFromExtracted(extractedFields),
      message: blocked
        ? "该 1688 页面需要登录或验证，当前 Demo 不会绕过平台限制，已展示 Mock 演示数据。"
        : "当前页面未能读取到足够的真实商品信息，已展示 Mock 演示数据。"
    }
  };
}

export function normalize1688Url(url: URL): URL {
  const offerId = parseOfferId(url);
  if (offerId) {
    return new URL(`https://detail.1688.com/offer/${offerId}.html`);
  }
  return url;
}

export function parseOfferId(url: URL): string | null {
  return extractNumericId(url);
}

export function is1688Url(url: URL): boolean {
  return url.hostname.toLowerCase().endsWith("1688.com");
}

function build1688CandidateUrls(url: URL): URL[] {
  const id = parseOfferId(url);
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

function getExtractionQuality(product: ProductInfo): { score: number; extractedFields: string[]; missingFields: string[] } {
  const checks = [
    ["title", Boolean(product.title && product.title !== "未命名商品" && product.title.length > 3)],
    ["price", Boolean(product.price)],
    ["images", product.imageUrls.length > 0],
    ["shopName", Boolean(product.shopName || product.companyName)],
    ["productFacts", product.productFacts.length >= 2],
    ["rawDetailText", Boolean(product.rawDetailText && product.rawDetailText.length > 60)]
  ] as const;
  const extractedFields = checks.filter(([, ok]) => ok).map(([name]) => name);
  const missingFields = getMissingFieldsFromExtracted(extractedFields);
  return { score: extractedFields.length, extractedFields, missingFields };
}

function getMissingFieldsFromExtracted(extractedFields: string[]): string[] {
  const fields = ["title", "price", "images", "shopName", "productFacts", "reviews", "minOrderQuantity", "categoryText"];
  const extracted = new Set(extractedFields);
  return fields.filter((field) => !extracted.has(field));
}
