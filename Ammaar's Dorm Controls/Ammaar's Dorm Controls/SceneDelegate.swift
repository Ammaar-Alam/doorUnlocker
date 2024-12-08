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
        NetworkManager.shared.sendCommand(command: "open") { _ in }
    }

    private func openDoorAfterDelay(_ seconds: Int) {
        DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(seconds)) {
            self.openDoor()
        }
    }

    private func closeDoor() {
        NetworkManager.shared.sendCommand(command: "close") { _ in }
    }

    private func getDoorStatus() {
        NetworkManager.shared.fetchDoorStatus { result in
            switch result {
            case .success(let status):
                print("Door is \(status.doorOpen ? "Open" : "Closed")")
            case .failure(let error):
                print("Error getting status: \(error.localizedDescription)")
            }
        }
    }
}
