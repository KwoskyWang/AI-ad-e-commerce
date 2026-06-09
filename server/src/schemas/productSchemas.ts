import { z } from "zod";

export const productFactSchema = z.object({
  name: z.string(),
  value: z.string()
});

export const productReviewSchema = z.object({
  username: z.string().nullable().optional(),
  content: z.string(),
  rating: z.string().nullable().optional(),
  dateText: z.string().nullable().optional()
});

export const extractionStatusSchema = z.object({
  source: z.string(),
  canReadPublicPage: z.boolean(),
  hasLoginOrCaptchaBlock: z.boolean(),
  commentsAvailable: z.boolean(),
  usedMockData: z.boolean(),
  mockReason: z.string().nullable().optional(),
  extractedFields: z.array(z.string()).default([]),
  missingFields: z.array(z.string()).default([]),
  message: z.string().nullable().optional()
});

export const productInfoSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().url(),
  normalizedUrl: z.string().url().nullable().optional(),
  platform: z.string(),
  platformProductId: z.string().nullable().optional(),
  title: z.string(),
  price: z.string().nullable().optional(),
  minOrderQuantity: z.string().nullable().optional(),
  shopName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  locationText: z.string().nullable().optional(),
  categoryText: z.string().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()),
  tags: z.array(z.string()),
  productFacts: z.array(productFactSchema),
  sellingPoints: z.array(z.string()),
  procurementInsights: z.array(z.string()).default([]),
  reviewInsights: z.array(z.string()),
  reviews: z.array(productReviewSchema),
  rawDetailText: z.string().nullable().optional(),
  extractionStatus: extractionStatusSchema.default({
    source: "legacy",
    canReadPublicPage: true,
    hasLoginOrCaptchaBlock: false,
    commentsAvailable: false,
    usedMockData: false,
    extractedFields: [],
    missingFields: []
  }),
  extractedAt: z.string()
});

export const categoryAnalysisSchema = z.object({
  primaryCategory: z.string(),
  secondaryCategory: z.string(),
  productType: z.string(),
  isFashionProduct: z.boolean(),
  consumerScenario: z.string(),
  b2bProcurementScenario: z.string(),
  visualKeywords: z.array(z.string()),
  materialKeywords: z.array(z.string()),
  riskNotes: z.array(z.string())
});

export const adPromptResultSchema = z.object({
  id: z.string(),
  productId: z.string(),
  conceptTitle: z.string(),
  coreContrast: z.string(),
  visualStyle: z.string(),
  promptCN: z.string(),
  promptEN: z.string(),
  shotList: z.array(z.string()),
  negativePrompt: z.string(),
  createdAt: z.string()
});

export const productDiagnosisSchema = z.object({
  coreJudgement: z.string(),
  viralPotentialScore: z.number().int().min(1).max(5),
  mainOpportunities: z.array(z.string()),
  mainWeaknesses: z.array(z.string()),
  visualFocus: z.array(z.string()),
  contentHooks: z.array(z.string()),
  suitablePlatforms: z.array(z.string())
});

export const creativeDirectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetAudience: z.string(),
  coreScene: z.string(),
  visualSuggestion: z.string(),
  videoHook: z.string(),
  imageOptimizationSuggestion: z.string(),
  suitablePlatform: z.string()
});

export const directionalPromptAssetSchema = z.object({
  directionId: z.string(),
  directionName: z.string(),
  conceptTitle: z.string(),
  coreContrast: z.string(),
  imagePromptCN: z.string(),
  imagePromptEN: z.string(),
  videoPromptCN: z.string(),
  videoPromptEN: z.string(),
  shotList: z.array(z.string()),
  negativePrompt: z.string()
});

export const creativeAssetResultSchema = z.object({
  id: z.string(),
  productId: z.string(),
  conceptTitle: z.string(),
  coreContrast: z.string(),
  lifestylePositioning: z.string(),
  imagePromptCN: z.string(),
  imagePromptEN: z.string(),
  videoPromptCN: z.string(),
  videoPromptEN: z.string(),
  shotList: z.array(z.string()),
  negativePrompt: z.string(),
  directionalPrompts: z.array(directionalPromptAssetSchema).default([]),
  createdAt: z.string()
});

export const extractProductRequestSchema = z.object({
  url: z.string().min(1)
});

export const analyzeProductRequestSchema = z.object({
  product: productInfoSchema
});

export const generateCreativeAssetsRequestSchema = z.object({
  product: productInfoSchema,
  category: categoryAnalysisSchema.optional(),
  diagnosis: productDiagnosisSchema.optional(),
  directions: z.array(creativeDirectionSchema).optional(),
  analysisMode: z.string().optional()
});

export const generateAdPromptRequestSchema = z.object({
  product: productInfoSchema,
  styleMode: z.string().optional()
});

export type ProductFact = z.infer<typeof productFactSchema>;
export type ProductReview = z.infer<typeof productReviewSchema>;
export type ExtractionStatus = z.infer<typeof extractionStatusSchema>;
export type ProductInfo = z.infer<typeof productInfoSchema>;
export type AdPromptResult = z.infer<typeof adPromptResultSchema>;
export type CategoryAnalysis = z.infer<typeof categoryAnalysisSchema>;
export type ProductDiagnosis = z.infer<typeof productDiagnosisSchema>;
export type CreativeDirection = z.infer<typeof creativeDirectionSchema>;
export type DirectionalPromptAsset = z.infer<typeof directionalPromptAssetSchema>;
export type CreativeAssetResult = z.infer<typeof creativeAssetResultSchema>;
