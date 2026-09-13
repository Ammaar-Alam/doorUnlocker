import Foundation
import Observation

struct DoorStatus: Decodable {
    var doorOpen: Bool?
    var online: Bool
}

@MainActor @Observable
final class DoorClient {
    static let origin = URL(string: "https://door.ammaaralam.com")!
    var status: DoorStatus?
    var error: String?
    var sending: Bool?
    var needsLogin = false
    private let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    struct ServiceError: LocalizedError {
        let message: String
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
        if http.statusCode == 401 { needsLogin = true }
        guard (200..<300).contains(http.statusCode) else {
            struct Failure: Decodable { var message: String }
            let message = (try? JSONDecoder().decode(Failure.self, from: data).message) ?? "Door service unavailable"
            throw ServiceError(message: message)
        }
        return data
    }

    func refresh() async {
        do {
            let value = try JSONDecoder().decode(DoorStatus.self, from: await data("status"))
            guard !Task.isCancelled else { return }
            status = value
        } catch {
            guard !Task.isCancelled else { return }
            status = nil
            self.error = error.localizedDescription
        }
    }

    func send(open: Bool) async {
        guard sending == nil, !needsLogin, status?.online == true else { return }
        sending = open
        error = nil
        defer { sending = nil }
        do {
            _ = try await data("command", body: ["command": open ? "open" : "close"])
            try await Task.sleep(for: .milliseconds(open ? 970 : 550))
        } catch {
            self.error = "Command not confirmed. Check the handle before retrying. \(error.localizedDescription)"
        }
        await refresh()
    }

    func login(password: String) async throws {
        _ = try await data("login", body: ["password": password])
        needsLogin = false
        error = nil
    }
}
