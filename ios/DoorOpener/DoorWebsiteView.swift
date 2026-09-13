import SwiftUI
import WebKit

struct DoorScreen: View {
    let client: DoorClient
    @AppStorage("simpleDoorControls") private var simpleControls = false

    var body: some View {
        if #available(iOS 26.0, *), !simpleControls {
            DoorWebsiteView()
        } else {
            DoorControlsView(client: client)
        }
    }
}

@available(iOS 26.0, *)
private struct DoorNavigation: WebPage.NavigationDeciding {
    func decidePolicy(for action: WebPage.NavigationAction, preferences: inout WebPage.NavigationPreferences) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if url.scheme == "https", url.host == DoorClient.origin.host { return .allow }
        if action.navigationType == .linkActivated, ["https", "http", "mailto"].contains(url.scheme ?? "") {
            await UIApplication.shared.open(url)
        }
        return .cancel
    }
}

@available(iOS 26.0, *)
private struct DoorWebsiteView: View {
    @State private var page = WebPage(navigationDecider: DoorNavigation())
    @State private var error: String?
    @State private var reload = 0
    @AppStorage("simpleDoorControls") private var simpleControls = false

    var body: some View {
        ZStack {
            WebView(page)
                .webViewBackForwardNavigationGestures(.disabled)
                .webViewLinkPreviews(.disabled)
            if let error {
                ContentUnavailableView {
                    Label("Website unavailable", systemImage: "wifi.slash")
                } description: {
                    Text(error)
                } actions: {
                    Button("Reload") { reload += 1 }
                    Button("Use simple controls") { simpleControls = true }
                }
                .background(Color(.systemBackground))
            }
        }
        .task(id: reload) {
            await DoorCookies.migrate()
            error = nil
            do { for try await _ in page.load(DoorClient.origin) {} }
            catch { if !Task.isCancelled { self.error = error.localizedDescription } }
        }
    }
}

@MainActor
enum DoorCookies {
    private static var store: WKHTTPCookieStore { WKWebsiteDataStore.default().httpCookieStore }

    private static func isDoorCookie(_ cookie: HTTPCookie) -> Bool {
        cookie.name == "authToken" && cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")) == DoorClient.origin.host
    }

    static func migrate() async {
        guard !UserDefaults.standard.bool(forKey: "webCookieMigration") else { return }
        let webCookies = await store.allCookies().filter(isDoorCookie)
        for cookie in HTTPCookieStorage.shared.cookies(for: DoorClient.origin) ?? [] where isDoorCookie(cookie) {
            if webCookies.allSatisfy({ ($0.expiresDate ?? .distantPast) < (cookie.expiresDate ?? .distantPast) }) {
                await store.setCookie(cookie)
            }
        }
        UserDefaults.standard.set(true, forKey: "webCookieMigration")
    }

    static func headers() async -> [String: String] {
        await migrate()
        return HTTPCookie.requestHeaderFields(with: await store.allCookies().filter(isDoorCookie))
    }

    static func receive(_ response: HTTPURLResponse) async {
        guard response.url?.scheme == "https", response.url?.host == DoorClient.origin.host else { return }
        let headers = response.allHeaderFields.reduce(into: [String: String]()) { result, entry in
            if let key = entry.key as? String, let value = entry.value as? String { result[key] = value }
        }
        for cookie in HTTPCookie.cookies(withResponseHeaderFields: headers, for: DoorClient.origin) where isDoorCookie(cookie) {
            await store.setCookie(cookie)
        }
    }
}
