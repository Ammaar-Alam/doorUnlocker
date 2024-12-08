import Foundation

enum NetworkError: Error {
    case invalidURL
    case invalidResponse
    case decodingError
    case unauthorized
    case other(Error)
    
    var localizedDescription: String {
        switch self {
        case .invalidURL:
            return "Invalid URL."
        case .invalidResponse:
            return "Invalid or unexpected response from the server."
        case .decodingError:
            return "Failed to decode the data."
        case .unauthorized:
            return "Unauthorized. Please check your credentials."
        case .other(let error):
            return error.localizedDescription
        }
    }
}

class NetworkManager {
    static let shared = NetworkManager()
    
    // If password protected, user must enter password at login screen
    // The session token from successful login is stored in SecureStorage
    // For requests requiring auth, we add the token as "Authorization" header
    
    private init() {}
    
    private func getAuthToken() -> String? {
        SecureStorage.shared.getAuthToken()
    }
    
    func checkAuthStatus(completion: @escaping (Result<AuthStatus, NetworkError>) -> Void) {
        guard let url = URL(string: "\(APIConfig.baseURL)/auth-status") else {
            completion(.failure(.invalidURL))
            return
        }
        
        let request = URLRequest(url: url)
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(.other(error)))
                return
            }
            
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(.invalidResponse))
                return
            }
            
            guard 200..<300 ~= httpResponse.statusCode else {
                completion(.failure(.invalidResponse))
                return
            }
            
            do {
                let authStatus = try JSONDecoder().decode(AuthStatus.self, from: data)
                completion(.success(authStatus))
            } catch {
                completion(.failure(.decodingError))
            }
            
        }.resume()
    }
    
    func login(password: String, completion: @escaping (Result<String, NetworkError>) -> Void) {
        guard let url = URL(string: "\(APIConfig.baseURL)/login") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        let body = ["password": password]
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            let bodyData = try JSONSerialization.data(withJSONObject: body, options: [])
            request.httpBody = bodyData
        } catch {
            completion(.failure(.other(error)))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(.other(error)))
                return
            }
            
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(.invalidResponse))
                return
            }
            
            guard 200..<300 ~= httpResponse.statusCode else {
                if httpResponse.statusCode == 401 {
                    completion(.failure(.unauthorized))
                } else {
                    completion(.failure(.invalidResponse))
                }
                return
            }
            
            do {
                let result = try JSONDecoder().decode(LoginResponse.self, from: data)
                completion(.success(result.token))
            } catch {
                completion(.failure(.decodingError))
            }
            
        }.resume()
    }
    
    func sendCommand(command: String, completion: @escaping (Result<Void, NetworkError>) -> Void) {
        guard let url = URL(string: "\(APIConfig.baseURL)/command") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let body = ["command": command]
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = getAuthToken() {
            request.setValue(token, forHTTPHeaderField: "Authorization")
        }
        
        do {
            let bodyData = try JSONSerialization.data(withJSONObject: body, options: [])
            request.httpBody = bodyData
        } catch {
            completion(.failure(.other(error)))
            return
        }
        
        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                completion(.failure(.other(error)))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse,
                  200..<300 ~= httpResponse.statusCode else {
                completion(.failure(.invalidResponse))
                return
            }
            
            completion(.success(()))
        }.resume()
    }
    
    func fetchDoorStatus(completion: @escaping (Result<DoorStatus, NetworkError>) -> Void) {
        guard let url = URL(string: "\(APIConfig.baseURL)/status") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        if let token = getAuthToken() {
            request.setValue(token, forHTTPHeaderField: "Authorization")
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(.other(error)))
                return
            }
            
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse,
                  200..<300 ~= httpResponse.statusCode else {
                completion(.failure(.invalidResponse))
                return
            }
            
            do {
                let status = try JSONDecoder().decode(DoorStatus.self, from: data)
                completion(.success(status))
            } catch {
                completion(.failure(.decodingError))
            }
        }.resume()
    }
    
    func emergencyClose(completion: @escaping (Result<Void, NetworkError>) -> Void) {
        guard let url = URL(string: "\(APIConfig.baseURL)/emergency-close") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = getAuthToken() {
            request.setValue(token, forHTTPHeaderField: "Authorization")
        }
        
        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                completion(.failure(.other(error)))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse,
                  200..<300 ~= httpResponse.statusCode else {
                completion(.failure(.invalidResponse))
                return
            }
            
            completion(.success(()))
        }.resume()
    }
}
