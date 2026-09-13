import Foundation
import Observation

struct DoorStatus: Decodable {
    var doorOpen: Bool?
    var online: Bool
    var updatedAt: String?
}

@MainActor @Observable
final class DoorClient {
    static let origin = URL(string: "https://door.ammaaralam.com")!
    var status: DoorStatus?
    private var statusError: String?
    private var commandError: String?
    var error: String? { commandError ?? statusError }
    var commandUnconfirmed: Bool { commandError != nil }
    var sending: Bool?
    var needsLogin = false
    private let session: URLSession
    private let confirmationTimeout: Duration

    init(session: URLSession = .shared, confirmationTimeout: Duration = .seconds(12)) {
        self.session = session
        self.confirmationTimeout = confirmationTimeout
    }

    struct ServiceError: LocalizedError {
        let message: String
        var statusCode = 0
        var errorDescription: String? { message }
    }

    func data(_ path: String, body: [String: String]? = nil) async throws -> Data {
        var request = URLRequest(url: Self.origin.appendingPathComponent("api/" + path))
        request.timeoutInterval = 10
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ServiceError(message: "Invalid server response") }
        guard (200..<300).contains(http.statusCode) else {
            struct Failure: Decodable { var message: String }
            let message = (try? JSONDecoder().decode(Failure.self, from: data).message) ?? "Door service unavailable"
            throw ServiceError(message: message, statusCode: http.statusCode)
        }
        return data
    }

    func refresh() async {
        do {
            let value = try JSONDecoder().decode(DoorStatus.self, from: await data("status"))
            guard !Task.isCancelled else { return }
            status = value
            statusError = nil
            needsLogin = false
        } catch {
            guard !Task.isCancelled else { return }
            status = nil
            statusError = error.localizedDescription
            if (error as? ServiceError)?.statusCode == 401 { needsLogin = true }
        }
    }

    func send(open: Bool) async {
        guard sending == nil, !needsLogin, status?.online == true else { return }
        let previousUpdate = status?.updatedAt
        sending = open
        commandError = nil
        defer { sending = nil }
        do {
            _ = try await data("command", body: ["command": open ? "open" : "close"])
            let clock = ContinuousClock()
            let deadline = clock.now.advanced(by: confirmationTimeout)
            repeat {
                await refresh()
                if status?.doorOpen == open, let updated = status?.updatedAt, updated != previousUpdate { return }
                try await Task.sleep(for: .milliseconds(250))
            } while clock.now < deadline
            commandError = "Command sent, but completion was not confirmed. Check the handle before retrying."
        } catch {
            if (error as? ServiceError)?.statusCode == 401 { needsLogin = true }
            commandError = "Command not confirmed. Check the handle before retrying. \(error.localizedDescription)"
        }
    }

    func login(password: String) async throws {
        _ = try await data("login", body: ["password": password])
        needsLogin = false
        statusError = nil
    }
}
