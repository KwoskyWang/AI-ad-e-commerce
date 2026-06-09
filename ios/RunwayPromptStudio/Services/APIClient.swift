import Foundation
import UIKit
import Security

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case serverMessage(String)
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "请输入有效的 http 或 https 商品链接。"
        case .invalidResponse:
            return "服务返回异常，请稍后再试。"
        case .serverMessage(let message):
            return message
        case .decodingFailed:
            return "数据解析失败，请检查服务端返回结构。"
        }
    }
}

struct APIClient {
    var baseURL: URL
    var fallbackBaseURLs: [URL]
    var usesMockFallback: Bool

    init(
        baseURL: URL = URL(string: "https://zuobin.wang")!,
        fallbackBaseURLs: [URL] = [],
        usesMockFallback: Bool = true
    ) {
        self.baseURL = baseURL
        self.fallbackBaseURLs = fallbackBaseURLs
        self.usesMockFallback = usesMockFallback
    }

    func extractProduct(url: String) async throws -> ProductInfo {
        try validate1688URL(url)

        do {
            return try await post(path: "/api/extract-1688-product", body: ["url": url])
        } catch {
            if case APIError.serverMessage = error {
                throw error
            }
            if let urlError = error as? URLError, urlError.code == .timedOut {
                throw APIError.serverMessage("创意分析服务响应超时，请稍后重试。")
            }
            if usesMockFallback && url == MockData.sampleURL {
                return MockData.product(sourceUrl: url)
            }
            if error is URLError {
                throw APIError.serverMessage("无法连接后端服务。请确认 server 已启动，并且 App 的 baseURL 指向正确地址。")
            }
            throw error
        }
    }

    func analyzeProduct(product: ProductInfo) async throws -> (CategoryAnalysis, ProductDiagnosis, [CreativeDirection]) {
        struct RequestBody: Encodable { let product: ProductInfo }
        struct ResponseBody: Decodable {
            let category: CategoryAnalysis?
            let diagnosis: ProductDiagnosis
            let directions: [CreativeDirection]
        }
        do {
            let response: ResponseBody = try await post(path: "/api/analyze-product", body: RequestBody(product: product))
            return (response.category ?? MockData.category(product: product), response.diagnosis, response.directions)
        } catch {
            if usesMockFallback {
                let analysis = MockData.analysis(product: product)
                return (MockData.category(product: product), analysis.0, analysis.1)
            }
            throw APIError.serverMessage("创意分析失败，请稍后重试")
        }
    }

    func generateCreativeAssets(product: ProductInfo, category: CategoryAnalysis?, diagnosis: ProductDiagnosis?, directions: [CreativeDirection]) async throws -> CreativeAssetResult {
        struct RequestBody: Encodable {
            let product: ProductInfo
            let category: CategoryAnalysis?
            let diagnosis: ProductDiagnosis?
            let directions: [CreativeDirection]
            let analysisMode: String
        }
        do {
            return try await post(
                path: "/api/generate-creative-assets",
                body: RequestBody(product: product, category: category, diagnosis: diagnosis, directions: directions, analysisMode: "1688_commerce_demo")
            )
        } catch {
            if usesMockFallback { return MockData.creativeAsset(product: product) }
            throw APIError.serverMessage("创意生成失败，请稍后重试")
        }
    }

    func generateAdPrompt(product: ProductInfo, styleMode: String? = "contrast") async throws -> AdPromptResult {
        struct RequestBody: Encodable {
            let product: ProductInfo
            let styleMode: String?
        }

        do {
            return try await post(path: "/api/generate-ad-prompt", body: RequestBody(product: product, styleMode: styleMode))
        } catch {
            if usesMockFallback { return MockData.prompt(product: product) }
            throw error
        }
    }

    func generateThreeViewSets(frontImage: UIImage, backImage: UIImage) async throws -> GenerateThreeViewSetsResponse {
        guard let frontData = frontImage.normalizedJPEGData(), let backData = backImage.normalizedJPEGData() else {
            throw APIError.serverMessage("照片上传失败，请重新选择或重新拍照。")
        }

        do {
            return try await postMultipart(
                path: "/api/garment/generate-three-view-sets",
                files: [
                    MultipartFile(fieldName: "frontImage", filename: "front.jpg", mimeType: "image/jpeg", data: frontData),
                    MultipartFile(fieldName: "backImage", filename: "back.jpg", mimeType: "image/jpeg", data: backData)
                ]
            )
        } catch {
            if let urlError = error as? URLError {
                throw APIError.serverMessage(Self.friendlyConnectionMessage(for: urlError))
            }
            throw error
        }
    }

    func startGarmentMaterialTask(frontImage: UIImage, backImage: UIImage, deviceId: String) async throws -> GarmentTaskSummary {
        guard let frontData = frontImage.normalizedJPEGData(), let backData = backImage.normalizedJPEGData() else {
            throw APIError.serverMessage("照片上传失败，请重新选择或重新拍照。")
        }
        do {
            return try await postMultipart(
                path: "/api/garment/material-tasks",
                queryItems: [URLQueryItem(name: "deviceId", value: deviceId)],
                files: [
                    MultipartFile(fieldName: "frontImage", filename: "front.jpg", mimeType: "image/jpeg", data: frontData),
                    MultipartFile(fieldName: "backImage", filename: "back.jpg", mimeType: "image/jpeg", data: backData)
                ]
            )
        } catch {
            if let urlError = error as? URLError {
                throw APIError.serverMessage(Self.friendlyConnectionMessage(for: urlError))
            }
            throw error
        }
    }

    func fetchGarmentTasks(deviceId: String) async throws -> GarmentTaskListResponse {
        try await get(path: "/api/garment/tasks", queryItems: [URLQueryItem(name: "deviceId", value: deviceId)])
    }

    func fetchGarmentTask(sessionId: String) async throws -> GarmentTaskSummary {
        try await get(path: "/api/garment/tasks/\(sessionId)", queryItems: [])
    }

    func startAsyncGarmentVideoTask(sessionId: String, selectedSetId: String, deviceId: String) async throws -> GarmentTaskSummary {
        struct RequestBody: Encodable {
            let selectedSetId: String
            let deviceId: String
        }
        return try await post(path: "/api/garment/tasks/\(sessionId)/generate-video", body: RequestBody(selectedSetId: selectedSetId, deviceId: deviceId))
    }

    func fetchVideoQuota(deviceId: String) async throws -> VideoQuota {
        try await get(path: "/api/garment/video-quota", queryItems: [URLQueryItem(name: "deviceId", value: deviceId)])
    }

    func fetchGarmentSessionStatus(sessionId: String) async throws -> GarmentSessionStatusResponse {
        try await get(path: "/api/garment/session-status", queryItems: [URLQueryItem(name: "sessionId", value: sessionId)])
    }

    func prepareGarmentVideoPrompts(sessionId: String, selectedSetId: String) async throws -> PreparedGarmentVideoPromptResponse {
        struct RequestBody: Encodable {
            let sessionId: String
            let selectedSetId: String
        }
        do {
            return try await post(path: "/api/garment/prepare-video-prompts", body: RequestBody(sessionId: sessionId, selectedSetId: selectedSetId))
        } catch {
            if error is URLError {
                throw APIError.serverMessage("无法连接创意服务，请确认后端已启动。")
            }
            throw error
        }
    }

    func generateFinalGarmentVideoPrompt(sessionId: String, selectedSetId: String) async throws -> GeneratedVideoPromptResponse {
        struct RequestBody: Encodable {
            let sessionId: String
            let selectedSetId: String
        }
        do {
            return try await post(path: "/api/garment/generate-video-prompt", body: RequestBody(sessionId: sessionId, selectedSetId: selectedSetId))
        } catch {
            if error is URLError {
                throw APIError.serverMessage("无法连接创意服务，请确认后端已启动。")
            }
            throw error
        }
    }

    func startSeedanceVideoTask(sessionId: String, selectedSetId: String, prompt: String, deviceId: String) async throws -> StartedSeedanceVideoResponse {
        struct RequestBody: Encodable {
            let sessionId: String
            let selectedSetId: String
            let prompt: String
            let deviceId: String
        }
        do {
            return try await post(path: "/api/garment/generate-video", body: RequestBody(sessionId: sessionId, selectedSetId: selectedSetId, prompt: prompt, deviceId: deviceId))
        } catch {
            if error is URLError {
                throw APIError.serverMessage("无法连接创意服务，请确认后端已启动。")
            }
            throw error
        }
    }

    private func get<Response: Decodable>(path: String, queryItems: [URLQueryItem]) async throws -> Response {
        let candidateBaseURLs = ([baseURL] + fallbackBaseURLs).reduce(into: [URL]()) { result, url in
            if !result.contains(url) { result.append(url) }
        }
        var lastConnectionError: URLError?
        for candidateBaseURL in candidateBaseURLs {
            do {
                return try await performGet(baseURL: candidateBaseURL, path: path, queryItems: queryItems)
            } catch let error as URLError where error.code != .timedOut {
                lastConnectionError = error
                continue
            }
        }
        if let lastConnectionError { throw lastConnectionError }
        throw APIError.invalidResponse
    }

    private func performGet<Response: Decodable>(baseURL: URL, path: String, queryItems: [URLQueryItem]) async throws -> Response {
        var endpoint = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        if var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) {
            components.queryItems = queryItems
            endpoint = components.url ?? endpoint
        }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "GET"
        request.timeoutInterval = 60
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if !(200...299).contains(http.statusCode) {
            if let payload = try? jsonDecoder.decode(ServerError.self, from: data) {
                throw APIError.serverMessage(payload.userMessage)
            }
            throw APIError.invalidResponse
        }
        do {
            return try jsonDecoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decodingFailed
        }
    }

    private static func friendlyConnectionMessage(for error: URLError) -> String {
        switch error.code {
        case .timedOut:
            return "生成时间较长，请保持网络稳定，或稍后重新尝试。"
        case .cancelled:
            return "生成被系统中断，请重新点击生成。生成时可以切换 App，回来后会继续检查结果。"
        case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            return "无法连接创意服务，请检查网络后重试。"
        default:
            return "无法连接创意服务，请稍后重试。"
        }
    }

    func checkSeedanceVideoTask(sessionId: String, taskId: String) async throws -> SeedanceVideoTaskStatusResponse {
        struct RequestBody: Encodable {
            let sessionId: String
            let taskId: String
        }
        do {
            return try await post(path: "/api/garment/video-task-status", body: RequestBody(sessionId: sessionId, taskId: taskId))
        } catch {
            if error is URLError {
                throw APIError.serverMessage("无法连接创意服务，请确认后端已启动。")
            }
            throw error
        }
    }

    private func post<Request: Encodable, Response: Decodable>(path: String, body: Request) async throws -> Response {
        let encodedBody = try jsonEncoder.encode(body)
        let candidateBaseURLs = ([baseURL] + fallbackBaseURLs).reduce(into: [URL]()) { result, url in
            if !result.contains(url) { result.append(url) }
        }

        var lastConnectionError: URLError?
        for candidateBaseURL in candidateBaseURLs {
            do {
                return try await performPost(baseURL: candidateBaseURL, path: path, encodedBody: encodedBody)
            } catch let error as URLError where error.code != .timedOut {
                lastConnectionError = error
                continue
            }
        }

        if let lastConnectionError {
            throw lastConnectionError
        }
        throw APIError.invalidResponse
    }

    private func performPost<Response: Decodable>(baseURL: URL, path: String, encodedBody: Data) async throws -> Response {
        let endpoint = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 150
        request.httpBody = encodedBody

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

        if !(200...299).contains(http.statusCode) {
            if let payload = try? jsonDecoder.decode(ServerError.self, from: data) {
                throw APIError.serverMessage(payload.userMessage)
            }
            throw APIError.invalidResponse
        }

        do {
            return try jsonDecoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decodingFailed
        }
    }

    private func postMultipart<Response: Decodable>(path: String, queryItems: [URLQueryItem] = [], files: [MultipartFile]) async throws -> Response {
        let candidateBaseURLs = ([baseURL] + fallbackBaseURLs).reduce(into: [URL]()) { result, url in
            if !result.contains(url) { result.append(url) }
        }
        var lastConnectionError: URLError?
        for candidateBaseURL in candidateBaseURLs {
            do {
                return try await performMultipartPost(baseURL: candidateBaseURL, path: path, queryItems: queryItems, files: files)
            } catch let error as URLError where error.code != .timedOut {
                lastConnectionError = error
                continue
            }
        }
        if let lastConnectionError { throw lastConnectionError }
        throw APIError.invalidResponse
    }

    private func performMultipartPost<Response: Decodable>(baseURL: URL, path: String, queryItems: [URLQueryItem], files: [MultipartFile]) async throws -> Response {
        var endpoint = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        if !queryItems.isEmpty, var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) {
            components.queryItems = queryItems
            endpoint = components.url ?? endpoint
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 600
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        let body = makeMultipartBody(files: files, boundary: boundary)

        let (data, response) = try await BackgroundUploadService.shared.upload(request: request, body: body)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if !(200...299).contains(http.statusCode) {
            if let payload = try? jsonDecoder.decode(ServerError.self, from: data) {
                throw APIError.serverMessage(payload.userMessage)
            }
            throw APIError.invalidResponse
        }
        do {
            return try jsonDecoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decodingFailed
        }
    }

    private func isValidProductURL(_ rawValue: String) -> Bool {
        guard
            let components = URLComponents(string: rawValue.trimmingCharacters(in: .whitespacesAndNewlines)),
            let scheme = components.scheme?.lowercased(),
            let host = components.host,
            !host.isEmpty
        else {
            return false
        }
        return scheme == "http" || scheme == "https"
    }

    private func validate1688URL(_ rawValue: String) throws {
        guard
            let components = URLComponents(string: rawValue.trimmingCharacters(in: .whitespacesAndNewlines)),
            let scheme = components.scheme?.lowercased(),
            let host = components.host?.lowercased(),
            !host.isEmpty,
            scheme == "http" || scheme == "https"
        else {
            throw APIError.invalidURL
        }

        guard host == "1688.com" || host.hasSuffix(".1688.com") else {
            throw APIError.serverMessage("当前 Demo 仅支持 1688 商品详情页链接")
        }
    }
}

private struct MultipartFile {
    let fieldName: String
    let filename: String
    let mimeType: String
    let data: Data
}

private func makeMultipartBody(files: [MultipartFile], boundary: String) -> Data {
    var body = Data()
    for file in files {
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.filename)\"\r\n")
        body.append("Content-Type: \(file.mimeType)\r\n\r\n")
        body.append(file.data)
        body.append("\r\n")
    }
    body.append("--\(boundary)--\r\n")
    return body
}

private extension Data {
    mutating func append(_ string: String) {
        append(Data(string.utf8))
    }
}

private extension UIImage {
    func normalizedJPEGData() -> Data? {
        let maxSide: CGFloat = 1280
        let longest = max(size.width, size.height)
        let targetSize: CGSize
        if longest > maxSide {
            let scale = maxSide / longest
            targetSize = CGSize(width: size.width * scale, height: size.height * scale)
        } else {
            targetSize = size
        }

        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let rendered = renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return rendered.jpegData(compressionQuality: 0.76)
    }
}

private struct ServerError: Decodable {
    struct NestedError: Decodable {
        let code: String
        let message: String
    }

    let error: NestedError?
    let legacyError: String?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case error
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        error = try? container.decode(NestedError.self, forKey: .error)
        legacyError = try? container.decode(String.self, forKey: .error)
        message = try? container.decode(String.self, forKey: .message)
    }

    var userMessage: String {
        let code = error?.code ?? legacyError ?? ""
        switch code {
        case "INVALID_1688_URL", "ONLY_1688_SUPPORTED":
            return "当前 Demo 仅支持 1688 商品详情页链接。"
        case "EXTRACTION_FAILED":
            return "暂时无法读取该 1688 页面，请检查链接是否有效。"
        case "EXTRACTION_BLOCKED":
            return "该页面需要登录或验证，当前 Demo 不会绕过平台限制。"
        case "LLM_TIMEOUT":
            return "创意分析服务响应超时，请稍后重试。"
        case "LLM_PROVIDER_ERROR":
            return "创意分析服务暂时不可用，请稍后重试。"
        case "LLM_JSON_PARSE_ERROR":
            return "创意结果解析失败，请重新生成。"
        case "MISSING_FRONT_IMAGE":
            return "请先上传衣服正面照。"
        case "MISSING_BACK_IMAGE":
            return "请先上传衣服反面照。"
        case "UPLOAD_TOO_LARGE", "INVALID_UPLOAD", "INVALID_IMAGE_TYPE":
            return "照片上传失败，请重新选择或重新拍照。"
        case "SESSION_NOT_FOUND":
            return "生成记录已失效，请重新上传照片。"
        case "TOS_UPLOAD_FAILED":
            return "视频素材上传失败，请稍后重试。"
        case "REFERENCE_VIDEO_UNAVAILABLE":
            return "参考视频不可访问，请检查对象存储中的 video-case.mp4。"
        case "DAILY_VIDEO_LIMIT_REACHED":
            return "今日视频生成次数已用完，明天 00:00 后刷新。"
        case "MISSING_DEVICE_ID":
            return "缺少设备信息，请重新打开 App 后再试。"
        default:
            return error?.message ?? message ?? "服务返回异常，请稍后再试。"
        }
    }
}

enum DeviceIdentifier {
    private static let account = "runway-prompt-studio-device-id"

    static func current() -> String {
        if let existing = read() { return existing }
        let created = UUID().uuidString
        save(created)
        return created
    }

    private static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8),
              !value.isEmpty
        else {
            return nil
        }
        return value
    }

    private static func save(_ value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }
}

let jsonEncoder: JSONEncoder = {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    return encoder
}()

let jsonDecoder: JSONDecoder = {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .custom { decoder in
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)

        let formatterWithFraction = ISO8601DateFormatter()
        formatterWithFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatterWithFraction.date(from: value) {
            return date
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: value) {
            return date
        }

        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(value)")
    }
    return decoder
}()
