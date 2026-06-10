//
//  ProfileView.swift
//  BurritoConsiderationClient
//

import SwiftUI
import PostHog

struct ProfileView: View {
    @Environment(UserState.self) private var userState

    private var journeyMessage: String {
        switch userState.burritoConsiderations {
        case 0:
            "You haven't considered any burritos yet. Visit the Burrito Consideration page to start!"
        case 1:
            "You've considered the burrito potential once. Keep going!"
        case 2...4:
            "You're getting the hang of burrito consideration!"
        case 5...9:
            "You're becoming a burrito consideration expert!"
        default:
            "You are a true burrito consideration master!"
        }
    }

    var body: some View {
        Form {
            Section("Your Information") {
                LabeledContent("Username", value: userState.username ?? "—")
                LabeledContent("Burrito Considerations", value: "\(userState.burritoConsiderations)")
            }

            Section("Your Burrito Journey") {
                Text(journeyMessage)
            }

            Section("Diagnostics") {
                Button("Trigger Test Error") {
                    let error = NSError(
                        domain: "com.posthog.BurritoConsiderationClient",
                        code: 42,
                        userInfo: [NSLocalizedDescriptionKey: "Test error triggered by user"]
                    )

                    // PostHog: Capture exception for error tracking
                    PostHogSDK.shared.capture("test_error_triggered", properties: [
                        "error_type": "test",
                        "error_message": error.localizedDescription,
                        "username": userState.username ?? "unknown",
                    ])
                }
            }

            Section {
                Button("Log Out", role: .destructive) {
                    userState.logout()
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Profile")
        .onAppear {
            // PostHog: Track profile view
            PostHogSDK.shared.capture("profile_viewed", properties: [
                "username": userState.username ?? "unknown",
            ])
        }
    }
}
