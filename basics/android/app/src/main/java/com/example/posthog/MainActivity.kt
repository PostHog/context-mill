package com.example.posthog

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.posthog.navigation.NavGraph
import com.example.posthog.navigation.Screen
import com.example.posthog.ui.components.AppHeader
import com.example.posthog.ui.components.BottomNavBar
import com.example.posthog.ui.theme.BackgroundGray
import com.example.posthog.ui.theme.PostHogTheme
import com.example.posthog.viewmodel.AuthViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PostHogTheme {
                BurritoApp()
            }
        }
    }
}

@Composable
fun BurritoApp() {
    val navController = rememberNavController()
    val viewModel: AuthViewModel = viewModel()

    val isAuthenticated by viewModel.isAuthenticated.collectAsState()
    val currentUser by viewModel.currentUser.collectAsState()

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            AppHeader(
                isAuthenticated = isAuthenticated,
                username = currentUser?.username,
                currentRoute = currentRoute,
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo(Screen.Home.route)
                        launchSingleTop = true
                    }
                },
                onLogout = {
                    viewModel.logout()
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        },
        bottomBar = {
            BottomNavBar(
                isAuthenticated = isAuthenticated,
                currentRoute = currentRoute,
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo(Screen.Home.route)
                        launchSingleTop = true
                    }
                }
            )
        },
        containerColor = BackgroundGray
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(BackgroundGray)
                .padding(innerPadding)
        ) {
            NavGraph(
                navController = navController,
                viewModel = viewModel
            )
        }
    }
}
