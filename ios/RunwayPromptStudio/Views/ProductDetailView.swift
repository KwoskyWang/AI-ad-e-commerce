import SwiftUI
import UIKit

struct ProductDetailView: View {
    let product: ProductInfo
    let apiClient: APIClient
    var onBackToHome: () -> Void

    @EnvironmentObject private var historyStore: HistoryStore
    @State private var category: CategoryAnalysis?
    @State private var diagnosis: ProductDiagnosis?
    @State private var directions: [CreativeDirection] = []
    @State private var creativeAsset: CreativeAssetResult?
    @State private var isAnalyzing = false
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var toastMessage: String?
    @State private var selectedImageUrl: String?
    @State private var isDataSourceExpanded = true
    @State private var showRegenerateConfirmation = false

    private var isAnalysisReady: Bool {
        diagnosis != nil && !directions.isEmpty
    }

    var body: some View {
        ScrollViewReader { proxy in
            GeometryReader { geometry in
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        DataSourceBanner(status: product.extractionStatus)
                        VStack(alignment: .leading, spacing: 10) {
                            hero
                            imageRail
                            tags
                        }
                        titleBlock

                        basicArchive
                        DataSourceDisclosure(status: product.extractionStatus, isExpanded: $isDataSourceExpanded)
                        facts
                        bulletCard(title: "商品卖点提炼", subtitle: "从标题、详情页、图片与参数中提炼可用于广告表达的卖点", items: product.sellingPoints)
                        bulletCard(title: "采购决策洞察", subtitle: product.extractionStatus.commentsAvailable ? nil : "当前页面未提供可直接读取的评论数据，已基于商品公开信息生成采购洞察", items: product.procurementInsights)
                        if let category {
                            CategoryAnalysisSection(category: category)
                        }
                        if diagnosis != nil || isAnalyzing {
                            CreativeAnalysisSection(diagnosis: diagnosis, product: product)
                        } else {
                            analysisActionCard
                        }
                        if !directions.isEmpty {
                            CreativeDirectionSection(directions: directions)
                        }
                        reviews

                        VStack(spacing: 8) {
                            PrimaryButton(
                                title: isAnalysisReady ? "开始创作" : "等待商品诊断完成",
                                isLoading: isGenerating,
                                isDisabled: !isAnalysisReady
                            ) {
                                Task {
                                    await generateAssets(proxy: proxy)
                                }
                            }
                            if !isAnalysisReady {
                                Text(isAnalyzing ? "商品诊断完成后即可生成提示词" : "请先生成商品诊断，再开始创作")
                                    .font(.footnote)
                                    .foregroundColor(StudioDesign.muted)
                                    .multilineTextAlignment(.center)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            if isGenerating {
                                generationStatus
                            }
                            Text("极富创造力的 AI 时代新生产力")
                                .font(.footnote)
                                .foregroundColor(StudioDesign.muted)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundColor(.red.opacity(0.8))
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }

                        if let creativeAsset {
                            GeneratedAssetsSection(
                                asset: creativeAsset,
                                isSaved: historyStore.contains(creativeAsset: creativeAsset),
                                onCopyFull: { copyFullAsset(creativeAsset) },
                                onCopyCN: { UIPasteboard.general.string = creativeAsset.videoPromptCN; showToast("已复制到剪贴板") },
                                onCopyEN: { UIPasteboard.general.string = creativeAsset.videoPromptEN; showToast("已复制到剪贴板") },
                                onCopyDirectional: { prompt in copyDirectionalPrompt(prompt) },
                                onRegenerate: { showRegenerateConfirmation = true },
                                onSave: {
                                    historyStore.save(product: product, diagnosis: diagnosis, directions: directions, creativeAsset: creativeAsset)
                                    showToast("已保存到历史")
                                }
                            )
                            .id("generated-assets")
                        }
                    }
                    .frame(width: max(0, geometry.size.width - 36), alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 36)
                }
                .background(StudioDesign.background)
            }
            .navigationTitle("商品档案")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("新链接") {
                        onBackToHome()
                    }
                    .foregroundColor(StudioDesign.ink)
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
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .alert("确认重新生成？", isPresented: $showRegenerateConfirmation) {
                Button("取消", role: .cancel) {}
                Button("重新生成", role: .destructive) {
                    Task {
                        await generateAssets(proxy: proxy)
                    }
                }
            } message: {
                Text("会替换当前已经生成的提示词，历史记录不会自动覆盖。")
            }
            .onAppear {
                selectedImageUrl = selectedImageUrl ?? galleryImages.first
                isDataSourceExpanded = product.extractionStatus.usedMockData
            }
        }
    }

    private var galleryImages: [String] {
        var urls: [String] = []
        if let cover = product.coverImageUrl, !cover.isEmpty {
            urls.append(cover)
        }
        urls.append(contentsOf: product.imageUrls)
        return Array(NSOrderedSet(array: urls)).compactMap { $0 as? String }
    }

    private var hero: some View {
        AsyncImage(url: URL(string: selectedImageUrl ?? galleryImages.first ?? "")) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            default:
                ZStack {
                    Color.white.opacity(0.62)
                    Image(systemName: "photo")
                        .font(.largeTitle)
                        .foregroundColor(StudioDesign.muted)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 360)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(alignment: .topLeading) {
            Text(product.platform)
                .font(.caption.weight(.bold))
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.black.opacity(0.62))
                .clipShape(Capsule())
                .padding(14)
        }
        .animation(.easeInOut(duration: 0.2), value: selectedImageUrl)
    }

    private var generationStatus: some View {
        HStack(spacing: 10) {
            ProgressView()
                .tint(StudioDesign.purple)
            Text("正在生成")
                .font(.footnote.weight(.semibold))
                .foregroundColor(StudioDesign.ink)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(Color.white.opacity(0.62))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(StudioDesign.line))
    }

    private var analysisActionCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "AI 商品诊断", subtitle: "商品档案已载入，点击后再基于当前商品数据生成诊断和创意方向")
            Text("为了避免用演示数据提前生成诊断，当前页面不会自动调用模型。请确认商品标题、图片、价格和参数无误后，再开始诊断。")
                .font(.subheadline)
                .foregroundColor(StudioDesign.muted)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
            PrimaryButton(title: "生成商品诊断", isLoading: isAnalyzing, isDisabled: isAnalyzing) {
                Task {
                    await analyzeIfNeeded()
                }
            }
        }
        .studioCard()
    }

    private var imageRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(galleryImages, id: \.self) { rawURL in
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            selectedImageUrl = rawURL
                        }
                    } label: {
                        AsyncImage(url: URL(string: rawURL)) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFill()
                            default:
                                ZStack {
                                    Color.white.opacity(0.6)
                                    Image(systemName: "photo")
                                        .font(.caption)
                                        .foregroundColor(StudioDesign.muted)
                                }
                            }
                        }
                        .frame(width: 82, height: 98)
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .stroke(selectedImageUrl == rawURL ? StudioDesign.ink : StudioDesign.line, lineWidth: selectedImageUrl == rawURL ? 2 : 1)
                        )
                        .opacity(selectedImageUrl == rawURL ? 1 : 0.78)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(product.title)
                .font(.title2.weight(.bold))
                .foregroundColor(StudioDesign.ink)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline) {
                    Text(product.price ?? "价格待确认")
                        .font(.title3.weight(.bold))
                        .layoutPriority(1)
                    Spacer(minLength: 12)
                    Text(product.shopName ?? product.companyName ?? "店铺信息待确认")
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                        .lineLimit(2)
                        .multilineTextAlignment(.trailing)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(product.price ?? "价格待确认")
                        .font(.title3.weight(.bold))
                    Text(product.shopName ?? product.companyName ?? "店铺信息待确认")
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .studioCard()
    }

    private var tags: some View {
        TagFlowLayout(horizontalSpacing: 7, verticalSpacing: 8) {
            ForEach(product.tags, id: \.self) { tag in
                Chip(text: tag)
            }
        }
        .padding(.top, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var basicArchive: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "商品基础档案")
            archiveRow("平台", product.platform)
            archiveRow("店铺 / 公司", product.companyName ?? product.shopName)
            archiveRow("价格区间", product.price)
            archiveRow("起批量", product.minOrderQuantity)
            archiveRow("类目", product.categoryText)
            archiveRow("发货地", product.locationText)
            archiveRow("商品 ID", product.platformProductId)
            archiveRow("提取时间", product.extractedAt.formatted(date: .numeric, time: .shortened))
            if let message = product.extractionStatus.message {
                Text(message)
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .studioCard()
    }

    private func archiveRow(_ name: String, _ value: String?) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(name)
                .font(.subheadline.weight(.semibold))
                .frame(width: 88, alignment: .leading)
            Text(value?.isEmpty == false ? value! : "暂未提取")
                .font(.subheadline)
                .foregroundColor(StudioDesign.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var facts: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "商品属性与镜头表现重点", subtitle: "用于判断商品质感、结构、使用方式和镜头呈现重点")
            ForEach(product.productFacts) { fact in
                HStack(alignment: .top, spacing: 12) {
                    Text(fact.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(StudioDesign.ink)
                        .frame(width: 82, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(fact.value)
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if fact.id != product.productFacts.last?.id {
                    Divider().overlay(StudioDesign.line)
                }
            }
        }
        .studioCard()
    }

    private var reviews: some View {
        DisclosureGroup {
            if !product.extractionStatus.commentsAvailable {
                VStack(alignment: .leading, spacing: 8) {
                    Text("当前页面未提供可直接读取的评论数据")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(StudioDesign.ink)
                    Text("采购洞察基于商品标题、图片、价格、参数和公开详情信息生成，未使用真实用户评论。")
                        .font(.footnote)
                        .foregroundColor(StudioDesign.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("暂无可用评论")
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                        .padding(.top, 4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else if product.reviews.isEmpty {
                Text("暂无可用评论")
                    .font(.subheadline)
                    .foregroundColor(StudioDesign.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(Array(product.reviews.prefix(10))) { review in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text(review.username ?? "匿名用户")
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                            Spacer()
                            Text([review.rating.map { "\($0) 星" }, review.dateText].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption)
                                .foregroundColor(StudioDesign.muted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                        Text(review.content)
                            .font(.subheadline)
                            .foregroundColor(StudioDesign.muted)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 4)
                }
            }
        } label: {
            SectionTitle(title: "原始评论", subtitle: product.reviews.isEmpty ? nil : "从页面读取的评论，最多展示 10 条")
        }
        .tint(StudioDesign.ink)
        .padding(18)
        .background(StudioDesign.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(StudioDesign.line))
        .shadow(color: Color.black.opacity(0.055), radius: 18, x: 0, y: 10)
    }

    private func bulletCard(title: String, subtitle: String? = nil, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: title, subtitle: subtitle)
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 10) {
                    Circle()
                        .fill(StudioDesign.purple)
                        .frame(width: 6, height: 6)
                        .padding(.top, 7)
                    Text(item)
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .studioCard()
    }

    private func analyzeIfNeeded() async {
        guard diagnosis == nil, directions.isEmpty, !isAnalyzing else { return }
        isAnalyzing = true
        errorMessage = nil
        do {
            let result = try await apiClient.analyzeProduct(product: product)
            category = result.0
            diagnosis = result.1
            directions = result.2
        } catch {
            errorMessage = error.localizedDescription
        }
        isAnalyzing = false
    }

    private func generateAssets(proxy: ScrollViewProxy) async {
        guard isAnalysisReady else {
            showToast("商品分析完成后即可生成")
            return
        }
        guard !isGenerating else { return }
        isGenerating = true
        errorMessage = nil
        do {
            let result = try await apiClient.generateCreativeAssets(product: product, category: category, diagnosis: diagnosis, directions: directions)
            creativeAsset = result
            isGenerating = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                withAnimation(.easeInOut(duration: 0.35)) {
                    proxy.scrollTo("generated-assets", anchor: .top)
                }
            }
        } catch {
            isGenerating = false
            errorMessage = error.localizedDescription
        }
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
