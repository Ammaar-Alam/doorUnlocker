import AppIntents
import Foundation

@available(iOS 16.0, *)
struct OpenDoorIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Door"
    static var description = IntentDescription("Opens the dorm door immediately.")

    func perform() async throws -> some IntentResult {
        try await performDoorCommand("open")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenDoorIn3SecIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Door (3 Seconds)"
    static var description = IntentDescription("Waits 3 seconds, then opens the door.")

    func perform() async throws -> some IntentResult {
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await performDoorCommand("open")
        return .result()
    }
}

@available(iOS 16.0, *)
struct CloseDoorIntent: AppIntent {
    static var title: LocalizedStringResource = "Close Door"
    static var description = IntentDescription("Closes the dorm door.")

    func perform() async throws -> some IntentResult {
        try await performDoorCommand("close")
        return .result()
    }
}

@available(iOS 16.0, *)
struct GetDoorStatusIntent: AppIntent {
    static var title: LocalizedStringResource = "Door Status"
    static var description = IntentDescription("Checks if the dorm door is open or closed.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let status = try await getDoorStatus()
        return .result(dialog: "\(status)")
    }
}

@available(iOS 16.0, *)
extension AppIntent {
    func performDoorCommand(_ command: String) async throws {
        try await withCheckedThrowingContinuation { continuation in
            NetworkManager.shared.sendCommand(command: command) { result in
                switch result {
                case .success():
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func getDoorStatus() async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            NetworkManager.shared.fetchDoorStatus { result in
                switch result {
                case .success(let status):
                    continuation.resume(returning: status.doorOpen ? "Door is Open" : "Door is Closed")
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}

@available(iOS 16.0, *)
struct DoorShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        return [
            AppShortcut(
                intent: OpenDoorIn3SecIntent(),
                phrases: [AppShortcutPhrase("Open door in three seconds")],
                shortTitle: "Open in 3s",
                systemImageName: "timer"
            ),
            AppShortcut(
                intent: OpenDoorIntent(),
                phrases: [AppShortcutPhrase("Open door now")],
                shortTitle: "Open Now",
                systemImageName: "arrow.up.circle"
            ),
            AppShortcut(
                intent: CloseDoorIntent(),
                phrases: [AppShortcutPhrase("Close the door")],
                shortTitle: "Close Door",
                systemImageName: "lock"
            ),
            AppShortcut(
                intent: GetDoorStatusIntent(),
                phrases: [AppShortcutPhrase("Check the door status")],
                shortTitle: "Door Status",
                systemImageName: "magnifyingglass"
            )
        ]
    }
}
