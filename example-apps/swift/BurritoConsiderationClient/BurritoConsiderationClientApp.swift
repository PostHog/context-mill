//
//  BurritoConsiderationClientApp.swift
//  BurritoConsiderationClient
//
//  Created by Danilo Campos on 2/5/26.
//

import SwiftUI
import PostHog

// PostHog configuration.
//
// The project token is a PUBLIC client-side key — it is designed to ship in the
// app binary, so hardcoding it here is safe and is the recommended approach for
// iOS. Replace the placeholder below with your project token from
// https://app.posthog.com/project/settings.
private let posthogProjectToken = "<your-project-token>"
private let posthogHost = "https://us.i.posthog.com"

@main
struct BurritoConsiderationClientApp: App {
    @State private var userState = UserState()

    init() {
        let config = PostHogConfig(apiKey: posthogProjectToken, host: posthogHost)
        config.captureApplicationLifecycleEvents = true
        config.debug = true
        PostHogSDK.shared.setup(config)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(userState)
        }
    }
}
