import Foundation

public struct ChatMessage: Identifiable, Codable, Equatable {
    public let id = UUID()
    public let username: String
    public let message: String
    public let timestamp: Date
    public let isSystem: Bool

    public init(username: String, message: String, timestamp: Date, isSystem: Bool) {
        self.username = username
        self.message = message
        self.timestamp = timestamp
        self.isSystem = isSystem
    }
    
    public static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        // Allow up to 1 second difference to account for minor timestamp differences
        return lhs.username == rhs.username &&
            lhs.message == rhs.message &&
            abs(lhs.timestamp.timeIntervalSince(rhs.timestamp)) < 1.0 &&
            lhs.isSystem == rhs.isSystem
    }
}
