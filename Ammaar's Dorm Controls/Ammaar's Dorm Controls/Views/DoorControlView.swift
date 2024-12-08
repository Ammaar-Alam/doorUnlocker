import SwiftUI
import UIKit

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
            .disabled(viewModel.isLoading) // door control disabled while loading
            .onChange(of: viewModel.isDoorOpen) { newValue in
                // Toggle door with the requested state
                viewModel.toggleDoor(open: newValue)
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
