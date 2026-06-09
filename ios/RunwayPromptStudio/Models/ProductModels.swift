import Foundation

struct ProductInfo: Codable, Identifiable, Hashable {
    let id: String
    let sourceUrl: String
    let normalizedUrl: String?
    let platform: String
    let platformProductId: String?
    let title: String
    let price: String?
    let minOrderQuantity: String?
    let shopName: String?
    let companyName: String?
    let locationText: String?
    let categoryText: String?
    let coverImageUrl: String?
    let imageUrls: [String]
    let tags: [String]
    let productFacts: [ProductFact]
    let sellingPoints: [String]
    let procurementInsights: [String]
    let reviewInsights: [String]
    let reviews: [ProductReview]
    let rawDetailText: String?
    let extractionStatus: ExtractionStatus
    let extractedAt: Date
}

struct ExtractionStatus: Codable, Hashable {
    let source: String
    let canReadPublicPage: Bool
    let hasLoginOrCaptchaBlock: Bool
    let commentsAvailable: Bool
    let usedMockData: Bool
    let mockReason: String?
    let extractedFields: [String]
    let missingFields: [String]
    let message: String?

    init(
        source: String,
        canReadPublicPage: Bool,
        hasLoginOrCaptchaBlock: Bool,
        commentsAvailable: Bool,
        usedMockData: Bool,
        mockReason: String? = nil,
        extractedFields: [String] = [],
        missingFields: [String] = [],
        message: String? = nil
    ) {
        self.source = source
        self.canReadPublicPage = canReadPublicPage
        self.hasLoginOrCaptchaBlock = hasLoginOrCaptchaBlock
        self.commentsAvailable = commentsAvailable
        self.usedMockData = usedMockData
        self.mockReason = mockReason
        self.extractedFields = extractedFields
        self.missingFields = missingFields
        self.message = message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        source = try container.decodeIfPresent(String.self, forKey: .source) ?? "legacy"
        canReadPublicPage = try container.decodeIfPresent(Bool.self, forKey: .canReadPublicPage) ?? true
        hasLoginOrCaptchaBlock = try container.decodeIfPresent(Bool.self, forKey: .hasLoginOrCaptchaBlock) ?? false
        commentsAvailable = try container.decodeIfPresent(Bool.self, forKey: .commentsAvailable) ?? false
        usedMockData = try container.decodeIfPresent(Bool.self, forKey: .usedMockData) ?? false
        mockReason = try container.decodeIfPresent(String.self, forKey: .mockReason)
        extractedFields = try container.decodeIfPresent([String].self, forKey: .extractedFields) ?? []
        missingFields = try container.decodeIfPresent([String].self, forKey: .missingFields) ?? []
        message = try container.decodeIfPresent(String.self, forKey: .message)
    }
}

struct ProductFact: Codable, Identifiable, Hashable {
    var id: String { "\(name)-\(value)" }
    let name: String
    let value: String
}

struct ProductReview: Codable, Identifiable, Hashable {
    var id: String { "\(username ?? "anonymous")-\(content)-\(dateText ?? "")" }
    let username: String?
    let content: String
    let rating: String?
    let dateText: String?
}

struct AdPromptResult: Codable, Identifiable, Hashable {
    let id: String
    let productId: String
    let conceptTitle: String
    let coreContrast: String
    let visualStyle: String
    let promptCN: String
    let promptEN: String
    let shotList: [String]
    let negativePrompt: String
    let createdAt: Date
}

struct CategoryAnalysis: Codable, Hashable {
    let primaryCategory: String
    let secondaryCategory: String
    let productType: String
    let isFashionProduct: Bool
    let consumerScenario: String
    let b2bProcurementScenario: String
    let visualKeywords: [String]
    let materialKeywords: [String]
    let riskNotes: [String]
}

struct ProductDiagnosis: Codable, Hashable {
    let coreJudgement: String
    let viralPotentialScore: Int
    let mainOpportunities: [String]
    let mainWeaknesses: [String]
    let visualFocus: [String]
    let contentHooks: [String]
    let suitablePlatforms: [String]
}

struct CreativeDirection: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let targetAudience: String
    let coreScene: String
    let visualSuggestion: String
    let videoHook: String
    let imageOptimizationSuggestion: String
    let suitablePlatform: String
}

struct DirectionalPromptAsset: Codable, Identifiable, Hashable {
    var id: String { directionId }
    let directionId: String
    let directionName: String
    let conceptTitle: String
    let coreContrast: String
    let imagePromptCN: String
    let imagePromptEN: String
    let videoPromptCN: String
    let videoPromptEN: String
    let shotList: [String]
    let negativePrompt: String
}

struct CreativeAssetResult: Codable, Identifiable, Hashable {
    let id: String
    let productId: String
    let conceptTitle: String
    let coreContrast: String
    let lifestylePositioning: String
    let imagePromptCN: String
    let imagePromptEN: String
    let videoPromptCN: String
    let videoPromptEN: String
    let shotList: [String]
    let negativePrompt: String
    let directionalPrompts: [DirectionalPromptAsset]
    let createdAt: Date

    init(
        id: String,
        productId: String,
        conceptTitle: String,
        coreContrast: String,
        lifestylePositioning: String,
        imagePromptCN: String,
        imagePromptEN: String,
        videoPromptCN: String,
        videoPromptEN: String,
        shotList: [String],
        negativePrompt: String,
        directionalPrompts: [DirectionalPromptAsset] = [],
        createdAt: Date
    ) {
        self.id = id
        self.productId = productId
        self.conceptTitle = conceptTitle
        self.coreContrast = coreContrast
        self.lifestylePositioning = lifestylePositioning
        self.imagePromptCN = imagePromptCN
        self.imagePromptEN = imagePromptEN
        self.videoPromptCN = videoPromptCN
        self.videoPromptEN = videoPromptEN
        self.shotList = shotList
        self.negativePrompt = negativePrompt
        self.directionalPrompts = directionalPrompts
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        productId = try container.decode(String.self, forKey: .productId)
        conceptTitle = try container.decode(String.self, forKey: .conceptTitle)
        coreContrast = try container.decode(String.self, forKey: .coreContrast)
        lifestylePositioning = try container.decode(String.self, forKey: .lifestylePositioning)
        imagePromptCN = try container.decode(String.self, forKey: .imagePromptCN)
        imagePromptEN = try container.decode(String.self, forKey: .imagePromptEN)
        videoPromptCN = try container.decode(String.self, forKey: .videoPromptCN)
        videoPromptEN = try container.decode(String.self, forKey: .videoPromptEN)
        shotList = try container.decode([String].self, forKey: .shotList)
        negativePrompt = try container.decode(String.self, forKey: .negativePrompt)
        directionalPrompts = try container.decodeIfPresent([DirectionalPromptAsset].self, forKey: .directionalPrompts) ?? []
        createdAt = try container.decode(Date.self, forKey: .createdAt)
    }
}

struct SavedCreation: Codable, Identifiable, Hashable {
    let id: String
    let product: ProductInfo
    let diagnosis: ProductDiagnosis?
    let directions: [CreativeDirection]
    let creativeAsset: CreativeAssetResult
    let savedAt: Date
}

struct GarmentAnalysis: Codable, Hashable {
    let category: String
    let style: String
    let silhouette: String
    let color: String
    let materialGuess: String
    let keyDetails: [String]
    let displayFocus: [String]
    let riskNotes: [String]
}

struct ThreeViewSet: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String
    let threeViewImageUrl: String?
    let frontViewUrl: String
    let sideViewUrl: String
    let backViewUrl: String
    let styleTags: [String]
    let generationMode: String
    let isMock: Bool
    let mockReason: String?
}

struct GenerationStatus: Codable, Hashable {
    let imageGenerationMode: String
    let usedMock: Bool
    let message: String
}

struct GenerateThreeViewSetsResponse: Codable, Hashable {
    let sessionId: String
    let garmentAnalysis: GarmentAnalysis
    let sets: [ThreeViewSet]
    let generationStatus: GenerationStatus
}

struct VideoQuota: Codable, Hashable {
    let deviceId: String
    let date: String
    let limit: Int
    let used: Int
    let remaining: Int
    let resetAt: Date
}

struct BackgroundAsset: Codable, Hashable {
    let id: String
    let url: String
    let filename: String
    let isFallback: Bool?
}

struct ModelAsset: Codable, Hashable {
    let id: String
    let url: String
    let filename: String
    let isFallback: Bool?
}

struct VideoReferenceGenerationStatus: Codable, Hashable {
    let imageGenerationMode: String
    let usedMock: Bool
    let message: String
}

struct GarmentVideoPromptCard: Codable, Hashable, Identifiable {
    var id: String { title }
    let title: String
    let shortDescription: String
    let promptCN: String
    let promptEN: String
}

struct GarmentVideoPromptResult: Codable, Hashable {
    let detailShowcase: GarmentVideoPromptCard
    let modelMotion: GarmentVideoPromptCard
    let beforeAfter: GarmentVideoPromptCard
}

struct PreparedGarmentVideoPromptResponse: Codable, Hashable {
    let sessionId: String
    let garmentAnalysis: GarmentAnalysis
    let selectedSet: ThreeViewSet
    let modelAsset: ModelAsset
    let background: BackgroundAsset
    let videoReferenceImageUrl: String
    let videoReferenceGenerationStatus: VideoReferenceGenerationStatus
    let createdAt: Date
}

struct GeneratedVideoPromptResponse: Codable, Hashable {
    let sessionId: String
    let prompt: String
    let createdAt: Date
}

struct StartedSeedanceVideoResponse: Codable, Hashable {
    let sessionId: String
    let taskId: String
    let status: String
    let quota: VideoQuota?
    let createdAt: Date
}

struct SeedanceVideoTaskStatusResponse: Codable, Hashable {
    let sessionId: String
    let taskId: String
    let status: String
    let videoUrl: String?
    let failureCode: String?
    let failureMessage: String?
    let isDone: Bool
    let isFailed: Bool
    let checkedAt: Date
}

struct GeneratedSeedanceVideoResponse: Codable, Hashable {
    let sessionId: String
    let taskId: String
    let videoUrl: String
    let createdAt: Date
}

struct GarmentSessionStatusResponse: Codable, Hashable {
    let sessionId: String
    let hasThreeView: Bool
    let hasVideoReference: Bool
    let hasFinalPrompt: Bool
    let seedanceTaskId: String?
    let generatedVideoUrl: String?
    let createdAt: Date
}

struct GarmentTaskSummary: Codable, Hashable, Identifiable {
    var id: String { sessionId }
    let sessionId: String
    let deviceId: String?
    let status: String
    let currentStage: String?
    let progressMessage: String?
    let errorMessage: String?
    let frontImageUrl: String
    let backImageUrl: String
    let garmentAnalysis: GarmentAnalysis?
    let sets: [ThreeViewSet]
    let generationStatus: GenerationStatus?
    let selectedSet: ThreeViewSet?
    let modelAsset: ModelAsset?
    let background: BackgroundAsset?
    let videoReferenceImageUrl: String?
    let videoReferenceGenerationStatus: VideoReferenceGenerationStatus?
    let finalVideoPrompt: String?
    let seedanceTaskId: String?
    let generatedVideoUrl: String?
    let createdAt: Date
    let updatedAt: Date
    let completedAt: Date?
    let isInProgress: Bool
}

struct GarmentTaskListResponse: Codable, Hashable {
    let deviceId: String
    let tasks: [GarmentTaskSummary]
}
