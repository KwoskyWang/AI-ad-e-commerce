import Foundation

@MainActor
final class HistoryStore: ObservableObject {
    @Published private(set) var savedCreations: [SavedCreation] = []

    private let fileURL: URL

    init() {
        let supportDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appDirectory = supportDirectory.appendingPathComponent("RunwayPromptStudio", isDirectory: true)
        try? FileManager.default.createDirectory(at: appDirectory, withIntermediateDirectories: true)
        fileURL = appDirectory.appendingPathComponent("saved-creations.json")
        load()
    }

    func save(product: ProductInfo, diagnosis: ProductDiagnosis?, directions: [CreativeDirection], creativeAsset: CreativeAssetResult) {
        let saved = SavedCreation(
            id: UUID().uuidString,
            product: product,
            diagnosis: diagnosis,
            directions: directions,
            creativeAsset: creativeAsset,
            savedAt: Date()
        )
        savedCreations.removeAll { $0.product.id == product.id && $0.creativeAsset.id == creativeAsset.id }
        savedCreations.insert(saved, at: 0)
        persist()
    }

    func contains(creativeAsset: CreativeAssetResult) -> Bool {
        savedCreations.contains { $0.creativeAsset.id == creativeAsset.id }
    }

    func delete(_ creation: SavedCreation) {
        savedCreations.removeAll { $0.id == creation.id }
        persist()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL) else {
            savedCreations = []
            return
        }
        savedCreations = (try? jsonDecoder.decode([SavedCreation].self, from: data)) ?? []
    }

    private func persist() {
        guard let data = try? jsonEncoder.encode(savedCreations) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}
