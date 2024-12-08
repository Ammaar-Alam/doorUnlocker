import AppIntents
import Foundation

enum DoorAction: String, CaseIterable, AppEnum {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Door Action")

    case open = "open"
    case close = "close"
    case emergencyClose = "emergency-close"

    static var caseDisplayRepresentations: [DoorAction: DisplayRepresentation] = [
        .open: DisplayRepresentation(
            title: "Open Door",
            subtitle: "Opens the dorm door",
            image: .init(systemName: "arrow.up.circle")
        ),
        .close: DisplayRepresentation(
            title: "Close Door",
            subtitle: "Closes the dorm door",
            image: .init(systemName: "lock")
        ),
        .emergencyClose: DisplayRepresentation(
            title: "Emergency Close",
            subtitle: "Force closes/untangles the door",
            image: .init(systemName: "exclamationmark.triangle")
        )
    ]
}

@available(iOS 16.0, *)
struct DoorActionIntent: AppIntent {
    static var title: LocalizedStringResource = "Perform Door Action"
    static var description = IntentDescription("Choose an action to perform on the door (open, close, or emergency close).")

    @Parameter(title: "Action", default: .open)
    var action: DoorAction

    func perform() async throws -> some IntentResult {
        try await performDoorCommand(action.rawValue)
        return .result(dialog: "Performed \(action) action on the door.")
    }
}

@available(iOS 16.0, *)
struct OpenDoorIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Door"
    static var description = IntentDescription("Opens the dorm door immediately.")

    func perform() async throws -> some IntentResult {
        try await performDoorCommand("open")
        return .result(dialog: "Door opened successfully!")
    }
}

@available(iOS 16.0, *)
struct OpenDoorIn3SecIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Door (3 Seconds)"
    static var description = IntentDescription("Opens the door immediately, waits 3 seconds, then closes it.")

    func perform() async throws -> some IntentResult {
        try await performDoorCommand("open")
        try await Task.sleep(nanoseconds: 3_000_000_000)
        try await performDoorCommand("close")
        return .result(dialog: "Opened, waited 3 seconds, and closed the door.")
    }
}

@available(iOS 16.0, *)
struct CloseDoorIntent: AppIntent {
    static var title: LocalizedStringResource = "Close Door"
    static var description = IntentDescription("Closes the dorm door.")

    func perform() async throws -> some IntentResult {
        try await performDoorCommand("close")
        return .result(dialog: "Door closed successfully!")
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
                phrases: [.init("Open door in three seconds")],
                shortTitle: "Open in 3s",
                systemImageName: "timer"
            ),
            AppShortcut(
                intent: OpenDoorIntent(),
                phrases: [.init("Open door now")],
                shortTitle: "Open Now",
                systemImageName: "arrow.up.circle"
            ),
            AppShortcut(
                intent: CloseDoorIntent(),
                phrases: [.init("Close the door")],
                shortTitle: "Close Door",
                systemImageName: "lock"
            ),
            AppShortcut(
                intent: GetDoorStatusIntent(),
                phrases: [.init("Check the door status")],
                shortTitle: "Door Status",
                systemImageName: "magnifyingglass"
            ),
            AppShortcut(
                intent: DoorActionIntent(),
                phrases: [.init("Perform a door action")],
                shortTitle: "Perform Door Action",
                systemImageName: "gear"
            )
        ]
    }
}
