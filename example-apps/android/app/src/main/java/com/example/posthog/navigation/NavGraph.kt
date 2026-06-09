package com.example.posthog.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.posthog.ui.screens.BurritoScreen
import com.example.posthog.ui.screens.HomeScreen
import com.example.posthog.ui.screens.ProfileScreen
import com.example.posthog.viewmodel.AuthViewModel

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Burrito : Screen("burrito")
    object Profile : Screen("profile")
}

@Composable
fun NavGraph(
    navController: NavHostController,
    viewModel: AuthViewModel
) {
    val isAuthenticated by viewModel.isAuthenticated.collectAsState()
    val currentUser by viewModel.currentUser.collectAsState()

    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                isAuthenticated = isAuthenticated,
                username = currentUser?.username,
                onLogin = { username -> viewModel.login(username) }
            )
        }

        composable(Screen.Burrito.route) {
            if (!isAuthenticated) {
                LaunchedEffect(Unit) {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            } else {
                BurritoScreen(
                    burritoCount = currentUser?.burritoConsiderations ?: 0,
                    onConsiderBurrito = { viewModel.incrementBurritoCount() }
                )
            }
        }

        composable(Screen.Profile.route) {
            if (!isAuthenticated) {
                LaunchedEffect(Unit) {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            } else {
                ProfileScreen(
                    username = currentUser?.username ?: "",
                    burritoCount = currentUser?.burritoConsiderations ?: 0
                )
            }
        }
    }
}
