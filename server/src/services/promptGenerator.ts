import { randomUUID } from "node:crypto";
import type { AdPromptResult, ProductInfo } from "../schemas/productSchemas.js";
import { adPromptResultSchema } from "../schemas/productSchemas.js";
import { generateStructured } from "./llm/llmClient.js";
import { selectPromptTemplate } from "./promptTemplates/index.js";
import type { PromptDraft } from "./promptTemplates/types.js";

export async function generateAdPrompt(product: ProductInfo, styleMode = "contrast"): Promise<AdPromptResult> {
  const template = selectPromptTemplate(product);
  const generated = await generateStructured<PromptDraft>({
    taskName: "legacy_ad_prompt_generation",
    schemaName: "LegacyAdPrompt",
    schema: LegacyAdPromptSchema,
    mockResult: template.generateMock(product),
    maxOutputTokens: 2600,
    systemPrompt: template.systemPrompt,
    userPrompt: JSON.stringify(template.buildUserPayload(product, styleMode))
  });
  const candidate = {
    id: "temporary",
    productId: "temporary",
    ...generated,
    createdAt: new Date().toISOString()
  };
  const checked = adPromptResultSchema.parse(candidate);
  return finalizePrompt(product, {
    conceptTitle: checked.conceptTitle,
    coreContrast: checked.coreContrast,
    visualStyle: checked.visualStyle,
    promptCN: checked.promptCN,
    promptEN: checked.promptEN,
    shotList: checked.shotList,
    negativePrompt: checked.negativePrompt
  });
}

function finalizePrompt(product: ProductInfo, draft: PromptDraft): AdPromptResult {
  return {
    id: randomUUID(),
    productId: product.id,
    ...draft,
    createdAt: new Date().toISOString()
  };
}

const LegacyAdPromptSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    conceptTitle: { type: "string" },
    coreContrast: { type: "string" },
    visualStyle: { type: "string" },
    promptCN: { type: "string" },
    promptEN: { type: "string" },
    shotList: {
      type: "array",
      items: { type: "string" }
    },
    negativePrompt: { type: "string" }
  },
  required: ["conceptTitle", "coreContrast", "visualStyle", "promptCN", "promptEN", "shotList", "negativePrompt"]
};
