package com.example.posthog.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.posthog.navigation.Screen
import com.example.posthog.ui.theme.PrimaryBlue
import com.example.posthog.ui.theme.TextGray
import com.example.posthog.ui.theme.White

sealed class BottomNavItem(
    val route: String,
    val label: String,
    val selectedIcon: ImageVector?,
    val unselectedIcon: ImageVector?
) {
    object Home : BottomNavItem(
        route = Screen.Home.route,
        label = "Home",
        selectedIcon = Icons.Filled.Home,
        unselectedIcon = Icons.Outlined.Home
    )

    object Burrito : BottomNavItem(
        route = Screen.Burrito.route,
        label = "Burrito",
        selectedIcon = null, // We'll use a custom icon or emoji
        unselectedIcon = null
    )

    object Profile : BottomNavItem(
        route = Screen.Profile.route,
        label = "Profile",
        selectedIcon = Icons.Filled.Person,
        unselectedIcon = Icons.Outlined.Person
    )
}

@Composable
fun BottomNavBar(
    isAuthenticated: Boolean,
    currentRoute: String?,
    onNavigate: (String) -> Unit
) {
    val items = if (isAuthenticated) {
        listOf(BottomNavItem.Home, BottomNavItem.Burrito, BottomNavItem.Profile)
    } else {
        listOf(BottomNavItem.Home)
    }

    NavigationBar(
        containerColor = White
    ) {
        items.forEach { item ->
            val selected = currentRoute == item.route

            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(item.route) },
                icon = {
                    if (item.selectedIcon != null && item.unselectedIcon != null) {
                        Icon(
                            imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                            contentDescription = item.label,
                            modifier = Modifier.size(24.dp)
                        )
                    } else {
                        // For Burrito, use text emoji as icon
                        Text(
                            text = "🌯",
                            fontSize = 24.sp
                        )
                    }
                },
                label = {
                    Text(
                        text = item.label,
                        fontSize = 12.sp
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = PrimaryBlue,
                    selectedTextColor = PrimaryBlue,
                    unselectedIconColor = TextGray,
                    unselectedTextColor = TextGray,
                    indicatorColor = PrimaryBlue.copy(alpha = 0.1f)
                )
            )
        }
    }
}
