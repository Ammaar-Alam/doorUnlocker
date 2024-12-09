import SwiftUI

struct EmergencyButton: View {
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text("Force Close / Untangle")
                .font(.headline)
                .foregroundColor(AppTheme.background)
                .padding()
                .frame(maxWidth: .infinity)
                .background(AppTheme.primary)
                .cornerRadius(10)
                .shadow(color: AppTheme.primary.opacity(0.4), radius: 10)
        }
    }
}
