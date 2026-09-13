import Foundation
import CoreBluetooth

final class StubRequests: URLProtocol {
    static var commandCount = 0
    static var failCommand = false
    static var online = true
    static var requireLogin = false
    static var statusCode = 200
    static var state = false
    static var revision = 0
    static var polls = 0
    static var pending: Bool?
    static var completeAfterPolls = 3

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}
    override func startLoading() {
        let path = request.url!.path
        assert(request.url?.host == "door.ammaaralam.com")
        var code = 200
        var body = "{}"
        switch path {
        case "/api/status":
            code = Self.statusCode
            if let target = Self.pending {
                Self.polls += 1
                if Self.polls >= Self.completeAfterPolls {
                    Self.state = target
                    Self.revision += 1
                    Self.pending = nil
                }
            }
            body = "{\"online\":\(Self.online),\"doorOpen\":\(Self.state),\"updatedAt\":\"revision-\(Self.revision)\"}"
        case "/api/diagnostics", "/api/pairing-code":
            code = Self.requireLogin ? 401 : 200
            body = "{\"ok\":false,\"message\":\"Please sign in\"}"
        case "/api/login":
            assert(request.httpMethod == "POST")
            Self.requireLogin = false
        case "/api/command":
            assert(request.httpMethod == "POST")
            Self.commandCount += 1
            var payload = request.httpBody ?? Data()
            if let stream = request.httpBodyStream {
                stream.open()
                defer { stream.close() }
                var buffer = [UInt8](repeating: 0, count: 512)
                while stream.hasBytesAvailable {
                    let count = stream.read(&buffer, maxLength: buffer.count)
                    guard count > 0 else { break }
                    payload.append(contentsOf: buffer.prefix(count))
                }
            }
            let command = (try! JSONSerialization.jsonObject(with: payload) as! [String: String])["command"]
            assert(command == "open" || command == "close")
            if Self.failCommand {
                client?.urlProtocol(self, didFailWithError: URLError(.timedOut))
                return
            }
            Self.pending = command == "open"
            Self.polls = 0
        default: fatalError("Unexpected request: \(path)")
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
}

@main
struct IOSChecks {
    @MainActor static func main() async throws {
        let lostPairing = NSError(domain: CBErrorDomain, code: CBError.peerRemovedPairingInformation.rawValue)
        let timeout = NSError(domain: CBErrorDomain, code: CBError.encryptionTimedOut.rawValue)
        assert(BluetoothRecovery.action(error: lostPairing, enabled: true, isReconnecting: false) == .pairAgain)
        assert(BluetoothRecovery.action(error: lostPairing, enabled: true, isReconnecting: true) == .pairAgain)
        assert(BluetoothRecovery.action(error: timeout, enabled: true, isReconnecting: false) == .retry)
        assert(BluetoothRecovery.action(error: timeout, enabled: true, isReconnecting: true) == .waiting)
        assert(BluetoothRecovery.action(error: nil, enabled: true, isReconnecting: false) == .retry)
        assert(BluetoothRecovery.action(error: lostPairing, enabled: false, isReconnecting: false) == .stopped)

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubRequests.self]
        let client = DoorClient(session: URLSession(configuration: configuration), confirmationTimeout: .seconds(1))
        await client.refresh()
        assert(client.status?.online == true && client.status?.doorOpen == false)
        StubRequests.requireLogin = true
        for endpoint in ["diagnostics", "pairing-code"] {
            do { _ = try await client.data(endpoint); fatalError("Expected authentication failure") }
            catch { assert((error as? DoorClient.ServiceError)?.statusCode == 401) }
            assert(!client.needsLogin, "Private features must not lock public door controls")
        }
        await client.send(open: true)
        assert(StubRequests.commandCount == 1 && client.status?.doorOpen == true)
        assert(StubRequests.polls == 3, "Wait through cached old status until a fresh target report")
        assert(!client.commandUnconfirmed)

        StubRequests.statusCode = 401
        await client.refresh()
        assert(client.needsLogin)
        await client.send(open: false)
        assert(StubRequests.commandCount == 1)
        StubRequests.statusCode = 200
        await client.refresh()
        assert(!client.needsLogin && client.error == nil, "Public schedule recovery clears door authentication and refresh errors")
        StubRequests.statusCode = 503
        await client.refresh()
        assert(client.error != nil)
        StubRequests.statusCode = 200
        await client.refresh()
        assert(client.error == nil, "Recovered status errors must disappear")
        try await client.login(password: "test-password")

        StubRequests.online = false
        await client.refresh()
        await client.send(open: true)
        assert(StubRequests.commandCount == 1)
        StubRequests.online = true
        await client.refresh()
        StubRequests.failCommand = true
        await client.send(open: true)
        assert(StubRequests.commandCount == 2, "A timed-out command must never be automatically resent")
        await client.refresh()
        assert(client.commandUnconfirmed && client.sending == nil, "Status recovery must preserve ambiguous command warnings")
        StubRequests.failCommand = false
        StubRequests.completeAfterPolls = Int.max
        await client.send(open: false)
        assert(client.commandUnconfirmed && client.sending == nil, "Unconfirmed completion times out explicitly")
        StubRequests.completeAfterPolls = 3
        await client.send(open: false)
        await client.send(open: false)
        assert(StubRequests.commandCount == 5, "Separate deliberate Close commands must each run")
        assert(!client.commandUnconfirmed)
        async let first: Void = client.send(open: true)
        async let duplicate: Void = client.send(open: true)
        _ = await (first, duplicate)
        assert(StubRequests.commandCount == 6, "Overlapping commands must be suppressed")
        print("iOS authentication, fresh-state confirmation and Bluetooth recovery checks passed")
    }
}
