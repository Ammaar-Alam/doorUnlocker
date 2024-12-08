import UIKit

enum ShortcutActionType {
    case open3sec, open, close, status
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    // Store requested action here
    static var requestedShortcutAction: ShortcutActionType?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
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
            SceneDelegate.requestedShortcutAction = .open3sec
        case "com.yourcompany.doorapp.open":
            SceneDelegate.requestedShortcutAction = .open
        case "com.yourcompany.doorapp.close":
            SceneDelegate.requestedShortcutAction = .close
        case "com.yourcompany.doorapp.status":
            SceneDelegate.requestedShortcutAction = .status
        default:
            break
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
