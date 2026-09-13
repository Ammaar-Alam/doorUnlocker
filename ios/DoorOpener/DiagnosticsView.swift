import SwiftUI
import WebKit

struct DiagnosticsSnapshot: Decodable {
    struct Telemetry: Decodable {
        struct Phone: Decodable, Identifiable {
            var slot: Int
            var rssi: Int?
            var near: Bool
            var id: Int { slot }
        }
        var connected: Int
        var phones: [Phone]
    }
    var receivedAt: Date?
    var telemetry: Telemetry?
}

struct DiagnosticsView: View {
    let bluetooth: BluetoothConnection
    let website: DoorWebsite
    @Environment(\.scenePhase) private var phase
    @State private var snapshot: DiagnosticsSnapshot?
    @State private var message: String?
    @State private var needsLogin = false
    @State private var password = ""
    @State private var signingIn = false
    @State private var visible = false

    var body: some View {
        List {
            Section {
                if needsLogin {
                    SecureField("Door password", text: $password).textContentType(.password)
                    Button("Sign in") { Task { await login() } }
                        .disabled(password.isEmpty || signingIn)
                }
                if let message { Text(message).foregroundStyle(.secondary) }
                if let telemetry = snapshot?.telemetry {
                    LabeledContent("Connected phones", value: "\(telemetry.connected)")
                    ForEach(telemetry.phones) { phone in
                        LabeledContent("Phone \(phone.slot)\(phone.near ? " · near" : "")", value: phone.rssi.map { "\($0) dBm" } ?? "No reading")
                    }
                }
                if let date = snapshot?.receivedAt {
                    LabeledContent("Last received") { Text(date, style: .relative) }
                }
            } header: { Text("At the door") } footer: {
                Text("Arduino readings refresh while this screen is open. Disconnected readings can be a minute apart. This is live telemetry; the server's retained journal stays on the server.")
            }
            Section("This phone · recent activity") {
                if bluetooth.entries.isEmpty { Text("Connection events will appear here.").foregroundStyle(.secondary) }
                ForEach(Array(bluetooth.entries.enumerated()), id: \.offset) { _, entry in
                    Text(entry).font(.footnote).textSelection(.enabled)
                }
            }
        }
        .navigationTitle("Logs")
        .onAppear { visible = true }
        .onDisappear { visible = false }
        .task(id: visible && phase == .active) {
            guard visible && phase == .active else { return }
            while !Task.isCancelled {
                await refresh()
                do { try await Task.sleep(for: .milliseconds(needsLogin || message != nil ? 5000 : 500)) }
                catch { return }
            }
        }
    }

    private func request(_ path: String) async -> URLRequest {
        var request = URLRequest(url: DoorWebsite.origin.appendingPathComponent(path))
        request.timeoutInterval = 8
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let cookies = await website.webView.configuration.websiteDataStore.httpCookieStore.allCookies()
        request.allHTTPHeaderFields = HTTPCookie.requestHeaderFields(with: cookies.filter {
            $0.name == "authToken" && $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")) == DoorWebsite.origin.host
        })
        return request
    }

    private func refresh() async {
        do {
            let (data, response) = try await URLSession.shared.data(for: request("api/diagnostics"))
            guard !Task.isCancelled else { return }
            let code = (response as? HTTPURLResponse)?.statusCode
            needsLogin = code == 401
            guard code == 200 else {
                snapshot = nil
                message = needsLogin ? "Sign in to see Arduino readings." : "Diagnostics unavailable. The server may need the app update."
                return
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .millisecondsSince1970
            snapshot = try decoder.decode(DiagnosticsSnapshot.self, from: data)
            message = snapshot?.telemetry == nil ? "Waiting for an Arduino report." : nil
        } catch {
            if !Task.isCancelled { message = "Cannot refresh readings. \(error.localizedDescription)" }
        }
    }

    private func login() async {
        signingIn = true
        defer { signingIn = false; password = "" }
        do {
            var request = await request("api/login")
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["password": password])
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                message = (try? JSONDecoder().decode([String: String].self, from: data)["message"]) ?? "Sign-in failed. Check your password."
                return
            }
            let headers = http.allHeaderFields.reduce(into: [String: String]()) { result, pair in
                if let key = pair.key as? String, let value = pair.value as? String { result[key] = value }
            }
            for cookie in HTTPCookie.cookies(withResponseHeaderFields: headers, for: DoorWebsite.origin) {
                await website.webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
            }
            needsLogin = false
            await refresh()
        } catch { message = error.localizedDescription }
    }
}
