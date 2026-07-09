import SwiftUI
import PostHog

struct ContentView: View {
    @State private var burritosSold = 0

    var body: some View {
        VStack(spacing: 16) {
            Text("🌯 Burrito Stand")
                .font(.largeTitle)
            Text("Burritos sold: \(burritosSold)")
                .font(.title2)
            Button("Sell a burrito") {
                burritosSold += 1
                PostHogSDK.shared.capture("burrito_sold", properties: [
                    "total_sold": burritosSold,
                ])
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .postHogScreenView("BurritoStand")
    }
}

#Preview {
    ContentView()
}
