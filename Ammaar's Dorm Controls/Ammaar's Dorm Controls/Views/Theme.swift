import SwiftUI

struct AppTheme {
    // Core colors from your portfolio scheme
    static let background = Color(hex: "#0a0a0a")
    static let cardBg = Color(hex: "#18181b")
    static let text = Color(hex: "#ffffff")
    static let textSecondary = Color(hex: "#a1a1aa")
    static let border = Color(hex: "#27272a")
    static let primary = Color(hex: "#8ffcff") // primary accent
    static let gradientStart = Color(hex: "#8ffcff")
    static let gradientEnd = Color(hex: "#4dc6ff")
    
    static let highlightGradient = LinearGradient(
        gradient: Gradient(colors: [gradientStart, gradientEnd]),
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
}

// Convenience init for Color from hex
extension Color {
    init(hex: String) {
        let trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let hexString = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
        var rgb: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgb)
        
        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0
        
        self.init(red: r, green: g, blue: b)
    }
}

// A modifier for gradient text
struct GradientText: ViewModifier {
    func body(content: Content) -> some View {
        content
            .overlay(AppTheme.highlightGradient)
            .mask(content)
    }
}

extension View {
    func gradientText() -> some View {
        self.modifier(GradientText())
    }
}
