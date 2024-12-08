import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Handle if app is launched via a quick action
        if let shortcutItem = connectionOptions.shortcutItem {
            handleShortcutItem(shortcutItem)
        }
        guard let _ = (scene as? UIWindowScene) else { return }
    }

    func windowScene(_ windowScene: UIWindowScene,
                     performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        handleShortcutItem(shortcutItem)
        completionHandler(true)
    }

    // Handle home screen quick actions here:
    private func handleShortcutItem(_ shortcutItem: UIApplicationShortcutItem) {
        switch shortcutItem.type {
        case "com.yourcompany.doorapp.open3sec":
            openDoorAfterDelay(3)
        case "com.yourcompany.doorapp.open":
            openDoor()
        case "com.yourcompany.doorapp.close":
            closeDoor()
        case "com.yourcompany.doorapp.status":
            getDoorStatus()
        default:
            break
        }
    }

    private func openDoor() {
        // Added a print statement to confirm action:
        print("Shortcut triggered: Opening door now.")
        NetworkManager.shared.sendCommand(command: "open") { result in
            switch result {
            case .success():
                print("Door opened via shortcut.")
            case .failure(let error):
                print("Failed to open door via shortcut: \(error.localizedDescription)")
            }
        }
    }

    private func openDoorAfterDelay(_ seconds: Int) {
        // Added a print statement to confirm action:
        print("Shortcut triggered: Will open door after \(seconds) seconds.")
        DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(seconds)) {
            self.openDoor()
        }
    }

    private func closeDoor() {
        // Added a print statement to confirm action:
        print("Shortcut triggered: Closing door now.")
        NetworkManager.shared.sendCommand(command: "close") { result in
            switch result {
            case .success():
                print("Door closed via shortcut.")
            case .failure(let error):
                print("Failed to close door via shortcut: \(error.localizedDescription)")
            }
        }
    }

    private func getDoorStatus() {
        // Added a print statement to confirm action:
        print("Shortcut triggered: Checking door status.")
        NetworkManager.shared.fetchDoorStatus { result in
            switch result {
            case .success(let status):
                print("Door is \(status.doorOpen ? "Open" : "Closed")")
            case .failure(let error):
                print("Error getting status: \(error.localizedDescription)")
            }
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
