//
//  BurritoConsiderationClientApp.swift
//  BurritoConsiderationClient
//
//  Created by Danilo Campos on 2/5/26.
//

import OSLog
import PostHog
import SwiftUI

// Set your "phc_..." project token here so it ships in the app binary per iOS best practice.
// Leave this nil until configured rather than passing a placeholder string to PostHogConfig.
private let posthogProjectToken: String? = nil
private let posthogHost = "https://us.i.posthog.com"

@main
struct BurritoConsiderationClientApp: App {
    @State private var userState: UserState

    init() {
        Self.configurePostHog()
        _userState = State(initialValue: UserState())
    }

    private static func configurePostHog() {
        let envToken = ProcessInfo.processInfo.environment["POSTHOG_PROJECT_TOKEN"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let configuredToken = (envToken?.isEmpty == false ? envToken : nil)
            ?? posthogProjectToken?.trimmingCharacters(in: .whitespacesAndNewlines)

        let envHost = ProcessInfo.processInfo.environment["POSTHOG_HOST"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let host = (envHost?.isEmpty == false ? envHost : nil) ?? posthogHost

        if let token = configuredToken, !token.isEmpty {
            let config = PostHogConfig(projectToken: token, host: host)
            config.captureApplicationLifecycleEvents = true
            config.errorTrackingConfig.autoCapture = true
            #if DEBUG
            config.debug = true
            #endif
            PostHogSDK.shared.setup(config)
        } else {
            #if DEBUG
            Logger(subsystem: Bundle.main.bundleIdentifier ?? "BurritoConsiderationClient", category: "PostHog")
                .error("posthogProjectToken variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once posthogProjectToken is configured")
            #endif
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(userState)
        }
    }
}
