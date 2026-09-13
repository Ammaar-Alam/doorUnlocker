import SwiftUI
import WebKit

@Observable
final class DoorWebsite: NSObject, WKNavigationDelegate {
    static let origin = URL(string: "https://door.ammaaralam.com")!
    let webView = WKWebView()
    var error: String?

    override init() {
        super.init()
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 0.98, alpha: 1)
    }

    func reload() {
        error = nil
        webView.load(URLRequest(url: Self.origin))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        self.error = error.localizedDescription
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "https", url.host == Self.origin.host { decisionHandler(.allow) }
        else {
            decisionHandler(.cancel)
            if ["https", "http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        }
    }
}

struct DoorWebsiteView: UIViewRepresentable {
    let website: DoorWebsite
    func makeUIView(context: Context) -> WKWebView { website.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
