import SwiftUI

@main
struct MyDormDoorApp: App {
    @StateObject var doorViewModel = DoorControlViewModel()
    @StateObject var loginViewModel = LoginViewModel()
    @State private var pendingShortcutAction: ShortcutActionType? = nil

    var body: some Scene {
        WindowGroup {
            NavigationView {
                ContentView(pendingShortcutAction: $pendingShortcutAction)
                    .environmentObject(doorViewModel)
                    .environmentObject(loginViewModel)
                    .onAppear {
                        if let action = SceneDelegate.requestedShortcutAction {
                            pendingShortcutAction = action
                            SceneDelegate.requestedShortcutAction = nil
                        }
                    }
            }
        }
    }
}
