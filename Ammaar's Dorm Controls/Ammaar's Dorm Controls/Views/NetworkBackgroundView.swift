import SwiftUI

struct NetworkBackgroundView: View {
    @State private var nodes = [Node]()
    @State private var lastUpdateTime: Date = Date()
    @State private var timerCancellable: Any?
    
    let updateInterval = 1.0/30.0 // ~30 FPS
    let nodeCount = 15
    let nodeMaxDistance: CGFloat = 170 // slightly larger for more connections
    let nodeRadius: CGFloat = 6
    
    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(AppTheme.background))
            
            drawConnections(nodes: nodes, in: &context, size: size)
            drawNodes(nodes: nodes, in: &context)
        }
        .onAppear {
            if nodes.isEmpty {
                nodes = (0..<nodeCount).map { _ in
                    Node(position: CGPoint(x: CGFloat.random(in: 0...300),
                                           y: CGFloat.random(in: 0...600)))
                }
            }
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
        
        DispatchQueue.main.async {
            // Approx screen size:
            let screenSize = UIApplication.shared.windows.first?.bounds.size ?? CGSize(width: 300, height: 600)
            for i in 0..<nodes.count {
                // Using a slightly faster 'speed' to result in slower movement (because dt/speed gets smaller)
                // Actually to slow down movement, we can increase 'speed' so dt/speed is smaller
                // Also reduced initial velocities in Node to -0.1...0.1
                nodes[i].update(size: screenSize, dt: dt, speed: 0.002)
            }
        }
    }
    
    func drawNodes(nodes: [Node], in context: inout GraphicsContext) {
        for node in nodes {
            var shape = Path()
            shape.addArc(center: node.position, radius: nodeRadius, startAngle: .zero, endAngle: .degrees(360), clockwise: false)
            
            // Fill node
            context.fill(shape, with: .color(AppTheme.primary.opacity(0.9)))
            
            // Strong glow: multiple layered blurs
            context.drawLayer { innerContext in
                innerContext.addFilter(.blur(radius: 15))
                innerContext.fill(shape, with: .color(AppTheme.primary.opacity(0.5)))
            }
            
            context.drawLayer { innerContext in
                innerContext.addFilter(.blur(radius: 30))
                innerContext.fill(shape, with: .color(AppTheme.primary.opacity(0.2)))
            }
        }
    }
    
    func drawConnections(nodes: [Node], in context: inout GraphicsContext, size: CGSize) {
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
                    
                    // Base line
                    context.stroke(line, with: .color(AppTheme.primary.opacity(0.3 * alpha)), style: StrokeStyle(lineWidth: 2))
                    
                    // Glow effect line
                    context.drawLayer { innerContext in
                        innerContext.addFilter(.blur(radius: 10))
                        innerContext.stroke(line, with: .color(AppTheme.primary.opacity(0.15 * alpha)), style: StrokeStyle(lineWidth: 3))
                    }
                }
            }
        }
    }
}

struct Node {
    var position: CGPoint
    // Slower speeds: from -0.1...0.1 instead of -0.5
    var vx: CGFloat = CGFloat.random(in: -0.1...0.1)
    var vy: CGFloat = CGFloat.random(in: -0.1...0.1)
    
    mutating func update(size: CGSize, dt: Double, speed: Double) {
        position.x += vx * CGFloat(dt / speed)
        position.y += vy * CGFloat(dt / speed)
        
        if position.x < -50 { position.x = size.width + 50 }
        if position.x > size.width + 50 { position.x = -50 }
        if position.y < -50 { position.y = size.height + 50 }
        if position.y > size.height + 50 { position.y = -50 }
        
        vx += CGFloat.random(in: -0.003...0.003)
        vy += CGFloat.random(in: -0.003...0.003)
        let maxSpeed: CGFloat = 0.3
        let speedMag = sqrt(vx*vx + vy*vy)
        if speedMag > maxSpeed {
            vx = (vx / speedMag) * maxSpeed
            vy = (vy / speedMag) * maxSpeed
        }
    }
}
