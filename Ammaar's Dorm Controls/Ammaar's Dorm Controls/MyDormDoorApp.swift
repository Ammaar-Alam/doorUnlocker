import SwiftUI

@main
struct MyDormDoorApp: App {
    @StateObject var doorViewModel = DoorControlViewModel()
    @StateObject var loginViewModel = LoginViewModel()
    @State private var pendingShortcutAction: ShortcutActionType? = nil

    init() {
        // Customize UITabBar appearance to use dark colors.
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(red: 24/255, green: 24/255, blue: 27/255, alpha: 1.0)
        appearance.shadowImage = nil
        appearance.shadowColor = .clear
        
        UITabBar.appearance().standardAppearance = appearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }

    var body: some Scene {
        WindowGroup {
            TabView {
                // Portfolio Tab – first.
                PortfolioHomeView(url: URL(string: "https://ammaaralam.com")!)
                    .tabItem {
                        Image(systemName: "house.fill")
                        Text("Portfolio")
                    }
                
                // Door Control Tab – second.
                DoorControlWrapperView()
                    .environmentObject(doorViewModel)
                    .environmentObject(loginViewModel)
                    .tabItem {
                        Image(systemName: "door.left.hand.open")
                        Text("Door")
                    }
                
                // WebChat Tab – third.
                WebchatView()
                    .tabItem {
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                        Text("Chat")
                    }
            }
        }
    }
}
