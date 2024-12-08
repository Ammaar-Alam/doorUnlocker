import SwiftUI

struct LoginView: View {
    @EnvironmentObject var loginViewModel: LoginViewModel
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Please Log In")
                .font(.largeTitle)
                .bold()
            
            SecureField("Enter Password", text: $loginViewModel.password)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .padding(.horizontal)
            
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
                        .padding(.horizontal)
                }
            }
        }
        .padding()
        .alert(item: $loginViewModel.errorMessage) { error in
            Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
        }
    }
}
