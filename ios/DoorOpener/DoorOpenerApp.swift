import SwiftUI

@main
struct DoorOpenerApp: App {
    @State private var bluetooth = BluetoothConnection()
    @State private var client = DoorClient()

    var body: some Scene {
        WindowGroup {
            TabView {
                DoorControlsView(client: client)
                .tabItem { Label("Door", systemImage: "door.left.hand.closed") }
                NavigationStack {
                    ConnectionView(bluetooth: bluetooth)
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

    var body: some View {
        Form {
            Section {
                LabeledContent("Door", value: bluetooth.status)
                Toggle("Auto-connect", isOn: Binding(get: { bluetooth.enabled }, set: bluetooth.setEnabled))
                Button("Forget door", role: .destructive, action: bluetooth.forgetDoor)
            } footer: {
                Text("Once paired, iOS reconnects when your door is in range. The door controls proximity opening. Connecting nearby may move the handle.")
            }
            if bluetooth.pairingRequired {
                Section("Pair again") {
                    Text("In iPhone Settings → Bluetooth, forget Ammaar’s Door Opener. Then return here, choose Forget door, enable Auto-connect, and pair again with the code from USB Serial.")
                    Link("Open Settings", destination: URL(string: UIApplication.openSettingsURLString)!)
                }
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
