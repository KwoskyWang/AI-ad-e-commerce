import Foundation

final class BackgroundUploadService: NSObject, URLSessionDataDelegate {
    static let shared = BackgroundUploadService()

    private let identifier = "wang.zuobin.RunwayPromptStudio.garment-upload"
    private var continuations: [Int: CheckedContinuation<(Data, URLResponse), Error>] = [:]
    private var responseData: [Int: Data] = [:]
    private var backgroundCompletionHandler: (() -> Void)?

    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(withIdentifier: identifier)
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.allowsCellularAccess = true
        configuration.allowsExpensiveNetworkAccess = true
        configuration.allowsConstrainedNetworkAccess = true
        configuration.timeoutIntervalForRequest = 600
        configuration.timeoutIntervalForResource = 900
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    private override init() {
        super.init()
    }

    func upload(request: URLRequest, body: Data) async throws -> (Data, URLResponse) {
        let uploadFile = try writeUploadBody(body)
        return try await withCheckedThrowingContinuation { continuation in
            let task = session.uploadTask(with: request, fromFile: uploadFile)
            continuations[task.taskIdentifier] = continuation
            responseData[task.taskIdentifier] = Data()
            task.taskDescription = uploadFile.path
            task.resume()
        }
    }

    func setBackgroundCompletionHandler(_ handler: @escaping () -> Void) {
        backgroundCompletionHandler = handler
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        responseData[dataTask.taskIdentifier, default: Data()].append(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let taskId = task.taskIdentifier
        defer {
            continuations[taskId] = nil
            responseData[taskId] = nil
            if let path = task.taskDescription {
                try? FileManager.default.removeItem(atPath: path)
            }
        }

        if let error {
            continuations[taskId]?.resume(throwing: error)
            return
        }

        guard let response = task.response else {
            continuations[taskId]?.resume(throwing: APIError.invalidResponse)
            return
        }

        continuations[taskId]?.resume(returning: (responseData[taskId] ?? Data(), response))
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async { [weak self] in
            self?.backgroundCompletionHandler?()
            self?.backgroundCompletionHandler = nil
        }
    }

    private func writeUploadBody(_ body: Data) throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("garment-upload-bodies", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let fileURL = directory.appendingPathComponent("\(UUID().uuidString).multipart")
        try body.write(to: fileURL, options: .atomic)
        return fileURL
    }
}
