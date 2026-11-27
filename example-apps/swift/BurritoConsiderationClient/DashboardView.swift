//
//  DashboardView.swift
//  BurritoConsiderationClient
//

import SwiftUI
import PostHog

struct DashboardView: View {
    @Environment(UserState.self) private var userState

    var body: some View {
        VStack(spacing: 20) {
            if let username = userState.username {
                Text("Welcome back, \(username)!")
                    .font(.largeTitle)
                    .padding(.top, 40)
            }

            Text("You are logged in. Feel free to explore:")
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 12) {
                Label("Consider the potential of burritos", systemImage: "fork.knife")
                Label("View your profile and statistics", systemImage: "person.circle")
            }
            .padding()

            Spacer()
        }
        .padding()
        .navigationTitle("Home")
        .postHogScreenView("Dashboard")
    }
}
