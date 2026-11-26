//
//  BurritoView.swift
//  BurritoConsiderationClient
//

import SwiftUI
import PostHog

struct BurritoView: View {
    @Environment(UserState.self) private var userState
    @State private var showConfirmation = false

    var body: some View {
        VStack(spacing: 24) {
            Text("Take a moment to truly consider the potential of burritos.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Text("🌯")
                .font(.system(size: 80))

            Button("I Have Considered the Burrito Potential") {
                // Skip capture when no user is signed in rather than falling back to "unknown".
                guard userState.isLoggedIn else {
                    return
                }

                let count = userState.incrementBurritoConsiderations()

                // Keep PII like username out of event properties since identify sets person properties.
                PostHogSDK.shared.capture("burrito_considered", properties: [
                    "total_considerations": count,
                ])

                showConfirmation = true
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    showConfirmation = false
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            if showConfirmation {
                Text("Thank you for your consideration! Count: \(userState.burritoConsiderations)")
                    .foregroundStyle(.green)
                    .transition(.opacity)
            }

            Text("Total considerations: \(userState.burritoConsiderations)")
                .font(.title2)
                .padding(.top)
        }
        .padding()
        .animation(.default, value: showConfirmation)
        .navigationTitle("Burrito Consideration Zone")
        .postHogScreenView("Burrito")
    }
}
