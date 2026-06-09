import SwiftUI
import UIKit

struct HistoryView: View {
    @EnvironmentObject private var historyStore: HistoryStore
    private let apiClient = APIClient()
    @State private var garmentTasks: [GarmentTaskSummary] = []
    @State private var isLoadingTasks = false
    @State private var taskErrorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                StudioDesign.background.ignoresSafeArea()

                if garmentTasks.isEmpty && historyStore.savedCreations.isEmpty && !isLoadingTasks {
                    VStack(spacing: 14) {
                        Image(systemName: "tray")
                            .font(.system(size: 40, weight: .light))
                            .foregroundColor(StudioDesign.muted)
                        Text("暂无历史记录")
                            .font(.title3.weight(.semibold))
                            .foregroundColor(StudioDesign.ink)
                        Text("上传过的服装任务、进行中的视频和已完成结果会出现在这里。")
                            .font(.subheadline)
                            .foregroundColor(StudioDesign.muted)
                            .multilineTextAlignment(.center)
                    }
                    .padding(28)
                    .studioCard()
                    .padding(.horizontal, 28)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 14) {
                            if let taskErrorMessage {
                                Text(taskErrorMessage)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundColor(.orange)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(12)
                                    .background(Color.orange.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }

                            if isLoadingTasks {
                                ProgressView("正在刷新历史任务")
                                    .frame(maxWidth: .infinity)
                                    .padding(18)
                                    .studioCard()
                            }

                            ForEach(garmentTasks) { task in
                                NavigationLink {
                                    GarmentTaskHistoryDetailView(task: task)
                                } label: {
                                    GarmentTaskHistoryRow(task: task)
                                }
                                .buttonStyle(.plain)
                            }

                            ForEach(historyStore.savedCreations) { creation in
                                NavigationLink {
                                    SavedCreationDetailView(creation: creation)
                                } label: {
                                    HistoryRow(creation: creation)
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        historyStore.delete(creation)
                                    } label: {
                                        Label("删除", systemImage: "trash")
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.vertical, 18)
                    }
                }
            }
            .navigationTitle("历史")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await refreshGarmentTasks() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task {
                await refreshGarmentTasks()
            }
        }
    }

    private func refreshGarmentTasks() async {
        guard !isLoadingTasks else { return }
        isLoadingTasks = true
        taskErrorMessage = nil
        do {
            garmentTasks = try await apiClient.fetchGarmentTasks(deviceId: DeviceIdentifier.current()).tasks
        } catch {
            taskErrorMessage = "历史任务刷新失败，请稍后重试。"
        }
        isLoadingTasks = false
    }
}

struct GarmentTaskHistoryRow: View {
    let task: GarmentTaskSummary

    var body: some View {
        HStack(spacing: 14) {
            AsyncImage(url: URL(string: thumbnailURL)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Color.white.opacity(0.62).overlay(Image(systemName: "photo").foregroundColor(StudioDesign.muted))
                }
            }
            .frame(width: 78, height: 92)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Chip(text: statusLabel)
                    Text(task.createdAt.formatted(date: .numeric, time: .shortened))
                        .font(.caption.weight(.semibold))
                        .foregroundColor(StudioDesign.muted)
                }
                Text(task.garmentAnalysis?.style ?? "服装拍照任务")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(StudioDesign.ink)
                    .lineLimit(2)
                Text(task.progressMessage ?? "任务处理中")
                    .font(.footnote.weight(.medium))
                    .foregroundColor(task.status == "failed" ? .orange : StudioDesign.purple)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.bold))
                .foregroundColor(StudioDesign.muted.opacity(0.7))
        }
        .padding(12)
        .background(Color.white.opacity(0.74))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(StudioDesign.line))
    }

    private var thumbnailURL: String {
        task.generatedVideoUrl == nil ? (task.videoReferenceImageUrl ?? task.selectedSet?.threeViewImageUrl ?? task.frontImageUrl) : (task.videoReferenceImageUrl ?? task.frontImageUrl)
    }

    private var statusLabel: String {
        switch task.status {
        case "queued": return "排队中"
        case "processing": return "素材生成中"
        case "ready_for_video": return "待生成视频"
        case "video_processing": return "视频生成中"
        case "completed": return "已完成"
        case "failed": return "失败"
        default: return "处理中"
        }
    }
}

struct GarmentTaskHistoryDetailView: View {
    let task: GarmentTaskSummary
    @State private var copied = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SectionTitle(title: "任务状态", subtitle: task.progressMessage ?? "任务处理中")
                HStack {
                    Chip(text: task.status)
                    Spacer()
                    Text(task.updatedAt.formatted(date: .numeric, time: .shortened))
                        .font(.caption)
                        .foregroundColor(StudioDesign.muted)
                }

                imageBlock(title: "上传正面照", url: task.frontImageUrl)
                imageBlock(title: "上传反面照", url: task.backImageUrl)
                if let threeView = task.selectedSet?.threeViewImageUrl ?? task.selectedSet?.frontViewUrl {
                    imageBlock(title: "服装三视图", url: threeView)
                }
                if let model = task.modelAsset?.url {
                    imageBlock(title: "模特参考图", url: model)
                }
                if let background = task.background?.url {
                    imageBlock(title: "背景图", url: background)
                }
                if let reference = task.videoReferenceImageUrl {
                    imageBlock(title: "视频参考图", url: reference)
                }
                if let prompt = task.finalVideoPrompt {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(title: "视频提示词", subtitle: "可复制")
                        Button("复制提示词") {
                            UIPasteboard.general.string = prompt
                            copied = true
                        }
                        .buttonStyle(SecondaryActionButtonStyle())
                        Text(prompt)
                            .font(.footnote)
                            .foregroundColor(StudioDesign.muted)
                            .lineSpacing(4)
                    }
                    .studioCard()
                }
                if let videoUrl = task.generatedVideoUrl {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(title: "生成视频", subtitle: "已完成")
                        Button("复制视频地址") {
                            UIPasteboard.general.string = videoUrl
                            copied = true
                        }
                        .buttonStyle(SecondaryActionButtonStyle())
                        Text(videoUrl)
                            .font(.caption)
                            .foregroundColor(StudioDesign.muted)
                            .textSelection(.enabled)
                    }
                    .studioCard()
                }
            }
            .padding(18)
        }
        .background(StudioDesign.background)
        .navigationTitle("任务详情")
        .overlay(alignment: .bottom) {
            if copied {
                Text("已复制")
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(StudioDesign.ink.opacity(0.92))
                    .clipShape(Capsule())
                    .padding(.bottom, 18)
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            copied = false
                        }
                    }
            }
        }
    }

    private func imageBlock(title: String, url: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle(title: title, subtitle: "")
            AsyncImage(url: URL(string: url)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Color.white.opacity(0.62).overlay(Image(systemName: "photo").foregroundColor(StudioDesign.muted))
                }
            }
            .frame(height: 220)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .studioCard()
    }
}

struct HistoryRow: View {
    let creation: SavedCreation

    var body: some View {
        HStack(spacing: 14) {
            AsyncImage(url: URL(string: creation.product.coverImageUrl ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Color.white.opacity(0.62)
                }
            }
            .frame(width: 78, height: 92)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Chip(text: creation.product.platform)
                    Text(creation.product.price ?? "价格待确认")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(StudioDesign.muted)
                }
                Text(creation.product.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(StudioDesign.ink)
                    .lineLimit(2)
                Text(creation.creativeAsset.conceptTitle)
                    .font(.footnote.weight(.medium))
                    .foregroundColor(StudioDesign.purple)
                    .lineLimit(1)
                Text("完整创意资产 · \(creation.savedAt.formatted(date: .numeric, time: .shortened))")
                    .font(.caption)
                    .foregroundColor(StudioDesign.muted)
            }

            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.bold))
                .foregroundColor(StudioDesign.muted.opacity(0.7))
        }
        .padding(12)
        .background(Color.white.opacity(0.74))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(StudioDesign.line))
    }
}

struct SavedCreationDetailView: View {
    @EnvironmentObject private var historyStore: HistoryStore
    let creation: SavedCreation
    private let apiClient = APIClient()
    @State private var asset: CreativeAssetResult
    @State private var isRegenerating = false
    @State private var toastMessage: String?
    @State private var showRegenerateConfirmation = false

    init(creation: SavedCreation) {
        self.creation = creation
        _asset = State(initialValue: creation.creativeAsset)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                AsyncImage(url: URL(string: creation.product.coverImageUrl ?? "")) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        Color.white.opacity(0.62)
                    }
                }
                .frame(height: 300)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                VStack(alignment: .leading, spacing: 8) {
                    Chip(text: creation.product.platform)
                    Text(creation.product.title)
                        .font(.title3.weight(.bold))
                        .foregroundColor(StudioDesign.ink)
                    Text(creation.savedAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.footnote)
                        .foregroundColor(StudioDesign.muted)
                }
                .studioCard()

                if let diagnosis = creation.diagnosis {
                    CreativeAnalysisSection(diagnosis: diagnosis, product: creation.product)
                }

                if !creation.directions.isEmpty {
                    CreativeDirectionSection(directions: creation.directions)
                }

                GeneratedAssetsSection(
                    asset: asset,
                    isSaved: true,
                    onCopyFull: { copyFullAsset(asset) },
                    onCopyCN: { UIPasteboard.general.string = asset.videoPromptCN; showToast("已复制到剪贴板") },
                    onCopyEN: { UIPasteboard.general.string = asset.videoPromptEN; showToast("已复制到剪贴板") },
                    onCopyDirectional: { prompt in copyDirectionalPrompt(prompt) },
                    onRegenerate: { showRegenerateConfirmation = true },
                    onSave: {}
                )
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 18)
        }
        .background(StudioDesign.background)
        .navigationTitle("历史详情")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(role: .destructive) {
                    historyStore.delete(creation)
                } label: {
                    Image(systemName: "trash")
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let toastMessage {
                Text(toastMessage)
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(StudioDesign.ink.opacity(0.92))
                    .clipShape(Capsule())
                    .padding(.bottom, 18)
            }
        }
        .alert("确认重新生成？", isPresented: $showRegenerateConfirmation) {
            Button("取消", role: .cancel) {}
            Button("重新生成", role: .destructive) {
                Task {
                    await regenerate()
                }
            }
        } message: {
            Text("会替换当前详情页中的提示词，不会自动覆盖已保存时间。")
        }
    }

    private func regenerate() async {
        guard !isRegenerating else { return }
        isRegenerating = true
        do {
            asset = try await apiClient.generateCreativeAssets(product: creation.product, category: nil, diagnosis: creation.diagnosis, directions: creation.directions)
            showToast("已重新生成")
        } catch {
            showToast("创意生成失败，请稍后重试")
        }
        isRegenerating = false
    }

    private func copyFullAsset(_ asset: CreativeAssetResult) {
        UIPasteboard.general.string = """
        【创意标题】
        \(asset.conceptTitle)

        【核心反差】
        \(asset.coreContrast)

        【生活方式定位】
        \(asset.lifestylePositioning)

        【商品图改造 Prompt 中文】
        \(asset.imagePromptCN)

        【商品图改造 Prompt English】
        \(asset.imagePromptEN)

        【5-10 秒视频 Prompt 中文】
        \(asset.videoPromptCN)

        【5-10 秒视频 Prompt English】
        \(asset.videoPromptEN)

        【镜头分镜】
        \(asset.shotList.enumerated().map { String(format: "%02d %@", $0.offset + 1, $0.element) }.joined(separator: "\n"))

        \(directionalPromptCopyText(asset))

        【Negative Prompt】
        \(asset.negativePrompt)
        """
        showToast("已复制到剪贴板")
    }

    private func directionalPromptCopyText(_ asset: CreativeAssetResult) -> String {
        guard !asset.directionalPrompts.isEmpty else { return "" }
        return asset.directionalPrompts.map { prompt in
            """
            【\(prompt.directionName)】
            创意标题：\(prompt.conceptTitle)
            核心反差：\(prompt.coreContrast)

            图片 Prompt 中文：
            \(prompt.imagePromptCN)

            Image Prompt English:
            \(prompt.imagePromptEN)

            视频 Prompt 中文：
            \(prompt.videoPromptCN)

            Video Prompt English:
            \(prompt.videoPromptEN)

            镜头分镜：
            \(prompt.shotList.enumerated().map { String(format: "%02d %@", $0.offset + 1, $0.element) }.joined(separator: "\n"))

            Negative Prompt:
            \(prompt.negativePrompt)
            """
        }.joined(separator: "\n\n")
    }

    private func copyDirectionalPrompt(_ prompt: DirectionalPromptAsset) {
        UIPasteboard.general.string = """
        【\(prompt.directionName)】
        创意标题：\(prompt.conceptTitle)

        核心反差：
        \(prompt.coreContrast)

        图片 Prompt 中文：
        \(prompt.imagePromptCN)

        Image Prompt English:
        \(prompt.imagePromptEN)

        视频 Prompt 中文：
        \(prompt.videoPromptCN)

        Video Prompt English:
        \(prompt.videoPromptEN)

        镜头分镜：
        \(prompt.shotList.enumerated().map { String(format: "%02d %@", $0.offset + 1, $0.element) }.joined(separator: "\n"))

        Negative Prompt:
        \(prompt.negativePrompt)
        """
        showToast("已复制到剪贴板")
    }

    private func showToast(_ message: String) {
        withAnimation {
            toastMessage = message
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation {
                toastMessage = nil
            }
        }
    }
}
