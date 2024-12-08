import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: DoorControlViewModel
    @EnvironmentObject var loginViewModel: LoginViewModel
    
    // For shimmer animation on "Connect with Me"
    @State private var shimmerOffset: CGFloat = -1.0
    
    var body: some View {
        ZStack {
            // Background with animated network nodes
            NetworkBackgroundView()
                .ignoresSafeArea()
            
            ScrollView(showsIndicators: false) {
                VStack(spacing: 30) {
                    if loginViewModel.isCheckingAuthStatus {
                        LoadingView(message: "Checking Authorization...")
                            .padding(.top, 50)
                    } else {
                        if loginViewModel.authRequired && !loginViewModel.isAuthenticated {
                            loginFormSection
                        } else {
                            doorControlSection
                        }
                    }
                    
                    aboutSection
                    connectSection
                        .onAppear {
                            withAnimation(.linear(duration: 2.0).repeatForever(autoreverses: false)) {
                                shimmerOffset = 2.0
                            }
                        }
                    
                    Spacer(minLength: 50)
                }
                .padding(.top, 50)
                .padding(.horizontal)
            }
        }
        .onAppear {
            loginViewModel.checkAuthStatus()
        }
        .alert(item: $viewModel.errorMessage) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
        .alert(item: $loginViewModel.errorMessage) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
    }
    
    // MARK: - Login Form Section
    private var loginFormSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Please Log In")
                .font(.largeTitle)
                .fontWeight(.semibold)
                .gradientText()
                .padding(.bottom, 10)
                .frame(maxWidth: .infinity, alignment: .center) // Center title
            
            SecureField("Enter Password", text: $loginViewModel.password)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .foregroundColor(AppTheme.text)
                .padding(.horizontal)
                .accentColor(AppTheme.primary)
            
            if loginViewModel.isLoading {
                ProgressView("Logging In...")
                    .tint(AppTheme.primary)
            } else {
                Button(action: {
                    loginViewModel.login()
                }) {
                    Text("Login")
                        .font(.headline)
                        .foregroundColor(AppTheme.background)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(AppTheme.highlightGradient)
                        .cornerRadius(10)
                        .shadow(color: AppTheme.primary.opacity(0.4), radius: 10)
                }
                .padding(.horizontal)
            }
            
            Text("Login to control the door. If you don't have the password, you can still view the info below.")
                .font(.footnote)
                .foregroundColor(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
    
    // MARK: - Door Control Section
    private var doorControlSection: some View {
        VStack(spacing: 20) {
            StatusView(isDoorOpen: viewModel.isDoorOpen)
            
            DoorControlView(viewModel: viewModel)
            
            if viewModel.isLoading {
                ProgressView("Processing...")
                    .tint(AppTheme.primary)
                    .padding()
            }
            
            if loginViewModel.authRequired && loginViewModel.isAuthenticated {
                Button("Logout") {
                    loginViewModel.logout()
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
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
        .onAppear {
            if loginViewModel.isAuthenticated {
                viewModel.fetchStatus()
            }
        }
    }
    
    // MARK: - About Section
    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("About This Project")
                .font(.title2)
                .fontWeight(.semibold)
                .gradientText()
                .frame(maxWidth: .infinity, alignment: .center)
            
            Text("""
This is a personal project I worked on over the summer. The toggle above really does open or close my door. It sends a command to my proxy server which routes that command to the Arduino IoT Cloud, relaying the command to the Arduino. That Arduino is connected to a motor driver which then spins a DC motor, reeling a fishing line knotted around my door handle, pulling it down.
""")
            .foregroundColor(AppTheme.text)
            .font(.body)
            .fixedSize(horizontal: false, vertical: true)
            
            Text("""
For now, I don’t plan to add more automation. This project was mainly inspired by my girlfriend, who joked about wanting her own prox for my room, and partly by my problem of locking myself out somewhat frequently. It was fun to learn to work with Arduinos and circuitry, so maybe I’ll expand later.
""")
            .foregroundColor(AppTheme.text)
            .font(.body)
            .fixedSize(horizontal: false, vertical: true)
            
            Text("""
All parts used are open source on the GitHub Repo, so feel free to make one yourself :)
""")
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
    
    // MARK: - Connect Section
    private var connectSection: some View {
        VStack(alignment: .center, spacing: 20) {
            // Shimmer on "Connect with Me"
            ZStack {
                Text("Connect with Me")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(AppTheme.text)
                
                // Shimmer overlay
                LinearGradient(
                    gradient: Gradient(colors: [AppTheme.gradientStart.opacity(0), AppTheme.gradientStart, AppTheme.gradientEnd, AppTheme.gradientStart.opacity(0)]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(width: 200, height: 20)
                .offset(x: shimmerOffset * 200)
                .mask(Text("Connect with Me")
                        .font(.title2)
                        .fontWeight(.semibold))
            }
            .frame(maxWidth: .infinity)
            
            VStack(alignment: .center, spacing: 15) {
                linkButton(icon: "camera.fill", text: "Coding Portfolio / Personal Site", url: "https://ammaaralam.com")
                linkButton(icon: "chevron.left.forwardslash.chevron.right", text: "GitHub", url: "https://github.com/Ammaar-Alam/doorUnlocker")
                linkButton(icon: "link", text: "LinkedIn", url: "https://www.linkedin.com/in/Ammaar-Alam")
                linkButton(icon: "camera.on.rectangle", text: "Photography Portfolio", url: "https://ammaar.xyz")
            }
            .frame(maxWidth: .infinity)
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
    
    private func linkButton(icon: String, text: String, url: String) -> some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(AppTheme.primary)
                Text(text)
                    .font(.headline)
                    .foregroundColor(AppTheme.primary)
            }
            .padding(8)
            .background(AppTheme.cardBg)
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border, lineWidth: 1))
            .shadow(color: AppTheme.primary.opacity(0.3), radius: 5)
            .scaleEffect(1.0)
            .onHover { hovering in
                // If running on macOS, we can use hover. On iOS, ignore.
            }
            .animation(.spring(), value: 1.0)
        }
    }
}
