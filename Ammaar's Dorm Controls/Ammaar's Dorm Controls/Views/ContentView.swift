import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: DoorControlViewModel
    @EnvironmentObject var loginViewModel: LoginViewModel

    @State private var animateShimmer = false
    @State private var showingLaunchMessage: Bool = false
    @State private var launchMessage: String = ""
    @State private var doorbellMessage: String = ""
    
    // Controls whether the login modal is shown.
    @State private var showLoginSheet: Bool = false

    @Binding var pendingShortcutAction: ShortcutActionType?

    var body: some View {
        NavigationView {
            ZStack {
                NetworkBackgroundView()
                    .ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 30) {
                        
                        // Door Controls: Status is always visible.
                        VStack(spacing: 20) {
                            shimmerTitle("Door Controls")
                            
                            // Always-visible door status
                            StatusView(isDoorOpen: viewModel.isDoorOpen)
                            
                            // Interactive controls wrapped in a ZStack
                            ZStack {
                                // Interactive part
                                VStack(spacing: 20) {
                                    DoorControlView(viewModel: viewModel)
                                    
                                    if viewModel.isLoading {
                                        ProgressView("Processing...")
                                            .tint(AppTheme.primary)
                                            .padding()
                                    }
                                    
                                    if loginViewModel.authRequired && loginViewModel.isAuthenticated {
                                        Button("Logout") {
                                            loginViewModel.logout()
                                            viewModel.stopAutoRefresh()
                                        }
                                        .font(.headline)
                                        .foregroundColor(AppTheme.background)
                                        .padding()
                                        .background(AppTheme.highlightGradient)
                                        .cornerRadius(10)
                                        .shadow(color: AppTheme.primary.opacity(0.4), radius: 10)
                                        .padding(.bottom, 20)
                                    }
                                }
                                
                                // Overlay on interactive controls when locked
                                if loginViewModel.authRequired && !loginViewModel.isAuthenticated {
                                    lockedOverlayInteractive()
                                }
                            }
                        }
                        .padding()
                        .background(AppTheme.cardBg)
                        .cornerRadius(15)
                        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
                        .shadow(color: .black.opacity(0.5), radius: 8)
                        
                        // Doorbell section remains accessible regardless of auth.
                        doorbellSection
                        
                        aboutSection
                        connectSection

                        NavigationLink(destination: PortfolioView()) {
                            HStack {
                                Image(systemName: "globe")
                                Text("View My Portfolio")
                                    .font(.headline)
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(AppTheme.highlightGradient)
                            .cornerRadius(10)
                            .shadow(color: AppTheme.primary.opacity(0.4), radius: 10)
                        }
                        
                        Spacer(minLength: 50)
                    }
                    .padding(.top, 50)
                    .padding(.horizontal)
                }
            }
            .onAppear {
                loginViewModel.checkAuthStatus()
                animateShimmer = true
            }
            .onChange(of: loginViewModel.authRequired) { newValue in
                if newValue && !loginViewModel.isAuthenticated {
                    showLoginSheet = true
                }
            }
            .onChange(of: loginViewModel.isAuthenticated) { isAuth in
                if isAuth {
                    viewModel.startAutoRefresh()
                    tryPerformShortcutAction()
                    showLoginSheet = false
                } else if loginViewModel.authRequired {
                    viewModel.stopAutoRefresh()
                    // Allow locked overlay to remain; user can tap its login button to log in.
                }
            }
            .sheet(isPresented: $showLoginSheet) {
                LoginModalView(onDismiss: {
                    showLoginSheet = false
                })
                .environmentObject(loginViewModel)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .interactiveDismissDisabled(false)
            }
            .alert(isPresented: $showingLaunchMessage) {
                Alert(title: Text("Shortcut Action"),
                      message: Text(launchMessage),
                      dismissButton: .default(Text("OK")))
            }
            .alert(item: $viewModel.errorMessage) { error in
                Alert(title: Text("Error"),
                      message: Text(error.message),
                      dismissButton: .default(Text("OK")))
            }
            .alert(item: $loginViewModel.errorMessage) { error in
                Alert(title: Text("Error"),
                      message: Text(error.message),
                      dismissButton: .default(Text("OK")))
            }
        }
    }
    
    // MARK: - Locked Overlay for Interactive Controls
    private func lockedOverlayInteractive() -> some View {
        ZStack {
            Color.black.opacity(0.5)
            VStack(spacing: 10) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.white)
                Text("LOCKED")
                    .font(.title2)
                    .foregroundColor(.white)
                    .bold()
                Text("Interactive controls are disabled")
                    .font(.body)
                    .foregroundColor(.white)
                Button(action: {
                    showLoginSheet = true
                }) {
                    Text("Login")
                        .font(.headline)
                        .foregroundColor(Color(hex: "#0a0a0a"))
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(LinearGradient(
                            gradient: Gradient(colors: [
                                Color(hex: "#8ffcff"),
                                Color(hex: "#4dc6ff")
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .cornerRadius(10)
                        .shadow(color: Color(hex: "#8ffcff").opacity(0.4), radius: 10)
                }
                .padding(.top, 10)
            }
            .padding()
        }
        .cornerRadius(15)
    }
    
    // MARK: - Shortcut Handling

    private func tryPerformShortcutAction() {
        guard let action = pendingShortcutAction else { return }
        pendingShortcutAction = nil

        if loginViewModel.authRequired && !loginViewModel.isAuthenticated {
            launchMessage = "Please log in to perform this action."
            showingLaunchMessage = true
            return
        }
        performShortcutAction(action)
    }

    private func performShortcutAction(_ action: ShortcutActionType) {
        switch action {
        case .open3sec:
            NetworkManager.shared.sendCommand(command: "open") { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success():
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                            NetworkManager.shared.sendCommand(command: "close") { res2 in
                                DispatchQueue.main.async {
                                    switch res2 {
                                    case .success():
                                        self.launchMessage = "Door opened, waited 3s, then closed."
                                    case .failure(let err):
                                        self.launchMessage = "Opened door, but failed to close after 3s: \(err.localizedDescription)"
                                    }
                                    self.showingLaunchMessage = true
                                    self.viewModel.fetchStatus()
                                }
                            }
                        }
                    case .failure(let error):
                        self.launchMessage = "Failed to open door (3s): \(error.localizedDescription)"
                        self.showingLaunchMessage = true
                        self.viewModel.fetchStatus()
                    }
                }
            }
        case .open:
            NetworkManager.shared.sendCommand(command: "open") { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success():
                        self.launchMessage = "Door opened via shortcut."
                    case .failure(let error):
                        self.launchMessage = "Failed to open door: \(error.localizedDescription)"
                    }
                    self.showingLaunchMessage = true
                    self.viewModel.fetchStatus()
                }
            }
        case .close:
            NetworkManager.shared.sendCommand(command: "close") { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success():
                        self.launchMessage = "Door closed via shortcut."
                    case .failure(let error):
                        self.launchMessage = "Failed to close door: \(error.localizedDescription)"
                    }
                    self.showingLaunchMessage = true
                    self.viewModel.fetchStatus()
                }
            }
        case .status:
            NetworkManager.shared.fetchDoorStatus { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success(let status):
                        self.launchMessage = "Door is \(status.doorOpen ? "Open" : "Closed")"
                    case .failure(let error):
                        self.launchMessage = "Error getting status: \(error.localizedDescription)"
                    }
                    self.showingLaunchMessage = true
                    self.viewModel.fetchStatus()
                }
            }
        }
    }
    
    // MARK: - UI Sections

    private var doorbellSection: some View {
        VStack(alignment: .center, spacing: 20) {
            shimmerTitle("Ring Doorbell")

            TextField("Enter custom message (optional)", text: $doorbellMessage)
                .padding(10)
                .background(Color(hex: "#333333"))
                .cornerRadius(8)
                .foregroundColor(.white)
                .padding(.horizontal)

            Button(action: {
                viewModel.ringDoorbell(customMessage: doorbellMessage)
                doorbellMessage = ""
            }) {
                Text("Ring Doorbell")
                    .font(.headline)
                    .foregroundColor(AppTheme.background)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(AppTheme.primary)
                    .cornerRadius(10)
                    .shadow(color: AppTheme.primary.opacity(0.4), radius: 10)
            }
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
    
    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            shimmerTitle("About This Project")

            Text("This is a personal project I worked on over the summer. The toggle above really does open or close my door. It sends a command to my proxy server which routes that command to the Arduino IoT Cloud, relaying the command to the Arduino. That Arduino is connected to a motor driver which then spins a DC motor, reeling a fishing line knotted around my door handle, pulling it down.")
                .foregroundColor(AppTheme.text)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)

            Text("All parts are open source on GitHub, so feel free to build your own!")
                .font(.footnote)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)

            Divider().background(AppTheme.border)
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
    
    private var connectSection: some View {
        VStack(alignment: .center, spacing: 20) {
            shimmerTitle("Connect with Me")

            VStack(alignment: .center, spacing: 15) {
                externalLinkButton(icon: "camera.fill", text: "Coding Portfolio / Personal Site", url: "https://ammaaralam.com")
                externalLinkButton(icon: "chevron.left.forwardslash.chevron.right", text: "GitHub", url: "https://github.com/Ammaar-Alam/doorUnlocker")
                externalLinkButton(icon: "link", text: "LinkedIn", url: "https://www.linkedin.com/in/Ammaar-Alam")
                externalLinkButton(icon: "camera.on.rectangle", text: "Photography Portfolio", url: "https://ammaar.xyz")
            }
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
    
    // MARK: - Helpers

    private func shimmerTitle(_ text: String) -> some View {
        ZStack {
            Text(text)
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.text)
            
            LinearGradient(
                gradient: Gradient(colors: [
                    AppTheme.gradientStart.opacity(0),
                    AppTheme.gradientStart,
                    AppTheme.gradientEnd,
                    AppTheme.gradientStart.opacity(0)
                ]),
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: 200, height: 20)
            .offset(x: animateShimmer ? 200 : -200)
            .mask(
                Text(text)
                    .font(.title2)
                    .fontWeight(.semibold)
            )
        }
        .frame(maxWidth: .infinity)
        .animation(.linear(duration: 2.0).repeatForever(autoreverses: true), value: animateShimmer)
    }
    
    private func externalLinkButton(icon: String, text: String, url: String) -> some View {
        @State var isPressed = false
        return Button(action: {
            if let linkURL = URL(string: url) {
                UIApplication.shared.open(linkURL, options: [:], completionHandler: nil)
            }
        }) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(isPressed ? AppTheme.background : AppTheme.primary)
                Text(text)
                    .font(.headline)
                    .foregroundColor(isPressed ? AppTheme.background : AppTheme.primary)
            }
            .padding(8)
            .background(isPressed ? AppTheme.primary : AppTheme.cardBg)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border, lineWidth: 1))
            .shadow(color: AppTheme.primary.opacity(0.3), radius: 5)
            .scaleEffect(isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.2), value: isPressed)
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}
