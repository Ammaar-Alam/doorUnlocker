import SwiftUI

struct NetworkBackgroundView: View {
    @State private var nodes = [Node]()
    @State private var lastUpdateTime: Date = Date()
    @State private var timerCancellable: Any?
    
    let updateInterval = 1.0/30.0 // ~30 FPS
    
    var body: some View {
        Canvas { context, size in
            // Fill background with black
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(AppTheme.background))
            
            // Draw lines and nodes
            drawConnections(nodes: nodes, in: &context, size: size)
            drawNodes(nodes: nodes, in: &context)
        }
        .onAppear {
            // Initialize nodes once
            if nodes.isEmpty {
                // Create nodes
                nodes = (0..<15).map { _ in
                    Node(position: CGPoint(x: CGFloat.random(in: 0...300),
                                           y: CGFloat.random(in: 0...600)))
                }
            }
            // Start a timer to update nodes
            let timer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: true) { _ in
                updateNodes()
            }
            RunLoop.current.add(timer, forMode: .common)
            timerCancellable = timer
        }
        .onDisappear {
            if let timer = timerCancellable as? Timer {
                timer.invalidate()
            }
        }
    }
    
    func updateNodes() {
        let currentTime = Date()
        let dt = currentTime.timeIntervalSince(lastUpdateTime)
        lastUpdateTime = currentTime
        
        // We must do computations on main thread
        DispatchQueue.main.async {
            if let firstSize = UIApplication.shared.windows.first?.bounds.size {
                // Using screen size as approximate area
                for i in 0..<nodes.count {
                    nodes[i].update(size: firstSize, dt: dt, speed: 0.0005)
                }
            }
        }
    }
    
    func drawNodes(nodes: [Node], in context: inout GraphicsContext) {
        for node in nodes {
            var shape = Path()
            shape.addArc(center: node.position, radius: 4, startAngle: .zero, endAngle: .degrees(360), clockwise: false)
            context.fill(shape, with: .color(AppTheme.primary.opacity(0.7)))
            
            // Glow effect around node
            context.drawLayer { innerContext in
                innerContext.addFilter(.blur(radius: 8))
                innerContext.fill(shape, with: .color(AppTheme.primary.opacity(0.3)))
            }
        }
    }
    
    func drawConnections(nodes: [Node], in context: inout GraphicsContext, size: CGSize) {
        let nodeMaxDistance: CGFloat = 150
        for i in 0..<nodes.count {
            for j in (i+1)..<nodes.count {
                let dx = nodes[i].position.x - nodes[j].position.x
                let dy = nodes[i].position.y - nodes[j].position.y
                let dist = sqrt(dx*dx + dy*dy)
                if dist < nodeMaxDistance {
                    let alpha = 1.0 - dist / nodeMaxDistance
                    var line = Path()
                    line.move(to: nodes[i].position)
                    line.addLine(to: nodes[j].position)
                    
                    context.stroke(line, with: .color(AppTheme.primary.opacity(0.2 * alpha)), style: StrokeStyle(lineWidth: 1))
                    
                    context.drawLayer { innerContext in
                        innerContext.addFilter(.blur(radius: 4))
                        innerContext.stroke(line, with: .color(AppTheme.primary.opacity(0.05 * alpha)), style: StrokeStyle(lineWidth: 2))
                    }
                }
            }
        }
    }
}

struct Node {
    var position: CGPoint
    var vx: CGFloat = CGFloat.random(in: -0.5...0.5)
    var vy: CGFloat = CGFloat.random(in: -0.5...0.5)
    
    mutating func update(size: CGSize, dt: Double, speed: Double) {
        position.x += vx * CGFloat(dt / speed)
        position.y += vy * CGFloat(dt / speed)
        
        if position.x < -50 { position.x = size.width + 50 }
        if position.x > size.width + 50 { position.x = -50 }
        if position.y < -50 { position.y = size.height + 50 }
        if position.y > size.height + 50 { position.y = -50 }
        
        vx += CGFloat.random(in: -0.01...0.01)
        vy += CGFloat.random(in: -0.01...0.01)
        let maxSpeed: CGFloat = 0.1
        let speedMag = sqrt(vx*vx + vy*vy)
        if speedMag > maxSpeed {
            vx = (vx / speedMag) * maxSpeed
            vy = (vy / speedMag) * maxSpeed
        }
    }
}
