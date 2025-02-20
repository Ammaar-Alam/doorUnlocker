import SwiftUI
import WebKit

struct PortfolioHomeView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.allowsBackForwardNavigationGestures = true
        let request = URLRequest(url: url)
        webView.load(request)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No dynamic updates needed.
    }
}

struct PortfolioHomeView_Previews: PreviewProvider {
    static var previews: some View {
        PortfolioHomeView(url: URL(string: "https://ammaaralam.com")!)
    }
}
