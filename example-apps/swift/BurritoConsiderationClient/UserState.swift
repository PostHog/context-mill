//
//  UserState.swift
//  BurritoConsiderationClient
//

import Foundation
import PostHog

private struct StoredUser: Codable {
    let id: String
    var username: String
    var burritoConsiderations: Int
}

@Observable
class UserState {
    private static let usersStorageKey = "posthog_example_users"
    private static let currentUsernameKey = "posthog_example_current_username"

    var userId: String?
    var username: String?
    var burritoConsiderations: Int = 0

    var isLoggedIn: Bool {
        userId != nil && username != nil
    }

    init() {
        restoreSession()
    }

    private func restoreSession() {
        guard let savedUsername = UserDefaults.standard.string(forKey: Self.currentUsernameKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !savedUsername.isEmpty
        else {
            return
        }

        let users = Self.loadStoredUsers()
        guard let stored = users[savedUsername.lowercased()] else {
            return
        }

        userId = stored.id
        username = stored.username
        burritoConsiderations = stored.burritoConsiderations

        // Re-identify restored sessions with the persisted UUID so events after relaunch match login.
        PostHogSDK.shared.identify(stored.id, userProperties: [
            "username": stored.username,
        ])
    }

    func login(username: String, password: String) -> Bool {
        let trimmedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)

        // Reject blank credentials before persisting state or calling identify and capture,
        // rather than falling back to a shared placeholder identity.
        guard !trimmedUsername.isEmpty, !trimmedPassword.isEmpty else {
            return false
        }

        var users = Self.loadStoredUsers()
        let key = trimmedUsername.lowercased()
        let isNewUser = users[key] == nil
        var record = users[key] ?? StoredUser(
            id: UUID().uuidString,
            username: trimmedUsername,
            burritoConsiderations: 0
        )
        record.username = trimmedUsername
        users[key] = record
        Self.saveStoredUsers(users)
        UserDefaults.standard.set(trimmedUsername, forKey: Self.currentUsernameKey)

        self.userId = record.id
        self.username = record.username
        self.burritoConsiderations = record.burritoConsiderations

        // Identify with a stable UUID and pass username in person properties, never as distinctId.
        PostHogSDK.shared.identify(record.id, userProperties: [
            "username": record.username,
        ])

        // Keep PII like username out of capture event properties.
        PostHogSDK.shared.capture("user_logged_in", properties: [
            "login_method": "username",
            "is_new_user": isNewUser,
        ])

        return true
    }

    func incrementBurritoConsiderations() -> Int {
        guard let currentUsername = username else {
            return burritoConsiderations
        }

        burritoConsiderations += 1
        var users = Self.loadStoredUsers()
        let key = currentUsername.lowercased()
        if var record = users[key] {
            record.burritoConsiderations = burritoConsiderations
            users[key] = record
            Self.saveStoredUsers(users)
        }
        return burritoConsiderations
    }

    func logout() {
        guard isLoggedIn else {
            return
        }

        // Capture logout event before reset on an authenticated session.
        PostHogSDK.shared.capture("user_logged_out")
        PostHogSDK.shared.reset()

        UserDefaults.standard.removeObject(forKey: Self.currentUsernameKey)
        userId = nil
        username = nil
        burritoConsiderations = 0
    }

    private static func loadStoredUsers() -> [String: StoredUser] {
        guard let data = UserDefaults.standard.data(forKey: usersStorageKey),
              let decoded = try? JSONDecoder().decode([String: StoredUser].self, from: data)
        else {
            return [:]
        }
        return decoded
    }

    private static func saveStoredUsers(_ users: [String: StoredUser]) {
        guard let data = try? JSONEncoder().encode(users) else {
            return
        }
        UserDefaults.standard.set(data, forKey: usersStorageKey)
    }
}
