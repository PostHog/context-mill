//
//  BurritoConsiderationClientApp.swift
//  BurritoConsiderationClient
//
//  Created by Danilo Campos on 2/5/26.
//

import SwiftUI
import PostHog

enum PostHogEnv: String {
    case apiKey = "POSTHOG_API_KEY"
    case host = "POSTHOG_HOST"

    var value: String {
        guard let value = ProcessInfo.processInfo.environment[rawValue] else {
            fatalError("Set \(rawValue) in the Xcode scheme environment variables.")
        }
        return value
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
