import type { AdPromptResult, ProductInfo } from "../../schemas/productSchemas.js";

export type PromptDraft = Omit<AdPromptResult, "id" | "productId" | "createdAt">;

export interface PromptTemplate {
  id: string;
  label: string;
  systemPrompt: string;
  buildUserPayload: (product: ProductInfo, styleMode: string) => unknown;
  generateMock: (product: ProductInfo) => PromptDraft;
}

export const JSON_OUTPUT_INSTRUCTIONS = `输出必须是 JSON，不要包含 Markdown。字段必须为：
{
  "conceptTitle": string,
  "coreContrast": string,
  "visualStyle": string,
  "promptCN": string,
  "promptEN": string,
  "shotList": string[],
  "negativePrompt": string
}`;
