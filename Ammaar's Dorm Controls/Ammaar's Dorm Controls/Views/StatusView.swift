import SwiftUI

struct StatusView: View {
    let isDoorOpen: Bool
    
    var body: some View {
        HStack {
            Image(systemName: isDoorOpen ? "door.left.hand.open" : "door.left.hand.closed")
                .font(.system(size: 50))
                .foregroundColor(isDoorOpen ? .red : .green)
            
            Text(isDoorOpen ? "Door is Open" : "Door is Closed")
                .font(.title2)
                .fontWeight(.semibold)
        }
        .padding()
        .background(Color(.systemBackground)) // Uses SwiftUI's systemBackground
        .cornerRadius(15)
        .shadow(radius: 5)
    }
}