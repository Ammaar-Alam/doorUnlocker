import SwiftUI

struct WebchatView: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var showUserListOverlay: Bool = false
    @State private var showRoomListOverlay: Bool = false

    @Environment(\.horizontalSizeClass) var horizontalSizeClass

    var body: some View {
        NavigationView {
            Group {
                if !viewModel.isLoggedIn {
                    ChatLoginView(viewModel: viewModel)
                } else {
                    if horizontalSizeClass == .regular {
                        // iPad or larger: three-column layout
                        HStack(spacing: 0) {
                            // Users list (left)
                            UserListOverlayView(users: viewModel.userList, requestUserList: {
                                viewModel.requestUserList()
                            })
                            .frame(width: 250)
                            .background(Color(hex: "#111111"))
                            
                            Divider().background(Color.gray)
                            
                            // Chat area (center)
                            VStack(spacing: 0) {
                                MessageListView(messages: viewModel.messages, currentUsername: viewModel.username)
                                Divider().background(Color.gray)
                                MessageInputView(message: $viewModel.currentMessage, sendAction: {
                                    viewModel.sendMessage()
                                })
                            }
                            .frame(maxWidth: .infinity)
                            
                            Divider().background(Color.gray)
                            
                            // Rooms list (right)
                            RoomListOverlayView(rooms: viewModel.roomList, joinRoom: { selectedRoom in
                                viewModel.joinRoom(username: viewModel.username, room: selectedRoom, password: "")
                            })
                            .frame(width: 250)
                            .background(Color(hex: "#111111"))
                        }
                    } else {
                        // iPhone: vertical layout with overlay buttons for users and rooms
                        VStack {
                            MessageListView(messages: viewModel.messages, currentUsername: viewModel.username)
                            MessageInputView(message: $viewModel.currentMessage, sendAction: {
                                viewModel.sendMessage()
                            })
                        }
                        .navigationBarItems(
                            leading: Button(action: {
                                showUserListOverlay.toggle()
                            }) {
                                Image(systemName: "person.2.fill")
                                    .foregroundColor(.white)
                            },
                            trailing: Button(action: {
                                showRoomListOverlay.toggle()
                            }) {
                                Image(systemName: "list.bullet")
                                    .foregroundColor(.white)
                            }
                        )
                    }
                }
            }
            .navigationBarTitle(viewModel.isLoggedIn ? "WebChat" : "Join Chat", displayMode: .inline)
            .background(Color(hex: "#0a0a0a").edgesIgnoringSafeArea(.all))
        }
        .sheet(isPresented: $showUserListOverlay) {
            UserListOverlayView(users: viewModel.userList, requestUserList: {
                viewModel.requestUserList()
            })
            .background(Color(hex: "#0a0a0a"))
        }
        .sheet(isPresented: $showRoomListOverlay) {
            RoomListOverlayView(rooms: viewModel.roomList, joinRoom: { selectedRoom in
                viewModel.joinRoom(username: viewModel.username, room: selectedRoom, password: "")
                showRoomListOverlay = false
            })
            .background(Color(hex: "#0a0a0a"))
        }
    }
}

// MARK: - Chat Subviews

struct ChatLoginView: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var inputUsername: String = ""
    @State private var inputRoom: String = "general"
    @State private var inputPassword: String = ""
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Join the Chat")
                .font(.largeTitle)
                .foregroundColor(.white)
            TextField("Username", text: $inputUsername)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .autocapitalization(.none)
            TextField("Room (default: general)", text: $inputRoom)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .autocapitalization(.none)
            SecureField("Room Password (optional)", text: $inputPassword)
                .textFieldStyle(RoundedBorderTextFieldStyle())
            Button(action: {
                viewModel.joinRoom(username: inputUsername, room: inputRoom.isEmpty ? "general" : inputRoom, password: inputPassword)
            }) {
                Text("Join Chat")
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(LinearGradient(gradient: Gradient(colors: [Color(hex: "#00ffff"), Color(hex: "#4dc6ff")]), startPoint: .topLeading, endPoint: .bottomTrailing))
                    .cornerRadius(8)
            }
            Spacer()
        }
        .padding()
        .background(Color(hex: "#0a0a0a").edgesIgnoringSafeArea(.all))
    }
}

struct MessageListView: View {
    let messages: [ChatMessage]
    let currentUsername: String

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(messages) { message in
                        ChatMessageRow(message: message, currentUsername: currentUsername)
                            .id(message.id)
                    }
                }
                .padding()
            }
            .background(Color(hex: "#0a0a0a"))
            .onChange(of: messages.count) { _ in
                if let last = messages.last {
                    withAnimation {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }
}

struct MessageInputView: View {
    @Binding var message: String
    var sendAction: () -> Void

    var body: some View {
        HStack {
            TextField("Enter message...", text: $message, onCommit: {
                if !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    sendAction()
                }
            })
            .padding(10)
            .background(Color(hex: "#111111"))
            .cornerRadius(8)
            .foregroundColor(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(hex: "#222222"), lineWidth: 1)
            )
            Button(action: {
                if !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    sendAction()
                }
            }) {
                Image(systemName: "paperplane.fill")
                    .foregroundColor(.white)
                    .padding()
                    .background(LinearGradient(gradient: Gradient(colors: [Color(hex: "#00ffff"), Color(hex: "#4dc6ff")]), startPoint: .topLeading, endPoint: .bottomTrailing))
                    .cornerRadius(8)
            }
        }
        .padding()
        .background(Color(hex: "#0a0a0a"))
    }
}

struct UserListOverlayView: View {
    let users: [String]
    var requestUserList: (() -> Void)?

    var body: some View {
        NavigationView {
            List(users, id: \.self) { user in
                Text(user)
                    .foregroundColor(.white)
                    .padding(10)
                    .listRowBackground(Color(hex: "#111111"))
            }
            .navigationBarTitle("Users Online", displayMode: .inline)
            .background(Color(hex: "#0a0a0a"))
            .onAppear {
                requestUserList?()
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
    }
}

struct RoomListOverlayView: View {
    let rooms: [String]
    var joinRoom: (String) -> Void
    var body: some View {
        NavigationView {
            List(rooms, id: \.self) { room in
                Button(action: {
                    joinRoom(room)
                }) {
                    Text(room)
                        .foregroundColor(.white)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(hex: "#111111"))
                        .cornerRadius(8)
                }
                .listRowBackground(Color(hex: "#111111"))
            }
            .navigationBarTitle("Chat Rooms", displayMode: .inline)
            .background(Color(hex: "#0a0a0a"))
        }
        .navigationViewStyle(StackNavigationViewStyle())
    }
}

struct WebchatView_Previews: PreviewProvider {
    static var previews: some View {
        WebchatView()
            .preferredColorScheme(.dark)
    }
}
