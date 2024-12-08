import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject var viewModel: DoorControlViewModel
    @EnvironmentObject var loginViewModel: LoginViewModel
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(gradient: Gradient(colors: [Color.blue.opacity(0.15), Color.purple.opacity(0.15)]),
                           startPoint: .top, endPoint: .bottom)
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 30) {
                    
                    // Top Section: Either login form if not authenticated (and auth required), or door controls
                    if loginViewModel.isCheckingAuthStatus {
                        LoadingView(message: "Checking Authorization...")
                            .padding(.top, 50)
                    } else {
                        if loginViewModel.authRequired && !loginViewModel.isAuthenticated {
                            // Show login at top
                            loginFormSection
                        } else {
                            // Show door controls if authenticated
                            doorControlSection
                        }
                    }
                    
                    // About and Info Section - always visible
                    aboutSection
                        .padding(.horizontal)
                    
                    // Social / Connect With Me Section
                    connectSection
                        .padding(.horizontal)
                    
                    Spacer(minLength: 50)
                }
                .padding(.top, 50)
            }
        }
        .onAppear {
            loginViewModel.checkAuthStatus()
            // If already authenticated, we can fetch door status once login check is done
        }
        .alert(item: $viewModel.errorMessage) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
        .alert(item: $loginViewModel.errorMessage) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
    }
    
    private var loginFormSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Please Log In")
                .font(.system(.largeTitle, weight: .semibold))
                .foregroundColor(.primary)
                .padding(.bottom, 10)
            
            TextField("Enter Password", text: $loginViewModel.password, onCommit: {
                loginViewModel.login()
            })
            .textFieldStyle(RoundedBorderTextFieldStyle())
            
            if loginViewModel.isLoading {
                ProgressView("Logging In...")
            } else {
                Button(action: {
                    loginViewModel.login()
                }) {
                    Text("Login")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.blue)
                        .cornerRadius(10)
                }
            }
            
            Text("Login to control the door. If you don't have the password, you can still view the project info below.")
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground).opacity(0.9))
        .cornerRadius(15)
        .shadow(radius: 5)
        .padding(.horizontal)
    }
    
    private var doorControlSection: some View {
        VStack(spacing: 20) {
            // Door Status View
            StatusView(isDoorOpen: viewModel.isDoorOpen)
            
            // Door Control View
            DoorControlView(viewModel: viewModel)
            
            if viewModel.isLoading {
                ProgressView("Processing...")
                    .padding()
            }
            
            // Logout button (only if auth is required and user is logged in)
            if loginViewModel.authRequired && loginViewModel.isAuthenticated {
                Button("Logout") {
                    loginViewModel.logout()
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .background(Color.blue)
                .cornerRadius(10)
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground).opacity(0.9))
        .cornerRadius(15)
        .shadow(radius: 5)
        .padding(.horizontal)
        .onAppear {
            if loginViewModel.isAuthenticated {
                viewModel.fetchStatus()
            }
        }
    }
    
    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("About This Project")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.primary)
            
            Text("""
            This is a personal project I worked on over the summer. The toggle above really does open or close my door. It sends a command to my proxy server which routes that command to the Arduino IoT Cloud server, relaying the command to the Arduino. That Arduino is connected to a motor driver which then spins a DC motor, reeling a fishing line knotted around my door handle, pulling it down.
            """)
            .font(.body)
            .foregroundColor(.primary)
            .fixedSize(horizontal: false, vertical: true)
            
            Text("""
            For now, I don’t plan to add more automation. This project was mainly inspired by my girlfriend, who joked about wanting her own prox for my room, and (just partly) by my real problem of locking myself out somewhat frequently. It was fun to learn to work with Arduinos and circuitry, so maybe I’ll expand it in the future.
            """)
            .font(.body)
            .foregroundColor(.primary)
            .fixedSize(horizontal: false, vertical: true)
            
            Text("""
            All the parts I used, including those bought and printed, are all open source on the GitHub Repo, including the code, so feel free to make one yourself :)
            """)
            .font(.footnote)
            .foregroundColor(.secondary)
            
            Divider()
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground).opacity(0.9))
        .cornerRadius(15)
        .shadow(radius: 5)
    }
    
    private var connectSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Connect with Me")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.primary)
            
            VStack(alignment: .leading, spacing: 10) {
                Link(destination: URL(string: "https://ammaaralam.com")!) {
                    labelWithIcon(icon: "camera.fill", text: "Coding Portfolio / Personal Site")
                }
                Link(destination: URL(string: "https://github.com/Ammaar-Alam/doorUnlocker")!) {
                    labelWithIcon(icon: "chevron.left.forwardslash.chevron.right", text: "GitHub")
                }
                Link(destination: URL(string: "https://www.linkedin.com/in/Ammaar-Alam")!) {
                    labelWithIcon(icon: "link", text: "LinkedIn")
                }
                Link(destination: URL(string: "https://ammaar.xyz")!) {
                    labelWithIcon(icon: "camera.on.rectangle", text: "Photography Portfolio")
                }
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground).opacity(0.9))
        .cornerRadius(15)
        .shadow(radius: 5)
    }
    
    private func labelWithIcon(icon: String, text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
            Text(text)
        }
        .font(.headline)
        .foregroundColor(.blue)
        .padding(8)
        .background(Color(UIColor.tertiarySystemBackground))
        .cornerRadius(8)
    }
}
