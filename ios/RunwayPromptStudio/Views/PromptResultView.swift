import SwiftUI

struct PromptResultView: View {
    let product: ProductInfo
    let prompt: AdPromptResult
    let isSaved: Bool
    let onCopy: () -> Void
    let onRegenerate: () -> Void
    let onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text("AD PROMPT")
                    .font(.caption.weight(.bold))
                    .foregroundColor(StudioDesign.purple)
                Text(prompt.conceptTitle)
                    .font(.title2.weight(.bold))
                    .foregroundColor(StudioDesign.ink)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                Text(product.title)
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            promptBlock(title: "核心反差", body: prompt.coreContrast)
            promptBlock(title: "视觉风格", body: prompt.visualStyle)
            promptBlock(title: "视频生成 Prompt 中文版", body: prompt.promptCN)
            promptBlock(title: "Video Generation Prompt EN", body: prompt.promptEN)

            VStack(alignment: .leading, spacing: 10) {
                Text("镜头分镜")
                    .font(.headline)
                    .foregroundColor(StudioDesign.ink)
                ForEach(Array(prompt.shotList.enumerated()), id: \.offset) { index, shot in
                    HStack(alignment: .top, spacing: 10) {
                        Text(String(format: "%02d", index + 1))
                            .font(.caption.weight(.bold))
                            .foregroundColor(.white)
                            .frame(width: 28, height: 28)
                            .background(StudioDesign.ink)
                            .clipShape(Circle())
                        Text(shot)
                            .font(.subheadline)
                            .foregroundColor(StudioDesign.muted)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

            promptBlock(title: "Negative Prompt", body: prompt.negativePrompt)

            VStack(spacing: 10) {
                PrimaryButton(title: "复制 Prompt") {
                    onCopy()
                }

                ViewThatFits(in: .horizontal) {
                    secondaryActions(axis: .horizontal)
                    secondaryActions(axis: .vertical)
                }
            }
            .padding(.top, 2)
        }
        .studioCard()
    }

    private func promptBlock(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundColor(StudioDesign.ink)
            Text(body)
                .font(.subheadline)
                .foregroundColor(StudioDesign.muted)
                .lineSpacing(5)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func secondaryActions(axis: Axis) -> some View {
        let layout = axis == .horizontal ? AnyLayout(HStackLayout(spacing: 10)) : AnyLayout(VStackLayout(spacing: 10))

        return layout {
            Button(action: onRegenerate) {
                Label("重新生成", systemImage: "arrow.clockwise")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.86)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Color.white.opacity(0.66))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .foregroundColor(StudioDesign.ink)

            Button(action: onSave) {
                Label(isSaved ? "已保存" : "保存到历史", systemImage: isSaved ? "checkmark.circle.fill" : "tray.and.arrow.down")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.86)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(Color.white.opacity(0.66))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .disabled(isSaved)
            .foregroundColor(isSaved ? StudioDesign.muted : StudioDesign.ink)
        }
    }
}
