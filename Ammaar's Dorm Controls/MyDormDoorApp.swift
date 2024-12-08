import SwiftUI

@main
struct MyDormDoorApp: App {
    @StateObject var doorViewModel = DoorControlViewModel()
    @StateObject var loginViewModel = LoginViewModel()
    
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(doorViewModel)
                .environmentObject(loginViewModel)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var loginViewModel: LoginViewModel
    @EnvironmentObject var doorViewModel: DoorControlViewModel
    
    var body: some View {
        Group {
            if loginViewModel.isCheckingAuthStatus {
                LoadingView(message: "Checking Authorization...")
            } else if loginViewModel.authRequired && !loginViewModel.isAuthenticated {
                LoginView()
            } else {
                ContentView()
            }
        }
        .onAppear {
            loginViewModel.checkAuthStatus()
        }
    }
}
