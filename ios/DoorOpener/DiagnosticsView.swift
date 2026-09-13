import SwiftUI

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
    let client: DoorClient
    @Environment(\.scenePhase) private var phase
    @State private var snapshot: DiagnosticsSnapshot?
    @State private var message: String?
    @State private var visible = false

    var body: some View {
        List {
            Section {
                if client.needsLogin { DoorSignInView(client: client) }
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
                do { try await Task.sleep(for: .milliseconds(client.needsLogin || message != nil ? 5000 : 500)) }
                catch { return }
            }
        }
    }

    private func refresh() async {
        do {
            let data = try await client.data("diagnostics")
            guard !Task.isCancelled else { return }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .millisecondsSince1970
            snapshot = try decoder.decode(DiagnosticsSnapshot.self, from: data)
            message = snapshot?.telemetry == nil ? "Waiting for an Arduino report." : nil
        } catch {
            if !Task.isCancelled {
                snapshot = nil
                message = error.localizedDescription
            }
        }
    }
}
