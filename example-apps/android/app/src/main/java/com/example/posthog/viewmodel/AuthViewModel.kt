package com.example.posthog.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.posthog.data.User
import com.example.posthog.data.UserRepository
import com.posthog.PostHog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = UserRepository(application)

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    init {
        loadCurrentUser()
    }

    private fun loadCurrentUser() {
        viewModelScope.launch {
            val user = repository.getCurrentUser()
            _currentUser.value = user
            _isAuthenticated.value = user != null
            if (user != null) {
                // Re-identify restored sessions with the persisted UUID so events after relaunch match login.
                PostHog.identify(
                    distinctId = user.id,
                    userProperties = mapOf("username" to user.username)
                )
            }
        }
    }

    fun login(username: String) {
        val trimmedUsername = username.trim()
        // Reject blank usernames before persisting state or calling identify and capture,
        // rather than falling back to a shared placeholder identity.
        if (trimmedUsername.isEmpty()) {
            return
        }

        viewModelScope.launch {
            val existingUser = repository.getUser(trimmedUsername)
            val isNewUser = existingUser == null
            val user = existingUser ?: User(username = trimmedUsername, burritoConsiderations = 0)
            repository.saveUser(user)
            _currentUser.value = user
            _isAuthenticated.value = true

            PostHog.identify(
                distinctId = user.id,
                userProperties = mapOf("username" to user.username)
            )
            PostHog.capture(
                event = "user_logged_in",
                properties = mapOf(
                    "login_method" to "username",
                    "is_new_user" to isNewUser
                )
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            if (_currentUser.value == null) return@launch
            PostHog.capture("user_logged_out")
            PostHog.reset()
            repository.clearCurrentUser()
            _currentUser.value = null
            _isAuthenticated.value = false
        }
    }

    fun incrementBurritoCount() {
        viewModelScope.launch {
            val user = _currentUser.value ?: return@launch
            val updatedUser = user.copy(burritoConsiderations = user.burritoConsiderations + 1)
            repository.saveUser(updatedUser)
            _currentUser.value = updatedUser

            // Keep PII like username out of event properties, since person properties already store it via identify.
            PostHog.capture(
                event = "burrito_considered",
                properties = mapOf(
                    "total_considerations" to updatedUser.burritoConsiderations
                )
            )
        }
    }
}
