import SwiftUI

@main
struct DoorOpenerApp: App {
    @State private var bluetooth = BluetoothConnection()
    @State private var client = DoorClient()

    var body: some Scene {
        WindowGroup {
            TabView {
                DoorScreen(client: client)
                .tabItem { Label("Door", systemImage: "door.left.hand.closed") }
                NavigationStack {
                    ConnectionView(bluetooth: bluetooth, client: client)
                }
                .tabItem { Label("Connection", systemImage: "antenna.radiowaves.left.and.right") }
                NavigationStack {
                    DiagnosticsView(bluetooth: bluetooth, client: client)
                }
                .tabItem { Label("Logs", systemImage: "waveform.path") }
            }
            .tint(Color(red: 0.12, green: 0.43, blue: 0.65))
            .preferredColorScheme(.light)
        }
    }
}

struct ConnectionView: View {
    @Bindable var bluetooth: BluetoothConnection
    let client: DoorClient
    @Environment(\.scenePhase) private var phase
    @State private var code: String?
    @State private var message: String?
    @State private var needsLogin = false
    @State private var loadingCode = false
    @State private var visible = false
    @AppStorage("simpleDoorControls") private var simpleControls = false

    var body: some View {
        Form {
            Section {
                LabeledContent("Door", value: bluetooth.status)
                if bluetooth.pairingRequired && bluetooth.managedID != nil {
                    Button("Forget door", role: .destructive, action: bluetooth.forgetDoor)
                        .disabled(bluetooth.setupBusy)
                } else {
                    Button(bluetooth.managedID == nil ? "Connect door" : "Reconnect", action: bluetooth.connectDoor)
                        .disabled(!bluetooth.setupReady || bluetooth.setupBusy)
                }
                Toggle("Auto-connect", isOn: Binding(get: { bluetooth.enabled }, set: bluetooth.setEnabled))
                    .disabled(bluetooth.managedID == nil || bluetooth.setupBusy)
                if bluetooth.managedID != nil && !bluetooth.pairingRequired {
                    Button("Forget door", role: .destructive, action: bluetooth.forgetDoor)
                        .disabled(bluetooth.setupBusy)
                }
            } footer: {
                Text("Reconnect keeps your pairing. Forget door asks iOS to remove the accessory. Connecting nearby may move the handle.")
            }
            if bluetooth.pairingRequired {
                Section("Repair pairing") {
                    Text(bluetooth.managedID == nil
                         ? "Tap Connect door to let iOS manage the existing accessory. You can then forget it here and pair again."
                         : "Choose Forget door, then Connect door. Use the pairing code below when iOS asks.")
                }
            }
            Section {
                if needsLogin { DoorSignInView(client: client) { Task { await loadCode() } } }
                if let code {
                    Text(code).font(.largeTitle.monospacedDigit()).textSelection(.enabled).privacySensitive()
                }
                Button(code == nil ? "Show pairing code" : "Refresh code") {
                    Task { await loadCode() }
                }.disabled(loadingCode)
                if let message { Text(message).foregroundStyle(.secondary) }
            } header: { Text("Pairing code") } footer: {
                Text("Sign in to see the current code, then connect your door. No USB is needed while the controller is online.")
            }
            if #available(iOS 26.0, *) {
                Section {
                    Toggle("Simple controls", isOn: $simpleControls)
                } header: { Text("Display") } footer: {
                    Text("Use this if the website has trouble loading or responding.")
                }
            }
            Section {
                Text("Keep Bluetooth enabled and leave this app in the background for automatic reconnection.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Connection")
        .onAppear { visible = true }
        .onDisappear { visible = false; code = nil }
        .onChange(of: phase) { _, phase in if phase != .active { code = nil } }
    }

    private func loadCode() async {
        guard !loadingCode else { return }
        loadingCode = true
        code = nil
        message = nil
        defer { loadingCode = false }
        do {
            struct PairingCode: Decodable { let code: String }
            let data = try await client.data("pairing-code")
            let value = try JSONDecoder().decode(PairingCode.self, from: data).code
            guard phase == .active, visible else { return }
            code = value
            needsLogin = false
        } catch {
            needsLogin = (error as? DoorClient.ServiceError)?.statusCode == 401
            message = error.localizedDescription
        }
    }

}
