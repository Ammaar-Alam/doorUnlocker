import SwiftUI

struct DoorControlView: View {
    @ObservedObject var viewModel: DoorControlViewModel
    
    var body: some View {
        VStack(spacing: 20) {
            Toggle(isOn: $viewModel.isDoorOpen) {
                Text(viewModel.isDoorOpen ? "Close Door" : "Open Door")
                    .font(.headline)
                    .foregroundColor(AppTheme.text)
            }
            // Color toggle: red if open, green if closed
            .toggleStyle(SwitchToggleStyle(tint: viewModel.isDoorOpen ? .red : .green))
            .disabled(viewModel.isLoading)
            .onChange(of: viewModel.isDoorOpen) { newValue in
                viewModel.toggleDoor(open: newValue)
            }
            
            EmergencyButton(action: viewModel.emergencyClose)
                .disabled(viewModel.isLoading)
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
}
