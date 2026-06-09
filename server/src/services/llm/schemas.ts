const stringArray = {
  type: "array",
  items: { type: "string" }
} as const;

export const CategoryAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primaryCategory: { type: "string" },
    secondaryCategory: { type: "string" },
    productType: { type: "string" },
    isFashionProduct: { type: "boolean" },
    consumerScenario: { type: "string" },
    b2bProcurementScenario: { type: "string" },
    visualKeywords: stringArray,
    materialKeywords: stringArray,
    riskNotes: stringArray
  },
  required: [
    "primaryCategory",
    "secondaryCategory",
    "productType",
    "isFashionProduct",
    "consumerScenario",
    "b2bProcurementScenario",
    "visualKeywords",
    "materialKeywords",
    "riskNotes"
  ]
};

export const ProductDiagnosisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    coreJudgement: { type: "string" },
    viralPotentialScore: { type: "integer", minimum: 1, maximum: 5 },
    mainOpportunities: stringArray,
    mainWeaknesses: stringArray,
    visualFocus: stringArray,
    contentHooks: stringArray,
    suitablePlatforms: stringArray
  },
  required: [
    "coreJudgement",
    "viralPotentialScore",
    "mainOpportunities",
    "mainWeaknesses",
    "visualFocus",
    "contentHooks",
    "suitablePlatforms"
  ]
};

const CreativeDirectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    targetAudience: { type: "string" },
    coreScene: { type: "string" },
    visualSuggestion: { type: "string" },
    videoHook: { type: "string" },
    imageOptimizationSuggestion: { type: "string" },
    suitablePlatform: { type: "string" }
  },
  required: [
    "id",
    "name",
    "targetAudience",
    "coreScene",
    "visualSuggestion",
    "videoHook",
    "imageOptimizationSuggestion",
    "suitablePlatform"
  ]
} as const;

export const CreativeDirectionListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    directions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: CreativeDirectionSchema
    }
  },
  required: ["directions"]
};

export const CreativeAssetResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    conceptTitle: { type: "string" },
    coreContrast: { type: "string" },
    lifestylePositioning: { type: "string" },
    imagePromptCN: { type: "string" },
    imagePromptEN: { type: "string" },
    videoPromptCN: { type: "string" },
    videoPromptEN: { type: "string" },
    shotList: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: { type: "string" }
    },
    negativePrompt: { type: "string" },
    directionalPrompts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          directionId: { type: "string" },
          directionName: { type: "string" },
          conceptTitle: { type: "string" },
          coreContrast: { type: "string" },
          imagePromptCN: { type: "string" },
          imagePromptEN: { type: "string" },
          videoPromptCN: { type: "string" },
          videoPromptEN: { type: "string" },
          shotList: {
            type: "array",
            minItems: 5,
            maxItems: 8,
            items: { type: "string" }
          },
          negativePrompt: { type: "string" }
        },
        required: [
          "directionId",
          "directionName",
          "conceptTitle",
          "coreContrast",
          "imagePromptCN",
          "imagePromptEN",
          "videoPromptCN",
          "videoPromptEN",
          "shotList",
          "negativePrompt"
        ]
      }
    }
  },
  required: [
    "conceptTitle",
    "coreContrast",
    "lifestylePositioning",
    "imagePromptCN",
    "imagePromptEN",
    "videoPromptCN",
    "videoPromptEN",
    "shotList",
    "negativePrompt",
    "directionalPrompts"
  ]
};

export const SellingPointExtractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sellingPoints: stringArray,
    procurementInsights: stringArray,
    visualSellingPoints: stringArray,
    riskNotes: stringArray
  },
  required: ["sellingPoints", "procurementInsights", "visualSellingPoints", "riskNotes"]
};

export const GarmentAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string" },
    style: { type: "string" },
    silhouette: { type: "string" },
    color: { type: "string" },
    materialGuess: { type: "string" },
    keyDetails: stringArray,
    displayFocus: stringArray,
    riskNotes: stringArray
  },
  required: [
    "category",
    "style",
    "silhouette",
    "color",
    "materialGuess",
    "keyDetails",
    "displayFocus",
    "riskNotes"
  ]
};

const GarmentPromptCardSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    shortDescription: { type: "string" },
    promptCN: { type: "string" },
    promptEN: { type: "string" }
  },
  required: ["title", "shortDescription", "promptCN", "promptEN"]
} as const;

export const GarmentVideoPromptResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    detailShowcase: GarmentPromptCardSchema,
    modelMotion: GarmentPromptCardSchema,
    beforeAfter: GarmentPromptCardSchema
  },
  required: ["detailShowcase", "modelMotion", "beforeAfter"]
};
