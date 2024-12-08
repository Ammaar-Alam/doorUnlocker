import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: DoorControlViewModel
    @EnvironmentObject var loginViewModel: LoginViewModel
    
    @State private var shimmerOffset: CGFloat = -1.0
    
    var body: some View {
        ZStack {
            NetworkBackgroundView() // Animated background with nodes
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
                            doorControlSection // includes "Door Controls" shimmer header
                        }
                    }
                    
                    aboutSection // now also shimmer
                    connectSection // shimmer remains
                    
                    Spacer(minLength: 50)
                }
                .padding(.top, 50)
                .padding(.horizontal)
            }
        }
        .onAppear {
            loginViewModel.checkAuthStatus()
            withAnimation(.linear(duration: 2.0).repeatForever(autoreverses: false)) {
                shimmerOffset = 2.0
            }
        }
        .alert(item: $viewModel.errorMessage) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
        .alert(item: $loginViewModel.errorMessage) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
    }
    
    private var loginFormSection: some View {
        VStack(alignment: .center, spacing: 20) {
            Text("Please Log In")
                .font(.largeTitle)
                .fontWeight(.semibold)
                .gradientText()
                .padding(.bottom, 10)
                .frame(maxWidth: .infinity, alignment: .center)
            
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
    
    private var doorControlSection: some View {
        VStack(spacing: 20) {
            // Shimmered Title "Door Controls"
            shimmerTitle("Door Controls")

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
    
    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            shimmerTitle("About This Project")
            
            Text("""
This is a personal project I worked on over the summer. The toggle above really does open or close my door. It sends a command to my proxy server which routes that command to the Arduino IoT Cloud, relaying the command to the Arduino. That Arduino is connected to a motor driver which then spins a DC motor, reeling a fishing line knotted around my door handle, pulling it down.
""")
            .foregroundColor(AppTheme.text)
            .font(.body)
            .fixedSize(horizontal: false, vertical: true)
            
            Text("""
For now, I don’t plan to add more automation. It was inspired by a joke from my girlfriend and partly by my problem of locking myself out frequently. Fun learning experience with Arduinos and circuitry.
""")
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
                linkButton(icon: "camera.fill", text: "Coding Portfolio / Personal Site", url: "https://ammaaralam.com")
                linkButton(icon: "chevron.left.forwardslash.chevron.right", text: "GitHub", url: "https://github.com/Ammaar-Alam/doorUnlocker")
                linkButton(icon: "link", text: "LinkedIn", url: "https://www.linkedin.com/in/Ammaar-Alam")
                linkButton(icon: "camera.on.rectangle", text: "Photography Portfolio", url: "https://ammaar.xyz")
            }
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
    
    private func linkButton(icon: String, text: String, url: String) -> some View {
        @State var pressed = false
        return Link(destination: URL(string: url)!) {
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
            .scaleEffect(pressed ? 0.95 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.5), value: pressed)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in pressed = true }
                    .onEnded { _ in pressed = false }
            )
        }
    }
    
    // Helper function for shimmer title
    private func shimmerTitle(_ text: String) -> some View {
        ZStack {
            Text(text)
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.text)
            
            LinearGradient(
                gradient: Gradient(colors: [AppTheme.gradientStart.opacity(0), AppTheme.gradientStart, AppTheme.gradientEnd, AppTheme.gradientStart.opacity(0)]),
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: 200, height: 20)
            .offset(x: shimmerOffset * 200)
            .mask(
                Text(text)
                    .font(.title2)
                    .fontWeight(.semibold)
            )
        }
        .frame(maxWidth: .infinity)
    }
}
