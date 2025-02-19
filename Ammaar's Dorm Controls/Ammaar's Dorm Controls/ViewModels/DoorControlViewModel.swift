import Foundation
import Combine

class DoorControlViewModel: ObservableObject {
    @Published var isDoorOpen: Bool = false
    @Published var isLoading: Bool = false
    @Published var errorMessage: AppError?
    
    private var cancellables = Set<AnyCancellable>()
    private var autoRefreshTimer: Timer?

    init() {
        // won’t start the timer immediately (waiting till user logs in)
    }
    
    deinit {
        autoRefreshTimer?.invalidate()
    }

    /// called when user is authenticated (contentview)
    func startAutoRefresh() {
        autoRefreshTimer?.invalidate()
        autoRefreshTimer = Timer.scheduledTimer(withTimeInterval: 5.0,
                                                repeats: true,
                                                block: { [weak self] _ in
            self?.fetchStatus()
        })
    }

    /// stop auto‐refresh if user logs out or if u want to pause updates
    func stopAutoRefresh() {
        autoRefreshTimer?.invalidate()
        autoRefreshTimer = nil
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
    
    func toggleDoor(open: Bool) {
        isLoading = true
        let command = open ? "open" : "close"
        NetworkManager.shared.sendCommand(command: command) { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success():
                    self?.isDoorOpen = open
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
    
    /// doorbell w custom msg
    func ringDoorbell(customMessage: String? = nil) {
        isLoading = true
        let message = (customMessage != nil && !customMessage!.isEmpty)
            ? customMessage!
            : "Default doorbell ring: Someone rang your doorbell!"
        NetworkManager.shared.ringDoorbell(message: message) { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success():
                    print("Doorbell rung successfully")
                case .failure(let error):
                    self?.errorMessage = AppError(message: error.localizedDescription)
                }
            }
        }
    }
}
