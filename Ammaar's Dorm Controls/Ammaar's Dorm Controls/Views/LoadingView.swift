import SwiftUI

struct LoadingView: View {
    let message: String
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .tint(AppTheme.primary)
            Text(message)
                .font(.headline)
                .foregroundColor(AppTheme.text)
        }
        .padding()
    }
}
