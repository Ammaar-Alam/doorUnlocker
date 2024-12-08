import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: DoorControlViewModel
    @EnvironmentObject var loginViewModel: LoginViewModel

    @State private var animateShimmer = false

    var body: some View {
        ZStack {
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

                    Spacer(minLength: 50)
                }
                .padding(.top, 50)
                .padding(.horizontal)
            }
        }
        .onAppear {
            loginViewModel.checkAuthStatus()
            // Start shimmer animation
            animateShimmer = true
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
