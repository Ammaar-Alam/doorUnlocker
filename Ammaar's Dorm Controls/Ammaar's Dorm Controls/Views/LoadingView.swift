import SwiftUI

struct LoadingView: View {
    let message: String
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
            Text(message)
                .font(.headline)
                .foregroundColor(.primary)
        }
        .padding()
    }
}
