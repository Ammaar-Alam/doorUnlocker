import Foundation

// A simple storage for the auth token using UserDefaults.
// In production, consider using Keychain for security.

class SecureStorage {
    static let shared = SecureStorage()
    private let tokenKey = "authTokenKey"
    
    private init() {}
    
    func getAuthToken() -> String? {
        UserDefaults.standard.string(forKey: tokenKey)
    }
    
    func setAuthToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
    }
    
    func clearAuthToken() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }
}
