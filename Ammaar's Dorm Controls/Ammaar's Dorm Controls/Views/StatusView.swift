import SwiftUI

struct StatusView: View {
    let isDoorOpen: Bool
    
    var body: some View {
        HStack(spacing: 20) {
            Image(systemName: isDoorOpen ? "door.left.hand.open" : "door.left.hand.closed")
                .font(.system(size: 50))
                .foregroundColor(isDoorOpen ? .red : .green)
            
            Text(isDoorOpen ? "Door is Open" : "Door is Closed")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.text)
        }
        .padding()
        .background(AppTheme.cardBg)
        .cornerRadius(15)
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(AppTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 8)
    }
}
