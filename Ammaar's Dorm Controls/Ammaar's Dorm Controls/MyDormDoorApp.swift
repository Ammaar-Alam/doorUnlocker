import SwiftUI

@main
struct MyDormDoorApp: App {
    @StateObject var doorViewModel = DoorControlViewModel()
    @StateObject var loginViewModel = LoginViewModel()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(doorViewModel)
                .environmentObject(loginViewModel)
        }
    }
}
