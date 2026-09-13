import SwiftUI

struct DoorControlsView: View {
    let client: DoorClient
    @Environment(\.scenePhase) private var phase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false
    private let blue = Color(red: 0.12, green: 0.43, blue: 0.65)
    private var drawnOpen: Bool { client.sending ?? client.status?.doorOpen ?? false }
    private var reportedState: String {
        guard client.status?.online == true, let open = client.status?.doorOpen else { return "Unavailable" }
        return open ? "Open" : "Closed"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Text("DORM ROOM DOOR").font(.caption.weight(.semibold)).tracking(2)
                    Spacer()
                    Label(client.status?.online == true ? "Online" : "Offline", systemImage: "circle.fill")
                        .font(.caption).foregroundStyle(.secondary)
                }
                ZStack {
                    RoundedRectangle(cornerRadius: 8).strokeBorder(blue.opacity(0.25), lineWidth: 2)
                        .frame(width: 180, height: 230)
                    HStack(spacing: 0) {
                        Capsule().fill(blue).frame(width: 65, height: 9)
                        Circle().fill(Color(red: 0.7, green: 0.25, blue: 0.22)).frame(width: 22, height: 22)
                    }
                    .rotationEffect(.degrees(drawnOpen ? -38 : 0), anchor: .trailing)
                    .offset(x: 24)
                    .animation(reduceMotion ? nil : .easeInOut(duration: drawnOpen ? 0.97 : 0.55), value: drawnOpen)
                }
                .frame(maxWidth: .infinity).frame(height: 260)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    Text(client.sending.map { $0 ? "Opening…" : "Closing…" } ?? (client.commandUnconfirmed ? "Not confirmed" : reportedState))
                        .font(.largeTitle.weight(.semibold))
                    Text("Reported state · no position sensor").font(.caption).foregroundStyle(.secondary)
                }
                if client.needsLogin { DoorSignInView(client: client) }
                HStack(spacing: 12) {
                    Button { Task { await client.send(open: true) } } label: {
                        Label("Open door", systemImage: "door.left.hand.open").frame(maxWidth: .infinity, minHeight: 40)
                    }.buttonStyle(.borderedProminent)
                    Button { Task { await client.send(open: false) } } label: {
                        Label("Close door", systemImage: "door.left.hand.closed").frame(maxWidth: .infinity, minHeight: 40)
                    }.buttonStyle(.bordered)
                }
                .disabled(client.sending != nil || client.needsLogin || client.status?.online != true)
                if let error = client.error { Text(error).font(.callout).foregroundStyle(.red) }
                Divider()
                Link(destination: DoorClient.origin) {
                    HStack { Text("Explore the mechanism"); Spacer(); Image(systemName: "arrow.up.right") }
                }.frame(minHeight: 44)
            }
            .padding(24)
        }
        .background(Color(red: 0.96, green: 0.97, blue: 0.98))
        .tint(blue)
        .onAppear { visible = true }
        .onDisappear { visible = false }
        .task(id: visible && phase == .active) {
            guard visible && phase == .active else { return }
            while !Task.isCancelled {
                await client.refresh()
                do { try await Task.sleep(for: .seconds(2)) } catch { return }
            }
        }
    }
}

struct DoorSignInView: View {
    let client: DoorClient
    var onSignIn: (() -> Void)? = nil
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SecureField("Door password", text: $password).textContentType(.password).textFieldStyle(.roundedBorder)
            Button("Sign in") {
                busy = true
                error = nil
                Task {
                    defer { busy = false; password = "" }
                    do { try await client.login(password: password); onSignIn?() }
                    catch { self.error = error.localizedDescription }
                }
            }.disabled(password.isEmpty || busy)
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
        }
    }
}
