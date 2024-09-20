import Foundation

enum NetworkError: Error {
    case invalidURL
    case invalidResponse
    case decodingError
    case other(Error)
}

class NetworkManager {
    static let shared = NetworkManager()
    
    private let baseURL: String = {
        // Ensure the baseURL does not contain any trailing whitespace or newlines
        let url = "http://192.168.1.100:8080" // Replace with your actual endpoint
        return url.trimmingCharacters(in: .whitespacesAndNewlines)
    }()
    
    private init() {}
    
    func sendCommand(command: String, completion: @escaping (Result<Void, NetworkError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/command/\(command)") else {
            completion(.failure(.invalidURL))
            return // Added return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        // Add any necessary headers here
        // request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(.other(error)))
                return // Added return
            }

            guard let httpResponse = response as? HTTPURLResponse,
                  200..<300 ~= httpResponse.statusCode else {
                completion(.failure(.invalidResponse))
                return // Added return
            }

            completion(.success(()))
        }.resume()
    }

    func fetchDoorStatus(completion: @escaping (Result<DoorStatus, NetworkError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/status") else {
            completion(.failure(.invalidURL))
            return // Added return
        }

        let request = URLRequest(url: url)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(.other(error)))
                return // Added return
            }

            guard let data = data else {
                completion(.failure(.invalidResponse))
                return // Added return
            }

            do {
                let status = try JSONDecoder().decode(DoorStatus.self, from: data)
                completion(.success(status))
            } catch {
                completion(.failure(.decodingError))
            }
        }.resume()
    }
}
