import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: DoorControlViewModel
    @EnvironmentObject var loginViewModel: LoginViewModel
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                StatusView(isDoorOpen: viewModel.isDoorOpen)
                
                DoorControlView(viewModel: viewModel)
                
                if viewModel.isLoading {
                    ProgressView("Processing...")
                        .padding()
                }
                
                Spacer()
                
                if loginViewModel.authRequired {
                    Button("Logout") {
                        loginViewModel.logout()
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.blue)
                    .cornerRadius(10)
                    .padding(.bottom, 20)
                }
            }
            .padding()
            .navigationTitle("My Dorm Door")
            .onAppear {
                viewModel.fetchStatus()
            }
            .alert(item: $viewModel.errorMessage) { error in
                Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
            }
        }
    }
}
