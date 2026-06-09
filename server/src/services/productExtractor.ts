import type { ProductInfo } from "../schemas/productSchemas.js";
import { detectPlatform, parseHttpUrl } from "../utils/url.js";
import { extract1688Product } from "./1688Extractor.js";
import { ExtractionBlockedError, InvalidUrlError } from "./extractionErrors.js";
import { extractGenericProduct } from "./genericExtractor.js";
import { extractTaobaoProduct } from "./taobaoExtractor.js";
export { ExtractionBlockedError, InvalidUrlError } from "./extractionErrors.js";

export async function extractProduct(rawUrl: string): Promise<ProductInfo> {
  const url = parseHttpUrl(rawUrl);
  if (!url) {
    throw new InvalidUrlError();
  }

  const platform = detectPlatform(url);
  if (platform === "1688") {
    return extract1688Product(url);
  }

  if (platform === "taobao" || platform === "tmall") {
    return extractTaobaoProduct(url, platform);
  }

  return extractGenericProduct(url);
}
