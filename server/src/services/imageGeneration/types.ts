import type { GarmentAnalysis, GenerationStatus, ThreeViewSet } from "../garmentTypes.js";

export interface GenerateThreeViewSetsParams {
  frontImagePath: string;
  backImagePath: string;
  frontImageUrl: string;
  backImageUrl: string;
  garmentAnalysis: GarmentAnalysis;
  sessionId: string;
  reqBaseURL: string;
}

export interface GenerateThreeViewSetsResult {
  sets: ThreeViewSet[];
  generationStatus: GenerationStatus;
}
