import SwiftUI

struct LoadingView: View {
    private let messages = ["正在读取 1688 商品页面", "正在提取商品图与详情信息", "正在整理商品视觉档案", "正在生成采购与创意洞察"]
    @State private var messageIndex = 0

    var body: some View {
        VStack(spacing: 26) {
            Spacer()

            VStack(spacing: 22) {
                ProgressView()
                    .scaleEffect(1.2)
                    .tint(StudioDesign.ink)

                VStack(spacing: 10) {
                    Text(messages[messageIndex])
                        .font(.title3.weight(.semibold))
                        .foregroundColor(StudioDesign.ink)

                    Text("把商品页面整理成可直接创作的 AI 广告资产")
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                        .multilineTextAlignment(.center)
                }
            }
            .studioCard()
            .padding(.horizontal, 26)

            Spacer()
        }
        .background(StudioDesign.background)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_150_000_000)
                messageIndex = (messageIndex + 1) % messages.count
            }
        }
    }
}
