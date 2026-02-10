//
//  LoginView.swift
//  BurritoConsiderationClient
//

import SwiftUI

struct LoginView: View {
    @Environment(UserState.self) private var userState
    @State private var username = ""
    @State private var password = ""
    @State private var showError = false

    var body: some View {
        Form {
            Section("Login") {
                TextField("Username", text: $username)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif
                    .autocorrectionDisabled()

                SecureField("Password", text: $password)
            }

            Section {
                Button("Log In") {
                    if !userState.login(username: username, password: password) {
                        showError = true
                    }
                }
                .disabled(username.isEmpty || password.isEmpty)
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Burrito Consideration")
        .alert("Login Failed", isPresented: $showError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Please enter a valid username and password.")
        }
    }
}
