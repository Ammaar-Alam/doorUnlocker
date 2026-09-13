import Foundation
import CoreBluetooth

final class StubRequests: URLProtocol {
    static var commandCount = 0
    static var failCommand = false
    static var online = true
    static var requireLogin = false

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}
    override func startLoading() {
        let path = request.url!.path
        assert(request.url?.host == "door.ammaaralam.com")
        var code = 200
        var body = "{}"
        switch path {
        case "/api/status": body = "{\"online\":\(Self.online),\"doorOpen\":false}"
        case "/api/diagnostics":
            code = Self.requireLogin ? 401 : 200
            body = "{\"ok\":false,\"message\":\"Please sign in\"}"
        case "/api/login":
            assert(request.httpMethod == "POST")
            Self.requireLogin = false
        case "/api/command":
            assert(request.httpMethod == "POST")
            Self.commandCount += 1
            if Self.failCommand {
                client?.urlProtocol(self, didFailWithError: URLError(.timedOut))
                return
            }
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
        let client = DoorClient(session: URLSession(configuration: configuration))
        await client.refresh()
        assert(client.status?.online == true && client.status?.doorOpen == false)
        StubRequests.requireLogin = true
        do { _ = try await client.data("diagnostics"); fatalError("Expected authentication failure") }
        catch { assert(error.localizedDescription == "Please sign in") }
        assert(client.needsLogin)
        await client.send(open: true)
        assert(StubRequests.commandCount == 0)
        try await client.login(password: "test-password")
        assert(!client.needsLogin)

        StubRequests.online = false
        await client.refresh()
        await client.send(open: true)
        assert(StubRequests.commandCount == 0)
        StubRequests.online = true
        await client.refresh()
        StubRequests.failCommand = true
        await client.send(open: true)
        assert(StubRequests.commandCount == 1, "A timed-out command must never be automatically resent")
        assert(client.error?.contains("Command not confirmed") == true && client.sending == nil)
        StubRequests.failCommand = false
        await client.send(open: false)
        await client.send(open: false)
        assert(StubRequests.commandCount == 3, "Separate deliberate Close commands must each run")
        async let first: Void = client.send(open: true)
        async let duplicate: Void = client.send(open: true)
        _ = await (first, duplicate)
        assert(StubRequests.commandCount == 4, "Overlapping commands must be suppressed")
        print("iOS authentication, command safety and Bluetooth recovery checks passed")
    }
}
