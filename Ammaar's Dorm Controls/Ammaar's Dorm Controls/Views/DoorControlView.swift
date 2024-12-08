import SwiftUI

struct DoorControlView: View {
    @ObservedObject var viewModel: DoorControlViewModel
    
    var body: some View {
        VStack(spacing: 20) {
            Toggle(isOn: $viewModel.isDoorOpen) {
                Text(viewModel.isDoorOpen ? "Close Door" : "Open Door")
                    .font(.headline)
                    .foregroundColor(.primary)
            }
            .toggleStyle(SwitchToggleStyle(tint: .blue))
            .disabled(viewModel.isLoading)
            .onChange(of: viewModel.isDoorOpen) { _ in
                viewModel.toggleDoor()
            }
            
            EmergencyButton(action: viewModel.emergencyClose)
                .disabled(viewModel.isLoading)
        }
        .padding()
        .background(Color(UIColor.systemBackground))
        .cornerRadius(15)
        .shadow(radius: 5)
    }
}
