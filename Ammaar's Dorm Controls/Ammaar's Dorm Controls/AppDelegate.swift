import UIKit
import SwiftUI

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        switch shortcutItem.type {
        case "com.yourcompany.doorapp.open3sec":
            openDoorAfterDelay(3)
            completionHandler(true)
        case "com.yourcompany.doorapp.open":
            openDoor()
            completionHandler(true)
        case "com.yourcompany.doorapp.close":
            closeDoor()
            completionHandler(true)
        case "com.yourcompany.doorapp.status":
            getDoorStatus()
            completionHandler(true)
        default:
            completionHandler(false)
        }
    }

    func openDoor() {
        NetworkManager.shared.sendCommand(command: "open") { _ in }
    }
    func openDoorAfterDelay(_ seconds: Int) {
        DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(seconds)) {
            self.openDoor()
        }
    }
    func closeDoor() {
        NetworkManager.shared.sendCommand(command: "close") { _ in }
    }
    func getDoorStatus() {
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
