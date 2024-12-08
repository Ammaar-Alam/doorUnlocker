import Foundation
import Combine

class DoorControlViewModel: ObservableObject {
    @Published var isDoorOpen: Bool = false
    @Published var isLoading: Bool = false
    @Published var errorMessage: AppError?
    
    private var cancellables = Set<AnyCancellable>()
    
    // Updated: We now have a method that takes the desired state (open or closed) instead of toggling.
    func toggleDoor(open: Bool) {
        isLoading = true
        let command = open ? "open" : "close"
        NetworkManager.shared.sendCommand(command: command) { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success():
                    // Directly set the door state to the requested state
                    self?.isDoorOpen = open
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
    
    func emergencyClose() {
        isLoading = true
        NetworkManager.shared.emergencyClose { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success():
                    self?.isDoorOpen = false
                case .failure(let error):
                    self?.errorMessage = AppError(message: error.localizedDescription)
                }
            }
        }
    }
}
