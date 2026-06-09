import type { ProductInfo } from "../../schemas/productSchemas.js";
import { fashionPromptTemplate } from "./fashionTemplate.js";
import { rugPromptTemplate } from "./rugTemplate.js";
import type { PromptTemplate } from "./types.js";

export function selectPromptTemplate(product: ProductInfo): PromptTemplate {
  const text = [
    product.title,
    product.platform,
    product.shopName,
    ...product.tags,
    ...product.sellingPoints,
    ...product.reviewInsights,
    ...product.productFacts.flatMap((fact) => [fact.name, fact.value])
  ]
    .filter(Boolean)
    .join(" ");

  if (/地毯|地垫|门垫|脚垫|浴室垫|厨房垫|rug|carpet|mat/i.test(text)) {
    return rugPromptTemplate;
  }

  if (/女装|男装|童装|服装|衣|裙|裤|外套|夹克|衬衫|卫衣|大衣|羽绒服|fashion|clothing/i.test(text)) {
    return fashionPromptTemplate;
  }

  return fashionPromptTemplate;
}
