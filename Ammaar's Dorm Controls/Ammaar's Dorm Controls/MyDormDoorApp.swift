import SwiftUI

@main
struct MyDormDoorApp: App {
    @StateObject var doorViewModel = DoorControlViewModel()
    @StateObject var loginViewModel = LoginViewModel()
    @State private var pendingShortcutAction: ShortcutActionType? = nil

    var body: some Scene {
        WindowGroup {
            ContentView(pendingShortcutAction: $pendingShortcutAction)
                .environmentObject(doorViewModel)
                .environmentObject(loginViewModel)
                .onAppear {
                    // If there was a shortcut action requested at launch, capture it now.
                    if let action = SceneDelegate.requestedShortcutAction {
                        pendingShortcutAction = action
                        SceneDelegate.requestedShortcutAction = nil
                    }
                }
        }
    }
}
