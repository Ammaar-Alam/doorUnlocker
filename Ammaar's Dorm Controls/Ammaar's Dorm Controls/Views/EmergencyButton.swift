import SwiftUI

struct EmergencyButton: View {
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text("Emergency Close / Untangle")
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.red)
                .cornerRadius(10)
        }
    }
}