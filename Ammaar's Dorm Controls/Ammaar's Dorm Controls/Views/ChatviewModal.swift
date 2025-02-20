//
//  ChatViewModel.swift
//  Ammaar's Dorm Controls
//
//  Created by [Your Name] on [Date].
//  This file implements a production‑ready chat view model using Socket.IO
//

import Foundation
import Combine
import SocketIO

final class ChatViewModel: ObservableObject {
    // Published properties to update the UI
    @Published var messages: [ChatMessage] = []
    @Published var currentMessage: String = ""
    @Published var userList: [String] = []
    @Published var roomList: [String] = []
    @Published var isLoggedIn: Bool = false
    @Published var username: String = ""
    
    // Socket.IO manager and client
    private var manager: SocketManager
    private var socket: SocketIOClient
    
    // Any cancellables (if needed for Combine)
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Configure the socket manager with your webchat server URL
        guard let url = URL(string: "https://webchat.ammaar.xyz") else {
            fatalError("Invalid Webchat URL")
        }
        self.manager = SocketManager(socketURL: url, config: [.log(true), .compress, .forceWebsockets(true)])
        self.socket = manager.defaultSocket
        
        setupSocketHandlers()
        self.socket.connect()
    }
    
    private func setupSocketHandlers() {
        // On connection, log and perform any additional tasks
        socket.on(clientEvent: .connect) { data, ack in
            print("Socket connected")
        }
        
        // Handler for when the server sends a full list of messages
        socket.on("load messages") { [weak self] data, ack in
            guard let self = self,
                  let messagesArray = data.first as? [[String: Any]] else { return }
            let loadedMessages: [ChatMessage] = messagesArray.compactMap { dict in
                let isSystem = dict["systemMessage"] as? Bool ?? false
                let username = dict["username"] as? String ?? (isSystem ? "System" : "")
                let message = dict["message"] as? String ?? ""
                var timestamp = Date()
                if let timestampStr = dict["timestamp"] as? String,
                   let date = ISO8601DateFormatter().date(from: timestampStr) {
                    timestamp = date
                }
                return ChatMessage(username: username, message: message, timestamp: timestamp, isSystem: isSystem)
            }
            DispatchQueue.main.async {
                self.messages = loadedMessages
            }
        }
        
        // Handler for receiving a new message
        socket.on("message") { [weak self] data, ack in
            guard let self = self,
                  let dict = data.first as? [String: Any] else { return }
            let isSystem = dict["systemMessage"] as? Bool ?? false
            let username = dict["username"] as? String ?? (isSystem ? "System" : "")
            let message = dict["message"] as? String ?? ""
            var timestamp = Date()
            if let timestampStr = dict["timestamp"] as? String,
               let date = ISO8601DateFormatter().date(from: timestampStr) {
                timestamp = date
            }
            let chatMessage = ChatMessage(username: username, message: message, timestamp: timestamp, isSystem: isSystem)
            DispatchQueue.main.async {
                // Append message only if it is not a duplicate
                if !self.messages.contains(chatMessage) {
                    self.messages.append(chatMessage)
                }
            }
        }
        
        // Handler for receiving the updated user list
        socket.on("update user list") { [weak self] data, ack in
            guard let self = self,
                  let users = data.first as? [String] else { return }
            DispatchQueue.main.async {
                self.userList = users
            }
        }
        
        // Handler for receiving the updated room list
        socket.on("update room list") { [weak self] data, ack in
            guard let self = self,
                  let rooms = data.first as? [String] else { return }
            DispatchQueue.main.async {
                self.roomList = rooms
            }
        }
        
        // Handler for a password incorrect response
        socket.on("password incorrect") { data, ack in
            print("Password incorrect for room")
            // Additional error handling (e.g., alert the user) can be implemented here.
        }
    }
    
    // MARK: - Chat Actions
    
    /// Joins a room with the specified username and password.
    func joinRoom(username: String, room: String, password: String) {
        self.username = username
        let joinData: [String: Any] = [
            "username": username,
            "room": room,
            "password": password
        ]
        socket.emit("add user", joinData)
        DispatchQueue.main.async {
            self.isLoggedIn = true
        }
    }
    
    /// Convenience method for joining a room without a password.
    func joinRoom(username: String, room: String) {
        joinRoom(username: username, room: room, password: "")
    }
    
    /// Sends the current message to the chat room.
    func sendMessage() {
        let trimmed = currentMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let messageData: [String: Any] = [
            "username": username,
            "message": trimmed,
            "room": "general",  // Change as needed if supporting multiple rooms
            "timestamp": timestamp,
            "systemMessage": false
        ]
        socket.emit("sendMessage", messageData)
        // Append the message locally for immediate feedback
        let newMessage = ChatMessage(username: username, message: trimmed, timestamp: Date(), isSystem: false)
        DispatchQueue.main.async {
            if !self.messages.contains(newMessage) {
                self.messages.append(newMessage)
            }
        }
        currentMessage = ""
    }
    
    /// Requests an updated user list from the server.
    func requestUserList() {
        socket.emit("request user list", "general") // Adjust room as needed
    }
}
