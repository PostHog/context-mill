//
//  ContentView.swift
//  BurritoConsiderationClient
//
//  Created by Danilo Campos on 2/5/26.
//

import SwiftUI

enum Screen: CaseIterable, Identifiable {
    case dashboard, burrito, profile

    var id: Self { self }

    var title: String {
        switch self {
        case .dashboard: "Home"
        case .burrito: "Burrito"
        case .profile: "Profile"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: "house"
        case .burrito: "fork.knife"
        case .profile: "person.circle"
        }
    }
}

struct ContentView: View {
    @Environment(UserState.self) private var userState
    @State private var selectedScreen: Screen? = .dashboard

    var body: some View {
        if userState.isLoggedIn {
            NavigationSplitView {
                List(Screen.allCases, selection: $selectedScreen) { screen in
                    Label(screen.title, systemImage: screen.icon)
                }
                .navigationTitle("Menu")
            } detail: {
                if let selectedScreen {
                    switch selectedScreen {
                    case .dashboard:
                        DashboardView()
                    case .burrito:
                        BurritoView()
                    case .profile:
                        ProfileView()
                    }
                } else {
                    Text("Select an item from the sidebar")
                        .foregroundStyle(.secondary)
                }
            }
        } else {
            NavigationStack {
                LoginView()
            }
        }
    }
}
