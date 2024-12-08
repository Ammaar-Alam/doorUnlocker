import WidgetKit
import SwiftUI
import Intents

struct DoorStatusEntry: TimelineEntry {
    let date: Date
    let isDoorOpen: Bool
}

struct DoorStatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> DoorStatusEntry {
        DoorStatusEntry(date: Date(), isDoorOpen: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (DoorStatusEntry) -> ()) {
        completion(DoorStatusEntry(date: Date(), isDoorOpen: false))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DoorStatusEntry>) -> ()) {
        // Fetch door status
        NetworkManager.shared.fetchDoorStatus { result in
            let isOpen: Bool
            switch result {
            case .success(let status):
                isOpen = status.doorOpen
            case .failure(_):
                isOpen = false
            }

            let entry = DoorStatusEntry(date: Date(), isDoorOpen: isOpen)
            let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60)))
            completion(timeline)
        }
    }
}

struct DoorWidgetEntryView: View {
    var entry: DoorStatusEntry

    var body: some View {
        ZStack {
            AppTheme.background
            VStack(spacing: 10) {
                Text("Door Status")
                    .font(.headline)
                    .foregroundColor(AppTheme.text)
                HStack {
                    Image(systemName: entry.isDoorOpen ? "door.left.hand.open" : "door.left.hand.closed")
                        .font(.system(size: 30))
                        .foregroundColor(entry.isDoorOpen ? .red : .green)
                    Text(entry.isDoorOpen ? "Open" : "Closed")
                        .foregroundColor(AppTheme.text)
                        .font(.title2)
                }

                if #available(iOS 16.0, *) {
                    if entry.isDoorOpen {
                        AppIntentButton(intent: DoorActionIntent(action: .close)) {
                            Label("Close Door", systemImage: "lock")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(AppTheme.primary)
                    } else {
                        AppIntentButton(intent: DoorActionIntent(action: .open)) {
                            Label("Open Door", systemImage: "arrow.up.circle")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(AppTheme.primary)
                    }
                } else {
                    Text("Update iOS to interact")
                        .font(.footnote)
                        .foregroundColor(AppTheme.textSecondary)
                }
            }
            .padding()
        }
    }
}

@main
struct DoorWidget: Widget {
    let kind: String = "DoorWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DoorStatusProvider()) { entry in
            DoorWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Door Status")
        .description("View and control your door directly from your home screen widget.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
