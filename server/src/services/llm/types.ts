export type LLMTaskName =
  | "category_analysis"
  | "product_diagnosis"
  | "creative_direction"
  | "creative_asset_generation"
  | "selling_point_extraction"
  | "procurement_insight_generation"
  | "legacy_ad_prompt_generation"
  | "garment_vision_analysis"
  | "garment_video_prompt_generation";

export interface LLMError {
  code: string;
  message: string;
  provider?: string;
  model?: string;
  status?: number;
}

export class LLMProviderError extends Error {
  code: string;
  provider?: string;
  model?: string;
  status?: number;

  constructor(error: LLMError) {
    super(error.message);
    this.name = "LLMProviderError";
    this.code = error.code;
    this.provider = error.provider;
    this.model = error.model;
    this.status = error.status;
  }
}
