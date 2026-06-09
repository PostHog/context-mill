//
//  UserState.swift
//  BurritoConsiderationClient
//

import Foundation
import PostHog

@Observable
class UserState {
    var username: String?
    var burritoConsiderations: Int = 0

    var isLoggedIn: Bool {
        username != nil
    }

    func login(username: String, password: String) -> Bool {
        // In a real app, validate credentials against a backend
        guard !username.isEmpty, !password.isEmpty else {
            return false
        }

        self.username = username
        self.burritoConsiderations = 0

        // PostHog: Identify user on login
        PostHogSDK.shared.identify(username, userProperties: [
            "username": username,
        ])

        // PostHog: Capture login event
        PostHogSDK.shared.capture("user_logged_in", properties: [
            "username": username,
        ])

        return true
    }

    func logout() {
        // PostHog: Capture logout event before reset
        PostHogSDK.shared.capture("user_logged_out")
        PostHogSDK.shared.reset()

        username = nil
        burritoConsiderations = 0
    }
}
