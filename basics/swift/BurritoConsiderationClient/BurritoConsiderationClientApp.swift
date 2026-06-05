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
//
// We read an optional override from the environment first so you can point the
// app at a different project during local development via the Xcode scheme's Run
// environment variables. Note that scheme environment variables are ONLY present
// when launching from Xcode (debug/simulator) — they are absent in Archive /
// Release builds — so a hardcoded fallback is required for distribution builds.
enum PostHogEnv: String {
    case apiKey = "POSTHOG_PROJECT_TOKEN"
    case host = "POSTHOG_HOST"

    var fallback: String {
        switch self {
        case .apiKey: return "<your-project-token>"
        case .host: return "https://us.i.posthog.com"
        }
    }

    var value: String {
        ProcessInfo.processInfo.environment[rawValue] ?? fallback
    }
}

@main
struct BurritoConsiderationClientApp: App {
    @State private var userState = UserState()

    init() {
        let config = PostHogConfig(apiKey: PostHogEnv.apiKey.value, host: PostHogEnv.host.value)
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
