import SwiftUI
import UIKit
import Photos
import AVKit
import UserNotifications

struct HomeView: View {
    let apiClient: APIClient
    @Environment(\.scenePhase) private var scenePhase

    @State private var frontImage: UIImage?
    @State private var backImage: UIImage?
    @State private var generationResponse: GenerateThreeViewSetsResponse?
    @State private var preparedResponse: PreparedGarmentVideoPromptResponse?
    @State private var finalVideoPrompt: GeneratedVideoPromptResponse?
    @State private var generatedVideo: GeneratedSeedanceVideoResponse?
    @State private var phase: GarmentWorkflowPhase = .upload
    @State private var errorMessage: String?
    @State private var statusText: String?
    @State private var videoGenerationMessage: String?
    @State private var toastMessage: String?
    @State private var quota: VideoQuota?
    @State private var completionAlertMessage: String?
    @State private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid
    @AppStorage("activeGarmentSessionId") private var activeGarmentSessionId = ""
    @AppStorage("activeSeedanceTaskId") private var activeSeedanceTaskId = ""
    @AppStorage("savedSeedanceTaskIds") private var savedSeedanceTaskIds = ""

    private var deviceId: String { DeviceIdentifier.current() }

    var body: some View {
        ZStack {
            StudioDesign.background.ignoresSafeArea()
            switch phase {
            case .upload:
                GarmentPhotoUploadView(
                    frontImage: $frontImage,
                    backImage: $backImage,
                    statusText: statusText,
                    errorMessage: errorMessage,
                    onGenerate: { Task { await generateThreeViews() } }
                )
            case .selectThreeView:
                if let generationResponse {
                    ThreeViewSetSelectionView(
                        response: generationResponse,
                        isPreparing: statusText != nil,
                        errorMessage: errorMessage,
                        onBack: { phase = .upload },
                        onSelect: { set in Task { await preparePrompts(selectedSet: set) } }
                    )
                }
            case .result:
                if let preparedResponse {
                    GarmentVideoPromptResultView(
                        response: preparedResponse,
                        finalPrompt: finalVideoPrompt,
                        generatedVideo: generatedVideo,
                        isGeneratingVideo: isGeneratingVideo,
                        videoGenerationMessage: videoGenerationMessage,
                        onCopy: { text in copy(text) },
                        onGenerateVideo: { Task { await generatePromptAndVideo() } },
                        onReselect: { reset() },
                        onHome: { reset() }
                    )
                }
            }

            if let toastMessage {
                VStack {
                    Spacer()
                    Text(toastMessage)
                        .font(.footnote.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(StudioDesign.ink.opacity(0.92))
                        .clipShape(Capsule())
                        .padding(.bottom, 18)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if let statusText {
                VStack {
                    Spacer()
                    GenerationProgressOverlay(title: statusText, subtitle: progressSubtitle(for: statusText))
                        .padding(.horizontal, 18)
                        .padding(.bottom, 88)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            VStack {
                if let quota {
                    VideoQuotaBanner(quota: quota)
                        .padding(.horizontal, 14)
                        .padding(.top, 8)
                }
                Spacer()
            }
        }
        .task {
            await refreshQuota()
            await resumePendingWorkIfNeeded(showAlert: true)
        }
        .onChange(of: scenePhase) { newValue in
            if newValue == .active {
                Task {
                    await refreshQuota()
                    await resumePendingWorkIfNeeded(showAlert: true)
                }
            }
        }
        .alert("任务完成", isPresented: Binding(
            get: { completionAlertMessage != nil },
            set: { if !$0 { completionAlertMessage = nil } }
        )) {
            Button("知道了", role: .cancel) { completionAlertMessage = nil }
        } message: {
            Text(completionAlertMessage ?? "")
        }
        .onChange(of: isGeneratingVideo || statusText != nil) { isBusy in
            updateLongRunningWorkState(isBusy)
        }
    }

    private func generateThreeViews() async {
        guard let frontImage else {
            errorMessage = "请先上传衣服正面照。"
            return
        }
        guard let backImage else {
            errorMessage = "请先上传衣服反面照。"
            return
        }
        errorMessage = nil
        statusText = "正在上传照片"
        updateLongRunningWorkState(true)
        do {
            let task = try await apiClient.startGarmentMaterialTask(frontImage: frontImage, backImage: backImage, deviceId: deviceId)
            activeGarmentSessionId = task.sessionId
            statusText = "正在分析衣服款式与生成三视图"
            let readyTask = try await waitForMaterialTask(sessionId: task.sessionId)
            applyMaterialTask(readyTask, shouldSaveImages: true)
            finalVideoPrompt = nil
            generatedVideo = nil
            videoGenerationMessage = nil
            phase = .result
        } catch {
            errorMessage = error.localizedDescription
        }
        statusText = nil
        updateLongRunningWorkState(false)
    }

    private func preparePrompts(selectedSet: ThreeViewSet) async {
        guard let sessionId = generationResponse?.sessionId else { return }
        errorMessage = nil
        statusText = "正在生成视频提示词"
        updateLongRunningWorkState(true)
        do {
            preparedResponse = try await apiClient.prepareGarmentVideoPrompts(sessionId: sessionId, selectedSetId: selectedSet.id)
            finalVideoPrompt = nil
            generatedVideo = nil
            videoGenerationMessage = nil
            phase = .result
        } catch {
            errorMessage = error.localizedDescription
        }
        statusText = nil
        updateLongRunningWorkState(false)
    }

    private func generateFinalVideoPrompt() async throws {
        guard let response = preparedResponse else { return }
        errorMessage = nil
        statusText = "正在生成视频提示词"
        finalVideoPrompt = try await apiClient.generateFinalGarmentVideoPrompt(sessionId: response.sessionId, selectedSetId: response.selectedSet.id)
        generatedVideo = nil
        videoGenerationMessage = nil
    }

    private func generatePromptAndVideo() async {
        guard preparedResponse != nil else { return }
        do {
            if quota?.remaining == 0 {
                errorMessage = "今日视频生成次数已用完，明天 00:00 后刷新。"
                return
            }
            await generateSeedanceVideo()
        } catch {
            errorMessage = error.localizedDescription
            statusText = nil
        }
    }

    private func generateSeedanceVideo() async {
        guard let response = preparedResponse else { return }
        errorMessage = nil
        videoGenerationMessage = nil
        statusText = "正在提交视频任务"
        updateLongRunningWorkState(true)
        do {
            let started = try await apiClient.startAsyncGarmentVideoTask(sessionId: response.sessionId, selectedSetId: response.selectedSet.id, deviceId: deviceId)
            activeGarmentSessionId = response.sessionId
            activeSeedanceTaskId = started.seedanceTaskId ?? ""
            videoGenerationMessage = "视频任务已提交，可以切换到其他 App，晚点再回来检查视频结果。"
            showToast("视频任务已提交，正在生成。")
            statusText = "视频生成中"

            var pollCount = 0
            while !Task.isCancelled {
                try await Task.sleep(nanoseconds: 8_000_000_000)
                pollCount += 1
                do {
                    let task = try await apiClient.fetchGarmentTask(sessionId: started.sessionId)
                    applyVideoTask(task, pollCount: pollCount, showAlert: true)
                    if task.status == "completed" || task.status == "failed" {
                        break
                    }
                } catch {
                    videoGenerationMessage = "视频仍在生成中，刚才查询进度遇到网络波动，稍后会继续自动查询。"
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        statusText = nil
        updateLongRunningWorkState(false)
    }

    private var isGeneratingVideo: Bool {
        statusText == "正在生成视频提示词" || statusText == "正在提交视频任务" || statusText == "视频生成中"
    }

    private func seedanceProgressMessage(status: String, pollCount: Int) -> String {
        let minutes = max(1, pollCount * 8 / 60)
        if status.lowercased() == "unknown" {
            return "视频正在生成中，可以切换到其他 App，晚点再回来检查视频结果。已持续查询约 \(minutes) 分钟。"
        }
        return "视频正在生成中，当前状态：\(status)。可以切换到其他 App，晚点再回来检查视频结果。已持续查询约 \(minutes) 分钟。"
    }

    private func waitForMaterialTask(sessionId: String) async throws -> GarmentTaskSummary {
        var pollCount = 0
        while !Task.isCancelled {
            try await Task.sleep(nanoseconds: 8_000_000_000)
            pollCount += 1
            let task = try await apiClient.fetchGarmentTask(sessionId: sessionId)
            statusText = task.currentStage == "video_reference_generation" ? "正在生成视频参考图" : "正在分析衣服款式与生成三视图"
            videoGenerationMessage = task.progressMessage
            if task.status == "ready_for_video" || task.status == "video_processing" || task.status == "completed" {
                return task
            }
            if task.status == "failed" {
                throw APIError.serverMessage(task.errorMessage ?? "素材生成失败，请重新上传照片。")
            }
            if pollCount > 120 {
                throw APIError.serverMessage("生成时间较长，请稍后到历史记录查看结果。")
            }
        }
        throw APIError.serverMessage("生成被中断，请稍后到历史记录查看结果。")
    }

    private func applyMaterialTask(_ task: GarmentTaskSummary, shouldSaveImages: Bool) {
        guard
            let analysis = task.garmentAnalysis,
            let generationStatus = task.generationStatus,
            let selectedSet = task.selectedSet,
            let modelAsset = task.modelAsset,
            let background = task.background,
            let videoReferenceImageUrl = task.videoReferenceImageUrl,
            let videoReferenceStatus = task.videoReferenceGenerationStatus
        else {
            errorMessage = task.errorMessage ?? "素材还在生成中，请稍后到历史记录查看。"
            return
        }
        let generatedResponse = GenerateThreeViewSetsResponse(
            sessionId: task.sessionId,
            garmentAnalysis: analysis,
            sets: task.sets,
            generationStatus: generationStatus
        )
        let prepared = PreparedGarmentVideoPromptResponse(
            sessionId: task.sessionId,
            garmentAnalysis: analysis,
            selectedSet: selectedSet,
            modelAsset: modelAsset,
            background: background,
            videoReferenceImageUrl: videoReferenceImageUrl,
            videoReferenceGenerationStatus: videoReferenceStatus,
            createdAt: task.createdAt
        )
        generationResponse = generatedResponse
        preparedResponse = prepared
        if let prompt = task.finalVideoPrompt {
            finalVideoPrompt = GeneratedVideoPromptResponse(sessionId: task.sessionId, prompt: prompt, createdAt: task.updatedAt)
        }
        if let videoUrl = task.generatedVideoUrl {
            generatedVideo = GeneratedSeedanceVideoResponse(sessionId: task.sessionId, taskId: task.seedanceTaskId ?? task.sessionId, videoUrl: videoUrl, createdAt: task.completedAt ?? task.updatedAt)
        }
        activeGarmentSessionId = task.sessionId
        phase = .result
        if shouldSaveImages {
            Task { await saveGeneratedThreeViewToAlbum(generatedResponse) }
            Task { await saveImageURLToAlbum(videoReferenceImageUrl, successMessage: "视频参考图已自动保存到手机相册。", failureMessage: "视频参考图保存失败，请稍后重试。") }
        }
    }

    private func applyVideoTask(_ task: GarmentTaskSummary, pollCount: Int, showAlert: Bool) {
        if let prompt = task.finalVideoPrompt {
            finalVideoPrompt = GeneratedVideoPromptResponse(sessionId: task.sessionId, prompt: prompt, createdAt: task.updatedAt)
        }
        if task.status == "completed", let videoUrl = task.generatedVideoUrl {
            let taskId = task.seedanceTaskId ?? task.sessionId
            generatedVideo = GeneratedSeedanceVideoResponse(sessionId: task.sessionId, taskId: taskId, videoUrl: videoUrl, createdAt: task.completedAt ?? task.updatedAt)
            videoGenerationMessage = nil
            activeSeedanceTaskId = ""
            Task {
                let didSave = await saveVideoURLToAlbumIfNeeded(videoUrl, taskId: taskId)
                await refreshQuota()
                if showAlert {
                    notifyCompletion(didSave ? "视频已生成，并已自动保存到手机相册。" : "视频已生成，视频已经保存过。")
                }
            }
        } else if task.status == "failed" {
            errorMessage = task.errorMessage ?? "视频生成失败，请稍后重试。"
            videoGenerationMessage = nil
        } else {
            videoGenerationMessage = task.progressMessage ?? seedanceProgressMessage(status: task.status, pollCount: pollCount)
        }
    }

    private func refreshQuota() async {
        do {
            quota = try await apiClient.fetchVideoQuota(deviceId: deviceId)
        } catch {
            // Quota display should not block the creative workflow.
        }
    }

    private func resumePendingWorkIfNeeded(showAlert: Bool) async {
        guard !activeGarmentSessionId.isEmpty else { return }
        do {
            let task = try await apiClient.fetchGarmentTask(sessionId: activeGarmentSessionId)
            if task.videoReferenceImageUrl != nil {
                applyMaterialTask(task, shouldSaveImages: false)
            }
            if task.status == "completed" || task.status == "video_processing" || task.status == "failed" {
                applyVideoTask(task, pollCount: 1, showAlert: showAlert)
            } else if task.isInProgress {
                videoGenerationMessage = task.progressMessage
            }
        } catch {
            // Resume is opportunistic; keep the current screen usable.
        }
    }

    private func seedanceFailureMessage(_ status: SeedanceVideoTaskStatusResponse) -> String {
        if let message = status.failureMessage, !message.isEmpty {
            return "视频生成失败：\(message)"
        }
        if let code = status.failureCode, !code.isEmpty {
            return "视频生成失败：\(code)"
        }
        return "视频生成失败，请稍后重试。"
    }

    private func copy(_ text: String) {
        UIPasteboard.general.string = text
        withAnimation { toastMessage = "已复制，可以粘贴到视频生成工具。" }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation { toastMessage = nil }
        }
    }

    private func saveGeneratedThreeViewToAlbum(_ response: GenerateThreeViewSetsResponse) async {
        guard let set = response.sets.first else { return }
        let imageURLString = set.threeViewImageUrl ?? set.frontViewUrl
        await saveImageURLToAlbum(imageURLString, successMessage: "三视图已自动保存到手机相册。", failureMessage: "三视图保存失败，请稍后重试。")
    }

    private func saveImageURLToAlbum(_ imageURLString: String, successMessage: String, failureMessage: String) async {
        guard let url = URL(string: imageURLString) else { return }
        do {
            let status = await requestPhotoAddPermission()
            guard status == .authorized || status == .limited else {
                showToast("未获得相册权限，素材未保存。")
                return
            }

            let (data, _) = try await URLSession.shared.data(from: url)
            guard let image = UIImage(data: data) else {
                showToast(failureMessage)
                return
            }

            try await saveImageToPhotoLibrary(image)
            showToast(successMessage)
        } catch {
            showToast(failureMessage)
        }
    }

    private func saveVideoURLToAlbum(_ videoURLString: String) async {
        guard let url = URL(string: videoURLString) else { return }
        do {
            let status = await requestPhotoAddPermission()
            guard status == .authorized || status == .limited else {
                showToast("未获得相册权限，视频未保存。")
                return
            }
            let (downloadURL, _) = try await URLSession.shared.download(from: url)
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("seedance-\(UUID().uuidString).mp4")
            try FileManager.default.moveItem(at: downloadURL, to: tempURL)
            try await saveVideoToPhotoLibrary(tempURL)
            showToast("视频已自动保存到手机相册。")
        } catch {
            showToast("视频保存失败，请稍后重试。")
        }
    }

    @discardableResult
    private func saveVideoURLToAlbumIfNeeded(_ videoURLString: String, taskId: String) async -> Bool {
        guard !hasSavedVideo(taskId: taskId) else { return false }
        await saveVideoURLToAlbum(videoURLString)
        markVideoSaved(taskId: taskId)
        return true
    }

    private func requestPhotoAddPermission() async -> PHAuthorizationStatus {
        await withCheckedContinuation { continuation in
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                continuation.resume(returning: status)
            }
        }
    }

    private func saveImageToPhotoLibrary(_ image: UIImage) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            } completionHandler: { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: NSError(domain: "RunwayPromptStudio", code: -1))
                }
            }
        }
    }

    private func saveVideoToPhotoLibrary(_ fileURL: URL) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: fileURL)
            } completionHandler: { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: NSError(domain: "RunwayPromptStudio", code: -2))
                }
            }
        }
    }

    private func showToast(_ message: String) {
        Task { @MainActor in
            withAnimation { toastMessage = message }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                withAnimation { toastMessage = nil }
            }
        }
    }

    private func notifyCompletion(_ message: String) {
        Task { @MainActor in
            completionAlertMessage = message
        }
        let content = UNMutableNotificationContent()
        content.title = "视频已生成"
        content.body = "可以回到 App 查看并保存结果。"
        content.sound = .default
        let request = UNNotificationRequest(identifier: "video-complete-\(UUID().uuidString)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    private func updateLongRunningWorkState(_ isBusy: Bool) {
        UIApplication.shared.isIdleTimerDisabled = isBusy
        if isBusy {
            beginBackgroundTaskIfNeeded()
        } else {
            endBackgroundTaskIfNeeded()
        }
    }

    private func beginBackgroundTaskIfNeeded() {
        guard backgroundTaskId == .invalid else { return }
        backgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: "RunwayPromptStudioLongRunningWork") {
            endBackgroundTaskIfNeeded()
        }
    }

    private func endBackgroundTaskIfNeeded() {
        guard backgroundTaskId != .invalid else { return }
        let taskId = backgroundTaskId
        backgroundTaskId = .invalid
        UIApplication.shared.endBackgroundTask(taskId)
    }

    private func hasSavedVideo(taskId: String) -> Bool {
        Set(savedSeedanceTaskIds.split(separator: ",").map(String.init)).contains(taskId)
    }

    private func markVideoSaved(taskId: String) {
        var ids = savedSeedanceTaskIds.split(separator: ",").map(String.init)
        guard !ids.contains(taskId) else { return }
        ids.append(taskId)
        savedSeedanceTaskIds = ids.suffix(50).joined(separator: ",")
    }

    private func reset() {
        frontImage = nil
        backImage = nil
        generationResponse = nil
        preparedResponse = nil
        finalVideoPrompt = nil
        generatedVideo = nil
        videoGenerationMessage = nil
        errorMessage = nil
        statusText = nil
        phase = .upload
    }

    private func progressSubtitle(for status: String) -> String {
        switch status {
        case "正在上传照片":
            return "正在把正面照和反面照发送到创意服务。"
        case "正在分析衣服款式与生成三视图":
            return "AI 会先识别款式并生成标准三视图，整体可能需要几分钟。可以切换到其他 App，晚点回来继续查看结果。"
        case "正在生成视频参考图":
            return "正在随机匹配模特和背景，并生成可用于视频生成的参考图。可以切换到其他 App，晚点回来检查结果。"
        case "正在生成视频提示词":
            return "正在根据服装三视图和视频参考图优化最终视频提示词。"
        case "正在提交视频任务":
            return "正在上传素材到对象存储并提交 Seedance 任务，提交完成后会持续查询进度。"
        case "视频生成中":
            return videoGenerationMessage ?? "Seedance 正在生成视频，时间可能较长，页面会持续查询直到拿到视频。"
        default:
            return "正在处理，请稍候。"
        }
    }
}

enum GarmentWorkflowPhase {
    case upload
    case selectThreeView
    case result
}

struct GarmentPhotoUploadView: View {
    @Binding var frontImage: UIImage?
    @Binding var backImage: UIImage?
    let statusText: String?
    let errorMessage: String?
    let onGenerate: () -> Void

    private var canGenerate: Bool { frontImage != nil && backImage != nil && statusText == nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Runway Prompt Studio")
                        .font(.system(size: 25, weight: .bold))
                        .foregroundColor(StudioDesign.ink)
                    Text("拍两张衣服照，生成视频提示词")
                        .font(.title2.weight(.semibold))
                        .foregroundColor(StudioDesign.ink)
                    Text("上传正面和反面，自动生成三视图、搭配背景，并输出可直接复制的视频创作提示词。")
                        .font(.body)
                        .foregroundColor(StudioDesign.muted)
                        .lineSpacing(4)
                }
                .padding(.top, 28)

                VStack(spacing: 16) {
                    PhotoPickerCard(
                        title: "上传正面照",
                        hint: "请拍清楚衣服正面，尽量平铺或挂拍，避免手和杂物遮挡。",
                        image: $frontImage
                    )
                    PhotoPickerCard(
                        title: "上传反面照",
                        hint: "请拍清楚衣服背面，尽量保持光线一致。",
                        image: $backImage
                    )
                }

                VStack(spacing: 10) {
                    PrimaryButton(
                        title: statusText ?? "生成三视图",
                        isLoading: statusText != nil,
                        isDisabled: !canGenerate
                    ) {
                        onGenerate()
                    }
                    if let statusText {
                        Text(statusText)
                            .font(.footnote.weight(.medium))
                            .foregroundColor(StudioDesign.muted)
                    } else if !canGenerate {
                        Text(frontImage == nil ? "请先上传衣服正面照。" : "请先上传衣服反面照。")
                            .font(.footnote)
                            .foregroundColor(StudioDesign.muted)
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundColor(.red.opacity(0.75))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .studioCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("AI CREATIVE WORKFLOW")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(StudioDesign.purple)
                    Text("把一件衣服，变成可直接生成视频的创意素材。")
                        .font(.body)
                        .foregroundColor(StudioDesign.muted)
                }
                .padding(.bottom, 36)
            }
            .padding(.horizontal, 20)
        }
    }
}

struct GenerationProgressOverlay: View {
    let title: String
    let subtitle: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ProgressView()
                .tint(StudioDesign.purple)
                .scaleEffect(1.08)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(StudioDesign.ink)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .background(Color.white.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(StudioDesign.purple.opacity(0.18)))
        .shadow(color: Color.black.opacity(0.12), radius: 24, x: 0, y: 12)
    }
}

struct PhotoPickerCard: View {
    let title: String
    let hint: String
    @Binding var image: UIImage?

    @State private var showSourceDialog = false
    @State private var showPicker = false
    @State private var sourceType: UIImagePickerController.SourceType = .photoLibrary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(StudioDesign.ink)
                    Text(hint)
                        .font(.footnote)
                        .foregroundColor(StudioDesign.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 10)
                if image != nil {
                    Button {
                        image = nil
                    } label: {
                        Image(systemName: "trash")
                            .foregroundColor(StudioDesign.muted)
                    }
                }
            }

            Button {
                showSourceDialog = true
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color.white.opacity(0.68))
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(StudioDesign.line))
                    if let image {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity)
                            .frame(height: 230)
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    } else {
                        VStack(spacing: 10) {
                            Image(systemName: "camera.viewfinder")
                                .font(.system(size: 34, weight: .medium))
                                .foregroundColor(StudioDesign.purple)
                            Text("拍照或从相册选择")
                                .font(.subheadline.weight(.medium))
                                .foregroundColor(StudioDesign.ink)
                        }
                        .frame(height: 230)
                    }
                }
            }
            .buttonStyle(.plain)

            if image != nil {
                Button("重新选择") { showSourceDialog = true }
                    .buttonStyle(SecondaryActionButtonStyle())
            }
        }
        .studioCard()
        .confirmationDialog("选择照片来源", isPresented: $showSourceDialog) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button("拍照") {
                    sourceType = .camera
                    showPicker = true
                }
            }
            Button("从相册选择") {
                sourceType = .photoLibrary
                showPicker = true
            }
            Button("取消", role: .cancel) {}
        }
        .sheet(isPresented: $showPicker) {
            ImagePicker(sourceType: sourceType, image: $image)
        }
    }
}

struct ImagePicker: UIViewControllerRepresentable {
    let sourceType: UIImagePickerController.SourceType
    @Binding var image: UIImage?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker
        init(_ parent: ImagePicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            parent.image = info[.originalImage] as? UIImage
            picker.dismiss(animated: true)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}

struct ThreeViewSetSelectionView: View {
    let response: GenerateThreeViewSetsResponse
    let isPreparing: Bool
    let errorMessage: String?
    let onBack: () -> Void
    let onSelect: (ThreeViewSet) -> Void

    @State private var selectedSet: ThreeViewSet?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Button("重新上传", action: onBack)
                        .foregroundColor(StudioDesign.ink)
                    Spacer()
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("标准三视图已生成")
                        .font(.title2.weight(.bold))
                        .foregroundColor(StudioDesign.ink)
                    Text("系统已生成 1 张标准电商三视图，可继续生成视频提示词。")
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                }

                GenerationStatusBanner(status: response.generationStatus)
                garmentAnalysisCard

                ForEach(response.sets) { set in
                    threeViewCard(set)
                }

                VStack(spacing: 10) {
                    PrimaryButton(
                        title: isPreparing ? "正在生成视频提示词" : "继续生成视频提示词",
                        isLoading: isPreparing,
                        isDisabled: selectedSet == nil || isPreparing
                    ) {
                        if let selectedSet { onSelect(selectedSet) }
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundColor(.red.opacity(0.75))
                    }
                }
                .studioCard()
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 18)
        }
        .onAppear {
            if selectedSet == nil {
                selectedSet = response.sets.first
            }
        }
    }

    private var garmentAnalysisCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle(title: "衣服识别结果", subtitle: "只展示商户看得懂的款式信息")
            infoRow("品类", response.garmentAnalysis.category)
            infoRow("款式", response.garmentAnalysis.style)
            infoRow("版型", response.garmentAnalysis.silhouette)
            infoRow("颜色", response.garmentAnalysis.color)
        }
        .studioCard()
    }

    private func infoRow(_ title: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(title).font(.footnote.weight(.semibold)).frame(width: 46, alignment: .leading)
            Text(value).font(.footnote).foregroundColor(StudioDesign.muted).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func threeViewCard(_ set: ThreeViewSet) -> some View {
        Button {
            selectedSet = set
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(set.title).font(.headline).foregroundColor(StudioDesign.ink)
                        Text(set.description).font(.footnote).foregroundColor(StudioDesign.muted)
                    }
                    Spacer()
                    Image(systemName: selectedSet?.id == set.id ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(selectedSet?.id == set.id ? StudioDesign.purple : StudioDesign.muted)
                }

                threeViewCompositeImage(set.threeViewImageUrl ?? set.frontViewUrl)
                TagFlowLayout(horizontalSpacing: 6, verticalSpacing: 7) {
                    ForEach(set.styleTags, id: \.self) { Chip(text: $0) }
                    if set.isMock { Chip(text: "Mock 演示") }
                }
            }
            .padding(14)
            .background(Color.white.opacity(selectedSet?.id == set.id ? 0.92 : 0.72))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(selectedSet?.id == set.id ? StudioDesign.purple.opacity(0.42) : StudioDesign.line))
        }
        .buttonStyle(.plain)
    }

    private func threeViewCompositeImage(_ url: String) -> some View {
        AsyncImage(url: URL(string: url)) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            default:
                Color.white.opacity(0.62).overlay(Image(systemName: "photo").foregroundColor(StudioDesign.muted))
            }
        }
        .frame(height: 190)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(alignment: .bottomLeading) {
            Text("正面 · 侧面 · 背面")
                .font(.caption.weight(.semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.black.opacity(0.56))
                .clipShape(Capsule())
                .padding(10)
        }
    }
}

struct GenerationStatusBanner: View {
    let status: GenerationStatus

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(status.usedMock ? Color.orange.opacity(0.72) : Color.green.opacity(0.72))
                .frame(width: 10, height: 10)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 4) {
                Text(status.usedMock ? "当前三视图为 Mock 演示结果" : "已使用真实 AI 生成")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(StudioDesign.ink)
                Text(status.message)
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(status.usedMock ? Color.orange.opacity(0.12) : Color.green.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(StudioDesign.line))
    }
}

struct VideoQuotaBanner: View {
    let quota: VideoQuota

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: quota.remaining > 0 ? "bolt.circle.fill" : "exclamationmark.circle.fill")
                .foregroundColor(quota.remaining > 0 ? StudioDesign.purple : .orange)
            Text(quota.remaining > 0 ? "今日可生成视频 \(quota.remaining)/\(quota.limit)" : "今日视频生成次数已用完，明天 00:00 后刷新")
                .font(.footnote.weight(.semibold))
                .foregroundColor(StudioDesign.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.86)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(StudioDesign.line))
        .shadow(color: Color.black.opacity(0.08), radius: 12, x: 0, y: 6)
    }
}

struct GarmentVideoPromptResultView: View {
    let response: PreparedGarmentVideoPromptResponse
    let finalPrompt: GeneratedVideoPromptResponse?
    let generatedVideo: GeneratedSeedanceVideoResponse?
    let isGeneratingVideo: Bool
    let videoGenerationMessage: String?
    let onCopy: (String) -> Void
    let onGenerateVideo: () -> Void
    let onReselect: () -> Void
    let onHome: () -> Void
    @State private var previewImageURL: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("视频生成素材一览")
                        .font(.title2.weight(.bold))
                        .foregroundColor(StudioDesign.ink)
                    Text("已准备服装三视图、模特参考、场景背景和视频参考图。")
                        .font(.subheadline)
                        .foregroundColor(StudioDesign.muted)
                }

                selectedSetSection
                modelSection
                backgroundSection
                videoReferenceSection

                if let finalPrompt {
                    finalPromptSection(finalPrompt.prompt)
                }
                if let generatedVideo {
                    generatedVideoSection(generatedVideo)
                } else if isGeneratingVideo || videoGenerationMessage != nil {
                    videoGenerationProgressSection
                }

                VStack(spacing: 10) {
                    PrimaryButton(
                        title: isGeneratingVideo ? "正在生成视频" : generatedVideo == nil ? "生成视频" : "重新生成视频",
                        isLoading: isGeneratingVideo,
                        isDisabled: isGeneratingVideo,
                        action: onGenerateVideo
                    )
                    Button("重新上传照片", action: onReselect).buttonStyle(SecondaryActionButtonStyle())
                    PrimaryButton(title: "回到首页", action: onHome)
                }
                .studioCard()
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 18)
        }
        .sheet(item: Binding(
            get: { previewImageURL.map(ImagePreviewItem.init(urlString:)) },
            set: { previewImageURL = $0?.urlString }
        )) { item in
            ImagePreviewSheet(urlString: item.urlString)
        }
    }

    private var selectedSetSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "已选择三视图", subtitle: response.selectedSet.isMock ? "当前三视图为 Mock 演示结果，图片生成服务暂时不可用，已使用上传图片生成演示流程。" : response.selectedSet.description)
            resultCompositeImage(response.selectedSet.threeViewImageUrl ?? response.selectedSet.frontViewUrl)
        }
        .studioCard()
    }

    private var backgroundSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "已自动匹配背景", subtitle: response.background.isFallback == true ? "未找到本地背景图，已使用默认背景。" : response.background.filename)
            previewImage(response.background.url, height: 180, label: "背景图")
        }
        .studioCard()
    }

    private var modelSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "已自动匹配模特", subtitle: response.modelAsset.filename)
            previewImage(response.modelAsset.url, height: 220, label: "模特参考图")
        }
        .studioCard()
    }

    private var videoReferenceSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "视频生成参考图", subtitle: response.videoReferenceGenerationStatus.message)
            previewImage(response.videoReferenceImageUrl, height: 260, label: response.videoReferenceGenerationStatus.usedMock ? "参考图生成失败，临时使用三视图" : "视频参考图")
        }
        .studioCard()
    }

    private func finalPromptSection(_ prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "视频生成提示词", subtitle: "复制后粘贴到视频生成工具中使用")
            Button("一键复制提示词") { onCopy(prompt) }
                .buttonStyle(SecondaryActionButtonStyle())
            Text(prompt)
                .font(.footnote)
                .foregroundColor(StudioDesign.muted)
                .lineSpacing(4)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .studioCard()
    }

    private func generatedVideoSection(_ video: GeneratedSeedanceVideoResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "视频已生成", subtitle: "已自动保存到手机相册")
            if let url = URL(string: video.videoUrl) {
                VideoPlayer(player: AVPlayer(url: url))
                    .frame(height: 260)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            Button("复制视频地址") { onCopy(video.videoUrl) }
                .buttonStyle(SecondaryActionButtonStyle())
        }
        .studioCard()
    }

    private var videoGenerationProgressSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "视频生成中", subtitle: "生成时间可能较长，页面会自动查询进度。")
            HStack(spacing: 10) {
                ProgressView()
                    .tint(StudioDesign.purple)
                Text(videoGenerationMessage ?? "Seedance 正在生成视频，拿到视频后会自动展示并保存到相册。")
                    .font(.footnote)
                    .foregroundColor(StudioDesign.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(StudioDesign.purple.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .studioCard()
    }

    private func resultCompositeImage(_ url: String) -> some View {
        previewImage(url, height: 230, label: "一张图包含：正面 · 侧面 · 背面")
    }

    private func previewImage(_ url: String, height: CGFloat, label: String) -> some View {
        Button {
            previewImageURL = url
        } label: {
            AsyncImage(url: URL(string: url)) { phase in
                switch phase {
                case .success(let image): image.resizable().scaledToFill()
                default: Color.white.opacity(0.62)
                }
            }
            .frame(height: height)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(alignment: .bottomLeading) {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.56))
                    .clipShape(Capsule())
                    .padding(10)
            }
        }
        .buttonStyle(.plain)
    }
}

struct ImagePreviewItem: Identifiable {
    let id = UUID()
    let urlString: String
}

struct ImagePreviewSheet: View {
    let urlString: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            AsyncImage(url: URL(string: urlString)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFit()
                default:
                    ProgressView().tint(.white)
                }
            }
            .padding(18)
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundColor(.white.opacity(0.9))
                    .padding(18)
            }
        }
    }
}

struct PromptCardView: View {
    let card: GarmentVideoPromptCard
    let onCopy: (String) -> Void
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: card.title, subtitle: card.shortDescription)
            HStack(spacing: 10) {
                Button("复制中文 Prompt") { onCopy(card.promptCN) }
                    .buttonStyle(SecondaryActionButtonStyle())
                Button("复制英文 Prompt") { onCopy(card.promptEN) }
                    .buttonStyle(SecondaryActionButtonStyle())
            }
            Button(expanded ? "收起完整 Prompt" : "查看完整 Prompt") {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            }
            .font(.footnote.weight(.semibold))
            .foregroundColor(StudioDesign.purple)

            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    promptText("中文 Prompt", card.promptCN)
                    promptText("English Prompt", card.promptEN)
                }
            }
        }
        .studioCard()
    }

    private func promptText(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.weight(.semibold)).foregroundColor(StudioDesign.purple)
            Text(value)
                .font(.footnote)
                .foregroundColor(StudioDesign.muted)
                .lineSpacing(4)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
