import SwiftUI
import Photos
import UserNotifications

struct RootView: View {
    @StateObject private var historyStore = HistoryStore()
    private let apiClient = APIClient()

    var body: some View {
        TabView {
            CreationFlowView(apiClient: apiClient)
                .tabItem {
                    Label("创作", systemImage: "sparkles")
                }

            HistoryView()
                .tabItem {
                    Label("历史", systemImage: "clock")
                }
        }
        .environmentObject(historyStore)
        .tint(StudioDesign.ink)
        .onAppear {
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { _ in }
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        }
    }
}

struct CreationFlowView: View {
    let apiClient: APIClient

    var body: some View {
        NavigationStack {
            HomeView(apiClient: apiClient)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
