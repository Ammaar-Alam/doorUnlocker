import Foundation
import Combine

struct AppError: Identifiable {
    let id = UUID()
    let message: String
}

class DoorControlViewModel: ObservableObject {
    @Published var isDoorOpen: Bool = false
    @Published var isLoading: Bool = false
    @Published var errorMessage: AppError?

    private var cancellables = Set<AnyCancellable>()

    func toggleDoor() {
        let command = isDoorOpen ? "close" : "open"
        isLoading = true
        NetworkManager.shared.sendCommand(command: command) { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success(_):
                    self?.isDoorOpen.toggle()
                case .failure(let error):
                    self?.errorMessage = AppError(message: error.localizedDescription)
                }
            }
        }
    }

    func emergencyClose() {
        isLoading = true
        NetworkManager.shared.sendCommand(command: "emergency-close") { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success(_):
                    self?.isDoorOpen = false
                case .failure(let error):
                    self?.errorMessage = AppError(message: error.localizedDescription)
                }
            }
        }
    }

    func fetchStatus() {
        isLoading = true
        NetworkManager.shared.fetchDoorStatus { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success(let status):
                    self?.isDoorOpen = status.doorOpen
                case .failure(let error):
                    self?.errorMessage = AppError(message: error.localizedDescription)
                }
            }
        }
    }
}
