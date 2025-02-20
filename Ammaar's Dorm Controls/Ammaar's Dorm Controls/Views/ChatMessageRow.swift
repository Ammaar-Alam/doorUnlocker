//
//  ChatMessageRow.swift
//  Ammaar's Dorm Controls
//
//  Created by [Your Name] on [Date].
//

import SwiftUI

struct ChatMessageRow: View {
    let message: ChatMessage
    let currentUsername: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !message.isSystem {
                // Always display the sender's username
                HStack {
                    Text(message.username)
                        .font(.caption)
                        .foregroundColor(.gray)
                    Spacer()
                }
            }
            HStack {
                if message.username != currentUsername {
                    messageBubble
                    Spacer()
                } else {
                    Spacer()
                    messageBubble
                }
            }
        }
        .padding(message.isSystem ? 4 : 8)
        .frame(maxWidth: .infinity, alignment: message.username == currentUsername ? .trailing : .leading)
    }
    
    private var messageBubble: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(message.message)
                .font(.body)
                .foregroundColor(.white)
            HStack {
                Text(formattedTimestamp)
                    .font(.caption2)
                    .foregroundColor(Color.white.opacity(0.7))
                Spacer()
            }
        }
        .padding(10)
        .background(bubbleBackground)
        .cornerRadius(12)
    }
    
    private var bubbleBackground: Color {
        if message.isSystem {
            return Color.clear
        } else if message.username == currentUsername {
            // Light blue background for current user's messages
            return Color.blue.opacity(0.3)
        } else {
            // Dark gray background for others
            return Color.gray.opacity(0.3)
        }
    }
    
    private var formattedTimestamp: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: message.timestamp)
    }
}

struct ChatMessageRow_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            ChatMessageRow(message: ChatMessage(username: "Alice", message: "Hello, world!", timestamp: Date(), isSystem: false), currentUsername: "Bob")
            ChatMessageRow(message: ChatMessage(username: "Bob", message: "Hi Alice! How are you doing today?", timestamp: Date(), isSystem: false), currentUsername: "Bob")
            ChatMessageRow(message: ChatMessage(username: "System", message: "Alice joined the chat", timestamp: Date(), isSystem: true), currentUsername: "Bob")
        }
        .padding()
        .background(Color.black)
        .previewLayout(.sizeThatFits)
    }
}
