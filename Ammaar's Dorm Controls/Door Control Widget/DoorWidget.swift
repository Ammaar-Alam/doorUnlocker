import WidgetKit
import SwiftUI
import AppIntents
import Foundation

@available(iOS 18.0, *)
struct DoorStatusEntry: TimelineEntry {
    let date: Date
    let isDoorOpen: Bool
    let configuration: ConfigurationAppIntent
}

@available(iOS 18.0, *)
struct ConfigurationAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Configuration"
    static var description = IntentDescription("Widget Configuration")
    
    init() {}
}

@available(iOS 18.0, *)
struct DoorStatusProvider: AppIntentTimelineProvider {
    typealias Entry = DoorStatusEntry
    typealias Intent = ConfigurationAppIntent
    
    func placeholder(in context: Context) -> DoorStatusEntry {
        DoorStatusEntry(date: Date(), isDoorOpen: false, configuration: ConfigurationAppIntent())
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> DoorStatusEntry {
        DoorStatusEntry(date: Date(), isDoorOpen: false, configuration: configuration)
    }

    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<DoorStatusEntry> {
        let currentStatus = await fetchCurrentDoorStatus()
        let entry = DoorStatusEntry(date: Date(), isDoorOpen: currentStatus, configuration: configuration)
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30)))
    }

    private func fetchCurrentDoorStatus() async -> Bool {
        guard let url = URL(string: "\(APIConfig.baseURL)/status") else {
            return false
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse, 200..<300 ~= httpResponse.statusCode else {
                return false
            }
            let status = try JSONDecoder().decode(DoorStatus.self, from: data)
            return status.doorOpen
        } catch {
            return false
        }
    }
}

@available(iOS 18.0, *)
struct DoorWidgetEntryView: View {
    var entry: DoorStatusEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            AppTheme.background
                .ignoresSafeArea()

            VStack(spacing: 8) {
                HStack {
                    Text("Dorm Door")
                        .font(.headline)
                        .foregroundColor(AppTheme.text)
                    Spacer()
                }

                HStack {
                    Image(systemName: entry.isDoorOpen ? "door.left.hand.open" : "door.left.hand.closed")
                        .font(.system(size: family == .systemSmall ? 24 : 30))
                        .foregroundColor(entry.isDoorOpen ? .red : .green)
                    Text(entry.isDoorOpen ? "Open" : "Closed")
                        .font(family == .systemSmall ? .title3 : .title2)
                        .fontWeight(.semibold)
                        .foregroundColor(AppTheme.text)
                }

                if family != .systemSmall {
                    HStack(spacing: 12) {
                        Button(intent: OpenDoorIntent()) {
                            Text("Open")
                                .font(.subheadline)
                                .foregroundColor(AppTheme.text)
                                .padding(6)
                                .background(AppTheme.cardBg)
                                .cornerRadius(6)
                        }
                        .buttonStyle(.plain)

                        Button(intent: CloseDoorIntent()) {
                            Text("Close")
                                .font(.subheadline)
                                .foregroundColor(AppTheme.text)
                                .padding(6)
                                .background(AppTheme.cardBg)
                                .cornerRadius(6)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding()
        }
        .containerBackground(AppTheme.background, for: .widget)
    }
}

@available(iOS 18.0, *)
struct DoorWidget: Widget {
    private let supportedFamilies: [WidgetFamily] = [
        .systemSmall,
        .systemMedium,
        .accessoryCircular,
        .accessoryRectangular
    ]
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "DoorWidget",
                             intent: ConfigurationAppIntent.self,
                             provider: DoorStatusProvider()) { entry in
            DoorWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Dorm Door")
        .description("View and control your dorm door from your home screen.")
        .supportedFamilies(supportedFamilies)
        .contentMarginsDisabled()
    }
}

@available(iOS 18.0, *)
struct DoorWidgetBundle: WidgetBundle {
    var body: some Widget {
        DoorWidget()
    }
}

// Preview provider for SwiftUI canvas
@available(iOS 18.0, *)
struct DoorWidget_Previews: PreviewProvider {
    static var previews: some View {
        DoorWidgetEntryView(entry: DoorStatusEntry(
            date: Date(),
            isDoorOpen: false,
            configuration: ConfigurationAppIntent()
        ))
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
