export interface GarmentAnalysis {
  category: string;
  style: string;
  silhouette: string;
  color: string;
  materialGuess: string;
  keyDetails: string[];
  displayFocus: string[];
  riskNotes: string[];
}

export interface ThreeViewSet {
  id: string;
  title: string;
  description: string;
  threeViewImageUrl?: string;
  frontViewUrl: string;
  sideViewUrl: string;
  backViewUrl: string;
  styleTags: string[];
  generationMode: string;
  isMock: boolean;
  mockReason?: string | null;
}

export interface GenerationStatus {
  imageGenerationMode: string;
  usedMock: boolean;
  message: string;
}

export interface BackgroundAsset {
  id: string;
  url: string;
  filename: string;
  isFallback?: boolean;
}

export interface ModelAsset {
  id: string;
  url: string;
  filename: string;
  isFallback?: boolean;
}

export interface VideoReferenceGenerationStatus {
  imageGenerationMode: string;
  usedMock: boolean;
  message: string;
}

export interface GarmentVideoPromptCard {
  title: string;
  shortDescription: string;
  promptCN: string;
  promptEN: string;
}

export interface GarmentVideoPromptResult {
  detailShowcase: GarmentVideoPromptCard;
  modelMotion: GarmentVideoPromptCard;
  beforeAfter: GarmentVideoPromptCard;
}

export interface GarmentSession {
  sessionId: string;
  deviceId?: string;
  status?: "queued" | "processing" | "ready_for_video" | "video_processing" | "completed" | "failed";
  currentStage?: string;
  progressMessage?: string;
  errorMessage?: string;
  frontImagePath: string;
  backImagePath: string;
  frontImageUrl: string;
  backImageUrl: string;
  garmentAnalysis?: GarmentAnalysis;
  sets: ThreeViewSet[];
  generationStatus?: GenerationStatus;
  selectedSet?: ThreeViewSet;
  background?: BackgroundAsset;
  modelAsset?: ModelAsset;
  videoReferenceImageUrl?: string;
  videoReferenceGenerationStatus?: VideoReferenceGenerationStatus;
  finalVideoPrompt?: string;
  tosGarmentImageKey?: string;
  tosGarmentImageUrl?: string;
  tosVideoReferenceImageKey?: string;
  tosVideoReferenceImageUrl?: string;
  generatedVideoUrl?: string;
  seedanceTaskId?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}
