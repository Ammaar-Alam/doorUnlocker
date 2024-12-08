import Foundation
import Combine

class LoginViewModel: ObservableObject {
    @Published var password: String = ""
    @Published var isAuthenticated: Bool = false
    @Published var authRequired: Bool = false
    @Published var isCheckingAuthStatus: Bool = true
    @Published var isLoading: Bool = false
    @Published var errorMessage: AppError?
    
    private var cancellables = Set<AnyCancellable>()
    
    func checkAuthStatus() {
        isCheckingAuthStatus = true
        NetworkManager.shared.checkAuthStatus { [weak self] result in
            DispatchQueue.main.async {
                self?.isCheckingAuthStatus = false
                switch result {
                case .success(let authStatus):
                    self?.authRequired = authStatus.authRequired
                    if !authStatus.authRequired {
                        self?.isAuthenticated = true
                    } else {
                        // If we have a token, consider user authenticated
                        if SecureStorage.shared.getAuthToken() != nil {
                            self?.isAuthenticated = true
                        }
                    }
                case .failure(let error):
                    self?.errorMessage = AppError(message: error.localizedDescription)
                }
            }
        }
    }
    
    func login() {
        guard !password.isEmpty else {
            errorMessage = AppError(message: "Password cannot be empty.")
            return
        }
        
        isLoading = true
        NetworkManager.shared.login(password: password) { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success(let token):
                    SecureStorage.shared.setAuthToken(token)
                    self?.isAuthenticated = true
                    self?.password = ""
                case .failure(let error):
                    self?.errorMessage = AppError(message: error.localizedDescription)
                }
            }
        }
    }
    
    func logout() {
        SecureStorage.shared.clearAuthToken()
        self.isAuthenticated = false
    }
}
