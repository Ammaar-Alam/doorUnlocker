import SwiftUI

struct LoginModalView: View {
    @EnvironmentObject var loginViewModel: LoginViewModel
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ZStack {
            Color(hex: "#0a0a0a").edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 20) {
                Text("Please Log In")
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.bottom, 10)

                SecureField("Enter Password", text: $loginViewModel.password)
                    .padding()
                    .background(Color(hex: "#18181b"))
                    .cornerRadius(10)
                    .foregroundColor(.white)
                    .accentColor(Color(hex: "#8ffcff"))
                    .padding(.horizontal)
                
                if loginViewModel.isLoading {
                    ProgressView("Logging In...")
                        .tint(Color(hex: "#8ffcff"))
                } else {
                    Button(action: {
                        loginViewModel.login()
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
                    .padding(.horizontal)
                }
                
                Text("Login to control the door. If you don't have the password, you can still view the info below.")
                    .font(.footnote)
                    .foregroundColor(Color(hex: "#a1a1aa"))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                // dismiss button
                Button(action: {
                    dismiss()
                }) {
                    Text("Dismiss")
                        .foregroundColor(.white)
                        .underline()
                }
                .padding(.top, 10)
            }
            .padding()
        }
        // If user logs in successfully, dismiss automatically
        .onChange(of: loginViewModel.isAuthenticated) { newValue in
            if newValue {
                dismiss()
            }
        }
        .alert(item: $loginViewModel.errorMessage) { error in
            Alert(title: Text("Error"),
                  message: Text(error.message),
                  dismissButton: .default(Text("OK")))
        }
    }
}
