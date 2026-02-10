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
        }
    }

    fun login(username: String) {
        viewModelScope.launch {
            val existingUser = repository.getUser(username)
            val user = existingUser ?: User(username = username, burritoConsiderations = 0)
            repository.saveUser(user)
            _currentUser.value = user
            _isAuthenticated.value = true

            PostHog.identify(username)
            PostHog.capture(event = "user_logged_in")
        }
    }

    fun logout() {
        viewModelScope.launch {
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

            PostHog.capture(
                event = "burrito_considered",
                properties = mapOf(
                    "total_considerations" to updatedUser.burritoConsiderations,
                    "username" to updatedUser.username
                )
            )
        }
    }
}
