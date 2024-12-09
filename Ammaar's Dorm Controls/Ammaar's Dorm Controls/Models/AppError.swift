import Foundation

struct AppError: Identifiable {
    let id = UUID()
    let message: String
}
