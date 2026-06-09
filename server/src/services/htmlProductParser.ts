import * as cheerio from "cheerio";
import { randomUUID } from "node:crypto";
import type { ProductFact, ProductInfo } from "../schemas/productSchemas.js";
import type { Platform } from "../utils/url.js";
import { extractNumericId, platformLabel } from "../utils/url.js";

interface ParseOptions {
  sourceUrl: string;
  normalizedUrl?: string;
  platform: Platform;
}

const FIELD_PATTERNS = {
  title: [
    /"title"\s*:\s*"([^"]{2,160})"/i,
    /"itemTitle"\s*:\s*"([^"]{2,160})"/i,
    /"subject"\s*:\s*"([^"]{2,160})"/i,
    /"offerTitle"\s*:\s*"([^"]{2,160})"/i,
    /"name"\s*:\s*"([^"]{2,160})"/i
  ],
  price: [
    /"price"\s*:\s*"?(¥?\s*\d+(?:\.\d+)?(?:\s*-\s*¥?\s*\d+(?:\.\d+)?)?)"?/i,
    /"salePrice"\s*:\s*"?(¥?\s*\d+(?:\.\d+)?)"?/i,
    /"discountPrice"\s*:\s*"?(¥?\s*\d+(?:\.\d+)?)"?/i,
    /"priceRange"\s*:\s*"([^"]{1,40})"/i,
    /¥\s*\d+(?:\.\d+)?(?:\s*-\s*¥?\s*\d+(?:\.\d+)?)?/
  ],
  shopName: [
    /"shopName"\s*:\s*"([^"]{2,80})"/i,
    /"sellerNick"\s*:\s*"([^"]{2,80})"/i,
    /"storeName"\s*:\s*"([^"]{2,80})"/i,
    /"companyName"\s*:\s*"([^"]{2,100})"/i,
    /"supplierName"\s*:\s*"([^"]{2,100})"/i
  ]
};

export function parseProductFromHtml(html: string, options: ParseOptions): ProductInfo | null {
  const $ = cheerio.load(html);
  const compactHtml = html.replace(/\s+/g, " ");

  const title = cleanTitle(
    firstPresent([
      meta($, "og:title"),
      meta($, "twitter:title"),
      $('[itemprop="name"]').first().text(),
      $("h1").first().text(),
      $("title").first().text(),
      regexFirst(compactHtml, FIELD_PATTERNS.title)
    ])
  );

  const images = collectImages($, html);
  const description = cleanText(firstPresent([
    meta($, "og:description"),
    meta($, "description"),
    regexFirst(compactHtml, [/"description"\s*:\s*"([^"]{4,260})"/i])
  ]));
  const rawDetailText = collectDetailText($, description);

  if ((!title && images.length === 0 && !description) || isLowInformationShell(title, images, description)) {
    return null;
  }

  const facts = collectFacts($, compactHtml);
  const price = cleanPrice(firstPresent([
    meta($, "product:price:amount"),
    meta($, "og:price:amount"),
    $('[itemprop="price"]').first().attr("content"),
    $('[itemprop="price"]').first().text(),
    regexFirst(compactHtml, FIELD_PATTERNS.price)
  ]));
  const shopName = cleanText(firstPresent([
    meta($, "og:site_name"),
    regexFirst(compactHtml, FIELD_PATTERNS.shopName)
  ]));
  const companyName = cleanText(regexFirst(compactHtml, [/"companyName"\s*:\s*"([^"]{2,100})"/i, /公司名[:：]\s*([^<，。]{2,80})/i]));
  const locationText = cleanText(regexFirst(compactHtml, [/"sendGoodsAddressText"\s*:\s*"([^"]{2,80})"/i, /发货地[:：]\s*([^<，。]{2,80})/i]));
  const categoryText = cleanCategory(regexFirst(compactHtml, [/"categoryName"\s*:\s*"([^"]{2,80})"/i, /类目[:：]\s*([^<，。]{2,80})/i]));
  const minOrderQuantity = cleanText(regexFirst(compactHtml, [/"minOrderQuantity"\s*:\s*"([^"]{1,40})"/i, /(\d+\s*(?:件|片|个|平方米|㎡)\s*起批)/i]));

  return {
    id: randomUUID(),
    sourceUrl: options.sourceUrl,
    normalizedUrl: options.normalizedUrl,
    platform: platformLabel(options.platform),
    platformProductId: extractNumericId(new URL(options.sourceUrl)),
    title: title || "未命名商品",
    price,
    minOrderQuantity,
    shopName,
    companyName,
    locationText,
    categoryText,
    coverImageUrl: images[0],
    imageUrls: images,
    tags: deriveTags(`${title} ${description} ${rawDetailText} ${facts.map((fact) => `${fact.name} ${fact.value}`).join(" ")}`),
    productFacts: facts,
    sellingPoints: deriveSellingPoints(title, description, facts),
    procurementInsights: buildProcurementInsights({ title, price, minOrderQuantity, shopName, companyName, rawDetailText, facts }),
    reviewInsights: [
      "当前页面未提供可直接读取的评论数据，以下洞察基于商品标题、图片、价格、店铺、参数与公开详情信息生成。"
    ],
    reviews: [],
    rawDetailText,
    extractionStatus: {
      source: options.platform === "1688" ? "real_1688_page" : "public_page_html",
      canReadPublicPage: true,
      hasLoginOrCaptchaBlock: false,
      commentsAvailable: false,
      usedMockData: false,
      extractedFields: [
        ...(title ? ["title"] : []),
        ...(price ? ["price"] : []),
        ...(images.length > 0 ? ["images"] : []),
        ...(shopName || companyName ? ["shopName"] : []),
        ...(facts.length > 0 ? ["productFacts"] : []),
        ...(rawDetailText ? ["rawDetailText"] : [])
      ],
      missingFields: [
        ...(!title ? ["title"] : []),
        ...(!price ? ["price"] : []),
        ...(images.length === 0 ? ["images"] : []),
        ...(!shopName && !companyName ? ["shopName"] : []),
        ...(facts.length === 0 ? ["productFacts"] : []),
        "reviews",
        ...(!minOrderQuantity ? ["minOrderQuantity"] : []),
        ...(!categoryText ? ["categoryText"] : [])
      ],
      message: options.platform === "1688" ? "已读取 1688 公开页面信息。" : "当前档案基于商品标题、图片、价格、店铺和页面公开参数整理。"
    },
    extractedAt: new Date().toISOString()
  };
}

function meta($: cheerio.CheerioAPI, name: string): string | undefined {
  return (
    $(`meta[property="${name}"]`).attr("content") ||
    $(`meta[name="${name}"]`).attr("content")
  );
}

interface ImageCandidate {
  url: string;
  width?: number;
  height?: number;
  source: "meta" | "img" | "script";
}

function collectImages($: cheerio.CheerioAPI, html: string): string[] {
  const candidates: ImageCandidate[] = [];

  $("meta[property='og:image'], meta[name='og:image'], meta[property='twitter:image'], meta[name='twitter:image']").each((_, element) => {
    const value = $(element).attr("content");
    const url = normalizeImageUrl(value);
    if (url) candidates.push({ url, source: "meta" });
  });

  $("img").each((_, element) => {
    const value = $(element).attr("src") || $(element).attr("data-src") || $(element).attr("data-lazyload");
    const url = normalizeImageUrl(value);
    if (url) {
      candidates.push({
        url,
        source: "img",
        width: numericAttribute($(element).attr("width") || $(element).attr("data-width")),
        height: numericAttribute($(element).attr("height") || $(element).attr("data-height"))
      });
    }
  });

  const imageRegex = /((?:https?:)?\/\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp)(?:[^"'\\\s<>]*)?)/gi;
  for (const match of html.matchAll(imageRegex)) {
    const url = normalizeImageUrl(match[1]);
    if (url) candidates.push({ url, source: "script" });
  }

  const scored = uniqueImageCandidates(candidates)
    .map((candidate) => ({ ...candidate, score: scoreProductImage(candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const productLike = scored.filter((candidate) => candidate.score >= 3);
  return (productLike.length > 0 ? productLike : scored)
    .map((candidate) => candidate.url)
    .slice(0, 12);
}

function numericAttribute(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function scoreProductImage(candidate: ImageCandidate): number {
  const url = candidate.url.toLowerCase();
  if (/(captcha|punish|favicon|icon|logo|sprite|avatar|loading|placeholder|transparent|blank|grey|qrcode|qr_code|wangwang|toolbar|button|btn)/i.test(url)) {
    return -10;
  }
  if (candidate.width && candidate.height && (candidate.width < 120 || candidate.height < 120)) {
    return -8;
  }
  if (/\.(svg|gif)(?:[?#]|$)/i.test(url)) {
    return -6;
  }

  let score = candidate.source === "meta" ? 3 : 0;
  if (/cbu\d+\.alicdn\.com\/img\/ibank/.test(url)) score += 5;
  if (/img\.alicdn\.com\/imgextra/.test(url)) score += 4;
  if (/(\/ibank\/|\/imgextra\/|\/uploaded\/)/.test(url)) score += 3;
  if (/(o1cn|tb1|tb2|!!\d{6,}|-0-cib|-0-lubanu-s)/i.test(candidate.url)) score += 3;
  if (/(offer|detail|product|main|sku|desc|album|pic)/i.test(candidate.url)) score += 1;
  if (/[?&](?:w|width|x-oss-process)=/.test(url) || /(?:_\d+x\d+|\d{3,}x\d{3,})/.test(url)) score += 1;
  if (candidate.width && candidate.height && candidate.width >= 240 && candidate.height >= 240) score += 2;
  if (candidate.source === "script") score += 1;
  return score;
}

function uniqueImageCandidates(candidates: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>();
  const result: ImageCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.url.replace(/(?:[?&](?:x-oss-process|imageView2|imageMogr2)=[^&]+)/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function collectFacts($: cheerio.CheerioAPI, compactHtml: string): ProductFact[] {
  const facts: ProductFact[] = [];

  $(".attributes-list li, .attributes li, .mod-detail-attributes td, [class*='attribute'] li, [class*='props'] li").each((_, element) => {
    const raw = cleanText($(element).text());
    const fact = splitFact(raw);
    if (fact) facts.push(fact);
  });

  const jsonPairs = [
    ...extractJsonFactPairs(compactHtml, /"材质"\s*:\s*"([^"]{1,80})"/g, "材质"),
    ...extractJsonFactPairs(compactHtml, /"颜色"\s*:\s*"([^"]{1,80})"/g, "颜色"),
    ...extractJsonFactPairs(compactHtml, /"尺码"\s*:\s*"([^"]{1,80})"/g, "尺码"),
    ...extractJsonFactPairs(compactHtml, /"品牌"\s*:\s*"([^"]{1,80})"/g, "品牌")
  ];

  facts.push(...jsonPairs);
  return uniqueFacts(facts).slice(0, 12);
}

function extractJsonFactPairs(html: string, pattern: RegExp, name: string): ProductFact[] {
  const facts: ProductFact[] = [];
  for (const match of html.matchAll(pattern)) {
    const value = cleanText(match[1]);
    if (value) facts.push({ name, value });
  }
  return facts;
}

function splitFact(raw?: string): ProductFact | null {
  const text = cleanText(raw);
  if (!text || text.length > 120) return null;
  const parts = text
    .split(/[:：]/)
    .map((part) => cleanText(part))
    .filter((part): part is string => Boolean(part));
  if (parts.length >= 2 && parts[0].length <= 12) {
    return { name: parts[0], value: parts.slice(1).join("：") };
  }
  return null;
}

function deriveTags(text: string): string[] {
  const candidates = [
    "女装", "男装", "童装", "外套", "夹克", "连衣裙", "衬衫", "卫衣", "羽绒服", "大衣",
    "短款", "长款", "宽松", "修身", "黑色", "白色", "春夏", "秋冬", "通勤", "高级感",
    "工厂货源", "批发", "现货", "跨境", "地毯", "地垫", "门垫", "脚垫", "浴室垫", "厨房垫"
  ];
  const tags = candidates.filter((tag) => text.includes(tag));
  return tags.length > 0 ? tags.slice(0, 8) : ["商品档案", "创意资产"];
}

function deriveSellingPoints(title: string | undefined, description: string | undefined, facts: ProductFact[]): string[] {
  const points = [
    title ? shortenPoint(`商品标题呈现：${title}`) : undefined,
    description ? shortenPoint(description) : undefined,
    facts.find((fact) => /材质|面料/.test(fact.name))?.value ? shortenPoint(`材质可作为近景重点：${facts.find((fact) => /材质|面料/.test(fact.name))?.value}`) : undefined,
    facts.find((fact) => /颜色|色|图案/.test(fact.name))?.value ? shortenPoint(`颜色/图案适合强化记忆点`) : undefined
  ].filter((point): point is string => Boolean(point));

  return points.length > 0 ? points.slice(0, 6) : ["公开信息可用于商品视觉创作"];
}

function collectDetailText($: cheerio.CheerioAPI, description?: string): string | undefined {
  const body = $("body").clone();
  body.find("script, style, noscript, svg").remove();
  const candidates = [
    description,
    $("#desc-lazyload-container").text(),
    $(".detail-description").text(),
    $(".content-detail").text(),
    body.text()
  ];
  const text = candidates
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ")
    .replace(/登录|注册|购物车|收藏|客服|举报/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 3000) : undefined;
}

function cleanCategory(value?: string): string | undefined {
  const text = cleanText(value);
  if (!text || /1）|2）|3）|4）/.test(text)) return undefined;
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

function buildProcurementInsights(input: {
  title?: string;
  price?: string;
  minOrderQuantity?: string;
  shopName?: string;
  companyName?: string;
  rawDetailText?: string;
  facts: ProductFact[];
}): string[] {
  const text = `${input.title ?? ""} ${input.rawDetailText ?? ""} ${input.facts.map((fact) => `${fact.name}${fact.value}`).join(" ")}`;
  const scene = input.facts.find((fact) => /场景|适用|用途/.test(fact.name))?.value;
  const insights = [
    input.price ? `价格吸引点：${input.price} 适合做批量采购测款。` : "价格吸引点：需结合起批量和规格判断采购价值。",
    input.minOrderQuantity ? `批发采购价值：${input.minOrderQuantity}，适合按库存和渠道节奏下单。` : "批发采购价值：适合作为 1688 选品素材继续评估。",
    scene ? `使用场景：${scene}。` : "使用场景：可从商品图和标题延展生活方式场景。",
    /地毯|地垫|门垫|脚垫/.test(text) ? "潜在顾虑：采购方会关注厚度、防滑、耐脏、边缘稳定性和实际铺设效果。" : "潜在顾虑：采购方会关注材质、规格、色差、包装和交付稳定性。",
    input.companyName || input.shopName ? `适合客户类型：电商卖家、内容电商选品方、渠道采购和小批量试单客户。` : "适合客户类型：适合有内容化表达能力的电商卖家继续包装。",
    /地毯|地垫|门垫|脚垫/.test(text) ? "广告情绪点：低成本改造空间氛围，制造前后对比。" : "广告情绪点：把参数化商品转译成直观的使用价值。"
  ];
  return insights.map(shortenInsight);
}

function shortenPoint(value: string): string {
  const text = cleanText(value) ?? value;
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

function shortenInsight(value: string): string {
  const text = cleanText(value) ?? value;
  return text.length > 70 ? `${text.slice(0, 69)}…` : text;
}

function regexFirst(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] || match?.[0]) {
      return match[1] || match[0];
    }
  }
  return undefined;
}

function firstPresent(values: Array<string | undefined | null>): string | undefined {
  return values.map((value) => cleanText(value)).find(Boolean);
}

function cleanTitle(value?: string): string | undefined {
  return cleanText(value)
    ?.replace(/[-_—|].*(淘宝|天猫|Tmall|1688|阿里巴巴).*$/i, "")
    .replace(/淘宝网|天猫Tmall\.com|1688\.com|阿里巴巴/g, "")
    .trim();
}

function isLowInformationShell(title: string | undefined, images: string[], description: string | undefined): boolean {
  if (images.length > 0 || description) return false;
  if (!title) return true;
  return ["商品详情页", "商品详情", "登录", "验证", "安全验证", "访问验证"].includes(title);
}

function cleanPrice(value?: string): string | undefined {
  const text = cleanText(value);
  if (!text) return undefined;
  return text.startsWith("¥") ? text : `¥${text.replace(/^¥/, "")}`;
}

function cleanText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const decoded = value
    .replace(/\\"/g, "\"")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  const compact = decoded.replace(/\s+/g, " ").trim();
  return compact.length > 0 ? compact : undefined;
}

function normalizeImageUrl(value?: string): string | undefined {
  const text = cleanText(value);
  if (!text) return undefined;
  const absolute = text.startsWith("//") ? `https:${text}` : text;
  if (absolute.startsWith("http://") || absolute.startsWith("https://")) {
    try {
      const url = new URL(absolute);
      const nestedImage = url.searchParams.get("url") || url.searchParams.get("src") || url.searchParams.get("img");
      if (nestedImage && /\.(?:jpg|jpeg|png|webp)(?:[?#.]|$)/i.test(nestedImage)) {
        return normalizeImageUrl(nestedImage);
      }
      if (!/\.(?:jpg|jpeg|png|webp)(?:[?#.]|$)/i.test(url.pathname)) {
        return undefined;
      }
      url.pathname = url.pathname.replace(/\.\d{2,5}x\d{2,5}(?=\.(?:jpg|jpeg|png|webp)$)/i, "");
      return url.toString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueFacts(facts: ProductFact[]): ProductFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.name}:${fact.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
