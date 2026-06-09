import SwiftUI

struct DataSourceBanner: View {
    let status: ExtractionStatus

    private var isMock: Bool { status.usedMockData }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: isMock ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .font(.title3)
                .foregroundColor(isMock ? Color(red: 0.55, green: 0.38, blue: 0.12) : Color(red: 0.24, green: 0.44, blue: 0.31))
                .padding(.top, 1)

            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(StudioDesign.ink)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
                if isMock, let message = status.message, !message.isEmpty {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(StudioDesign.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(isMock ? Color(red: 0.75, green: 0.61, blue: 0.34).opacity(0.35) : StudioDesign.line)
        )
    }

    private var title: String {
        status.usedMockData ? "当前显示的是 Mock 演示数据" : "已读取 1688 公开页面信息"
    }

    private var subtitle: String {
        if status.usedMockData && status.hasLoginOrCaptchaBlock {
            return "该 1688 页面需要登录或验证，当前 Demo 不会绕过平台限制，以下内容为 Mock 演示数据。"
        }
        if status.usedMockData {
            return "未能从该 1688 页面读取到足够的真实商品信息，以下内容用于演示完整 AI 创意链路。"
        }
        return "商品标题、图片、价格、店铺和部分参数来自当前 1688 页面。"
    }

    private var background: Color {
        status.usedMockData
            ? Color(red: 0.98, green: 0.91, blue: 0.76).opacity(0.72)
            : Color(red: 0.91, green: 0.95, blue: 0.90).opacity(0.72)
    }
}

struct DataSourceDisclosure: View {
    let status: ExtractionStatus
    @Binding var isExpanded: Bool

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            VStack(alignment: .leading, spacing: 12) {
                sourceRow("数据来源", sourceText)
                if !status.extractedFields.isEmpty {
                    chipBlock(title: "已提取字段", values: status.extractedFields.map(fieldName))
                }
                if !status.missingFields.isEmpty {
                    chipBlock(title: "未提取字段", values: status.missingFields.map(fieldName))
                }
                if let reason = status.mockReason, status.usedMockData {
                    sourceRow("Mock 原因", reason)
                }
                Text("当前 Demo 仅处理公开页面，不会绕过登录、验证码或平台限制。")
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 12)
        } label: {
            SectionTitle(title: "数据来源说明")
        }
        .tint(StudioDesign.ink)
        .padding(18)
        .background(StudioDesign.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(StudioDesign.line))
        .shadow(color: Color.black.opacity(0.055), radius: 18, x: 0, y: 10)
    }

    private var sourceText: String {
        switch status.source {
        case "real_1688_page":
            return "真实 1688 公开页面"
        case "mock_fallback":
            return "Mock 演示数据"
        case "partial_real_with_mock_enrichment":
            return "部分真实数据 + Mock 补全"
        case "manual_mock":
            return "手动演示数据"
        default:
            return status.usedMockData ? "Mock 演示数据" : "公开页面信息"
        }
    }

    private func sourceRow(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(StudioDesign.purple)
            Text(value)
                .font(.subheadline)
                .foregroundColor(StudioDesign.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func chipBlock(title: String, values: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(StudioDesign.purple)
            TagFlowLayout(horizontalSpacing: 7, verticalSpacing: 7) {
                ForEach(values, id: \.self) { Chip(text: $0) }
            }
        }
    }

    private func fieldName(_ value: String) -> String {
        switch value {
        case "title": return "标题"
        case "price": return "价格"
        case "images": return "图片"
        case "shopName": return "店铺/公司"
        case "productFacts": return "商品参数"
        case "rawDetailText": return "详情文本"
        case "reviews": return "评论"
        case "minOrderQuantity": return "起批量"
        case "categoryText": return "类目"
        default: return value
        }
    }
}

struct CategoryAnalysisSection: View {
    let category: CategoryAnalysis

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "品类识别", subtitle: "用于选择后续商品诊断与创意生成策略")
            field("一级品类", category.primaryCategory)
            field("细分品类", category.secondaryCategory)
            field("商品类型", category.productType)
            field("C 端使用场景", category.consumerScenario)
            field("B2B 采购场景", category.b2bProcurementScenario)
            chipGroup("视觉关键词", category.visualKeywords)
            chipGroup("材质/结构关键词", category.materialKeywords)
            if !category.riskNotes.isEmpty {
                bulletGroup(title: "信息风险提示", items: category.riskNotes)
            }
        }
        .studioCard()
    }

    private func field(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption.weight(.semibold)).foregroundColor(StudioDesign.purple)
            Text(value).font(.subheadline).foregroundColor(StudioDesign.muted).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func chipGroup(_ title: String, _ values: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.caption.weight(.semibold)).foregroundColor(StudioDesign.purple)
            TagFlowLayout(horizontalSpacing: 7, verticalSpacing: 8) {
                ForEach(values, id: \.self) { Chip(text: $0) }
            }
        }
    }

    private func bulletGroup(title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.caption.weight(.semibold)).foregroundColor(StudioDesign.purple)
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(StudioDesign.purple).frame(width: 6, height: 6).padding(.top, 7)
                    Text(item).font(.footnote).foregroundColor(StudioDesign.muted).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

struct CreativeAnalysisSection: View {
    let diagnosis: ProductDiagnosis?
    let product: ProductInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "AI 商品诊断", subtitle: "判断这个商品应该如何被包装、表达和创作")

            if let diagnosis {
                field("商品核心判断", diagnosis.coreJudgement)
                HStack(spacing: 4) {
                    Text("爆款潜力评分")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(String(repeating: "★", count: max(1, min(5, diagnosis.viralPotentialScore))))
                        .foregroundColor(StudioDesign.purple)
                }
                bulletGroup(title: "主要机会", items: diagnosis.mainOpportunities)
                bulletGroup(title: "主要短板", items: diagnosis.mainWeaknesses)
                bulletGroup(title: "视觉表达重点", items: diagnosis.visualFocus)
                bulletGroup(title: "内容传播钩子", items: diagnosis.contentHooks)
                TagFlowLayout(horizontalSpacing: 7, verticalSpacing: 8) {
                    ForEach(diagnosis.suitablePlatforms, id: \.self) { Chip(text: $0) }
                }
            } else {
                Text("正在生成商品诊断...")
                    .font(.subheadline)
                    .foregroundColor(StudioDesign.muted)
            }
        }
        .studioCard()
    }

    private func field(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundColor(StudioDesign.ink)
            Text(value).font(.subheadline).foregroundColor(StudioDesign.muted).lineSpacing(4)
        }
    }

    private func bulletGroup(title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.semibold))
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(StudioDesign.purple).frame(width: 6, height: 6).padding(.top, 7)
                    Text(item).font(.footnote).foregroundColor(StudioDesign.muted).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

struct CreativeDirectionSection: View {
    let directions: [CreativeDirection]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "创意调优方案")
            ForEach(directions) { direction in
                VStack(alignment: .leading, spacing: 9) {
                    Text(direction.name).font(.headline).foregroundColor(StudioDesign.ink)
                    directionField("目标人群", direction.targetAudience)
                    directionField("核心场景", direction.coreScene)
                    directionField("主视觉建议", direction.visualSuggestion)
                    directionField("视频钩子", direction.videoHook)
                    directionField("商品图优化建议", direction.imageOptimizationSuggestion)
                    Chip(text: direction.suitablePlatform)
                }
                .padding(14)
                .background(Color.white.opacity(0.54))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        .studioCard()
    }

    private func directionField(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.caption.weight(.semibold)).foregroundColor(StudioDesign.purple)
            Text(value).font(.footnote).foregroundColor(StudioDesign.muted).fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct GeneratedAssetsSection: View {
    let asset: CreativeAssetResult
    let isSaved: Bool
    let onCopyFull: () -> Void
    let onCopyCN: () -> Void
    let onCopyEN: () -> Void
    let onCopyDirectional: (DirectionalPromptAsset) -> Void
    let onRegenerate: () -> Void
    let onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionTitle(title: "生成的创意资产", subtitle: "AI 图像生成、AI 视频生成和短视频脚本可直接使用")
            Text(asset.conceptTitle).font(.title3.weight(.bold)).foregroundColor(StudioDesign.ink)
            promptBlock("核心反差", asset.coreContrast)
            promptBlock("生活方式定位", asset.lifestylePositioning)
            promptBlock("商品图改造 Prompt 中文", asset.imagePromptCN)
            promptBlock("Product Image Prompt EN", asset.imagePromptEN)
            promptBlock("5-10 秒视频 Prompt 中文", asset.videoPromptCN)
            promptBlock("5-10s Video Prompt EN", asset.videoPromptEN)
            shotList
            if !asset.directionalPrompts.isEmpty {
                directionalPromptList
            }
            promptBlock("Negative Prompt", asset.negativePrompt)
            buttons
        }
        .studioCard()
    }

    private var shotList: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("镜头分镜").font(.headline)
            ForEach(Array(asset.shotList.enumerated()), id: \.offset) { index, shot in
                HStack(alignment: .top, spacing: 10) {
                    Text(String(format: "%02d", index + 1))
                        .font(.caption.weight(.bold))
                        .foregroundColor(.white)
                        .frame(width: 30, height: 30)
                        .background(StudioDesign.ink)
                        .clipShape(Circle())
                    Text(shot).font(.subheadline).foregroundColor(StudioDesign.muted).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var directionalPromptList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("三套方向 Prompt").font(.headline).foregroundColor(StudioDesign.ink)
            ForEach(asset.directionalPrompts) { prompt in
                VStack(alignment: .leading, spacing: 10) {
                    Text(prompt.directionName)
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(StudioDesign.ink)
                    promptMiniBlock("创意标题", prompt.conceptTitle)
                    promptMiniBlock("核心反差", prompt.coreContrast)
                    promptMiniBlock("图片 Prompt 中文", prompt.imagePromptCN)
                    promptMiniBlock("Image Prompt EN", prompt.imagePromptEN)
                    promptMiniBlock("视频 Prompt 中文", prompt.videoPromptCN)
                    promptMiniBlock("Video Prompt EN", prompt.videoPromptEN)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("镜头分镜")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(StudioDesign.purple)
                        ForEach(Array(prompt.shotList.enumerated()), id: \.offset) { index, shot in
                            HStack(alignment: .top, spacing: 8) {
                                Text(String(format: "%02d", index + 1))
                                    .font(.caption2.weight(.bold))
                                    .foregroundColor(.white)
                                    .frame(width: 24, height: 24)
                                    .background(StudioDesign.ink)
                                    .clipShape(Circle())
                                Text(shot)
                                    .font(.footnote)
                                    .foregroundColor(StudioDesign.muted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    promptMiniBlock("Negative Prompt", prompt.negativePrompt)
                    Button {
                        onCopyDirectional(prompt)
                    } label: {
                        HStack(spacing: 7) {
                            Image(systemName: "doc.on.doc")
                            Text("复制这一套 Prompt")
                        }
                    }
                    .buttonStyle(SecondaryActionButtonStyle())
                    .padding(.top, 2)
                }
                .padding(14)
                .background(Color.white.opacity(0.54))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private var buttons: some View {
        VStack(spacing: 10) {
            PrimaryButton(title: "复制完整 Prompt", action: onCopyFull)
            Button("复制中文视频 Prompt", action: onCopyCN).buttonStyle(SecondaryActionButtonStyle())
            Button("复制英文视频 Prompt", action: onCopyEN).buttonStyle(SecondaryActionButtonStyle())
            HStack(spacing: 10) {
                Button("重新生成", action: onRegenerate).buttonStyle(SecondaryActionButtonStyle())
                Button(isSaved ? "已保存" : "保存", action: onSave).buttonStyle(SecondaryActionButtonStyle()).disabled(isSaved)
            }
        }
    }

    private func promptBlock(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.headline).foregroundColor(StudioDesign.ink)
            Text(value).font(.subheadline).foregroundColor(StudioDesign.muted).lineSpacing(5).textSelection(.enabled)
        }
    }

    private func promptMiniBlock(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption.weight(.semibold)).foregroundColor(StudioDesign.purple)
            Text(value).font(.footnote).foregroundColor(StudioDesign.muted).lineSpacing(4).textSelection(.enabled)
        }
    }
}

struct SecondaryActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(StudioDesign.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.white.opacity(configuration.isPressed ? 0.42 : 0.66))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
