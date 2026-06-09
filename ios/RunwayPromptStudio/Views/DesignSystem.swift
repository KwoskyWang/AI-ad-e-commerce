import SwiftUI

enum StudioDesign {
    static let background = Color(red: 0.961, green: 0.945, blue: 0.918)
    static let ink = Color(red: 0.055, green: 0.052, blue: 0.048)
    static let muted = Color(red: 0.42, green: 0.40, blue: 0.37)
    static let card = Color.white.opacity(0.78)
    static let line = Color.black.opacity(0.08)
    static let purple = Color(red: 0.42, green: 0.20, blue: 1.0)
}

struct StudioCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(StudioDesign.card)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(StudioDesign.line, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.055), radius: 18, x: 0, y: 10)
    }
}

extension View {
    func studioCard() -> some View {
        modifier(StudioCard())
    }
}

struct PrimaryButton: View {
    let title: String
    var isLoading = false
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                }
                Text(title)
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.86)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundColor(.white)
            .background(
                LinearGradient(
                    colors: isDisabled ? [Color.gray, Color.gray] : [StudioDesign.ink, Color(red: 0.11, green: 0.08, blue: 0.17)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .disabled(isDisabled || isLoading)
        .opacity(isDisabled ? 0.58 : 1)
    }
}

struct Chip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundColor(StudioDesign.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.86)
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(Color.white.opacity(0.72))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(StudioDesign.line))
    }
}

struct SectionTitle: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title3.weight(.semibold))
                    .foregroundColor(StudioDesign.ink)
                    .fixedSize(horizontal: false, vertical: true)
            if let subtitle {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct TagFlowLayout: Layout {
    var horizontalSpacing: CGFloat = 8
    var verticalSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? subviews.reduce(CGFloat.zero) { partial, subview in
            partial + subview.sizeThatFits(.unspecified).width + horizontalSpacing
        }

        var currentX: CGFloat = 0
        var currentRowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX > 0 && currentX + size.width > maxWidth {
                totalHeight += currentRowHeight + verticalSpacing
                currentX = 0
                currentRowHeight = 0
            }

            currentX += size.width + horizontalSpacing
            currentRowHeight = max(currentRowHeight, size.height)
        }

        totalHeight += currentRowHeight
        return CGSize(width: maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX = bounds.minX
        var currentY = bounds.minY
        var currentRowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX > bounds.minX && currentX + size.width > bounds.maxX {
                currentX = bounds.minX
                currentY += currentRowHeight + verticalSpacing
                currentRowHeight = 0
            }

            subview.place(
                at: CGPoint(x: currentX, y: currentY),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )

            currentX += size.width + horizontalSpacing
            currentRowHeight = max(currentRowHeight, size.height)
        }
    }
}
