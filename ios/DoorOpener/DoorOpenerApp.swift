import SwiftUI

@main
struct DoorOpenerApp: App {
    @State private var bluetooth = BluetoothConnection()
    @State private var website = DoorWebsite()

    var body: some Scene {
        WindowGroup {
            TabView {
                ZStack {
                    DoorWebsiteView(website: website)
                    if let error = website.error {
                        ContentUnavailableView {
                            Label("Website unavailable", systemImage: "wifi.slash")
                        } description: { Text(error) } actions: { Button("Retry", action: website.reload) }
                        .background(Color(.systemBackground))
                    }
                }
                .onAppear { if website.webView.url == nil { website.reload() } }
                .tabItem { Label("Door", systemImage: "door.left.hand.closed") }
                NavigationStack {
                    ConnectionView(bluetooth: bluetooth)
                }
                .tabItem { Label("Connection", systemImage: "antenna.radiowaves.left.and.right") }
                NavigationStack {
                    DiagnosticsView(bluetooth: bluetooth, website: website)
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

    var body: some View {
        Form {
            Section {
                LabeledContent("Door", value: bluetooth.status)
                Toggle("Auto-connect", isOn: Binding(get: { bluetooth.enabled }, set: bluetooth.setEnabled))
                Button("Forget door", role: .destructive, action: bluetooth.forgetDoor)
            } footer: {
                Text("Once paired, iOS reconnects when your door is in range. The door controls proximity opening. Connecting nearby may move the handle.")
            }
            if !bluetooth.candidates.isEmpty {
                Section("Nearby doors") {
                    ForEach(bluetooth.candidates, id: \.identifier) { door in
                        Button { bluetooth.select(door) } label: {
                            VStack(alignment: .leading) {
                                Text(door.name ?? "Door Opener")
                                Text(door.identifier.uuidString.suffix(8)).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            Section("First connection") {
                Text("Enable Auto-connect, then choose your door. Enter the pairing code shown in the Arduino USB Serial Monitor at 9600 baud.")
                Text("Keep Bluetooth enabled and leave this app in the background. Reopen it after force-quitting. RSSI is signal strength, not an exact distance.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Connection")
    }
}
