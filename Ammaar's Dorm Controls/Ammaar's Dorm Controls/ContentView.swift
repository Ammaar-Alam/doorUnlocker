import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = DoorControlViewModel()

    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                StatusView(isDoorOpen: viewModel.isDoorOpen)
                
                DoorControlView(viewModel: viewModel)
                
                if viewModel.isLoading {
                    ProgressView("Processing...")
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Ammaar's Dorm Door")
            .onAppear {
                viewModel.fetchStatus()
            }
            .alert(item: $viewModel.errorMessage) { error in
                Alert(title: Text("Error"), message: Text(error.message), dismissButton: .default(Text("OK")))
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
