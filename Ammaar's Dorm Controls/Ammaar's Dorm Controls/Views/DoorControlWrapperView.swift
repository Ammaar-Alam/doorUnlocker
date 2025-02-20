import SwiftUI

struct DoorControlWrapperView: View {
    var body: some View {
        NavigationView {
            // Uses your existing door control ContentView.
            ContentView(pendingShortcutAction: .constant(nil))
                .navigationBarTitle("Door Control", displayMode: .inline)
        }
    }
}

struct DoorControlWrapperView_Previews: PreviewProvider {
    static var previews: some View {
        DoorControlWrapperView()
    }
}
