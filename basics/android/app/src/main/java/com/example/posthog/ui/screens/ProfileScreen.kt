package com.example.posthog.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.posthog.ui.components.StatsCard
import com.example.posthog.ui.theme.BackgroundGray
import com.example.posthog.ui.theme.TextDark
import com.example.posthog.ui.theme.TextGray
import com.example.posthog.ui.theme.White

@Composable
fun ProfileScreen(
    username: String,
    burritoCount: Int
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundGray)
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 600.dp)
                .padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Main content card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(
                        elevation = 4.dp,
                        shape = RoundedCornerShape(8.dp),
                        ambientColor = TextDark.copy(alpha = 0.1f),
                        spotColor = TextDark.copy(alpha = 0.1f)
                    )
                    .background(
                        color = White,
                        shape = RoundedCornerShape(8.dp)
                    )
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "User Profile",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextDark
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Your Information section
                Text(
                    text = "Your Information",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextDark,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Username display
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Username",
                        fontSize = 14.sp,
                        color = TextGray
                    )
                    Text(
                        text = username,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextDark
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Stats card
                StatsCard(
                    title = "Total Burrito Considerations",
                    value = burritoCount.toString()
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Your Burrito Journey section
                Text(
                    text = "Your Burrito Journey",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextDark,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = getJourneyMessage(burritoCount),
                    fontSize = 16.sp,
                    color = TextGray,
                    textAlign = TextAlign.Start,
                    lineHeight = 26.sp,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

private fun getJourneyMessage(count: Int): String = when {
    count == 0 -> "You haven't considered any burritos yet. Start your journey!"
    count == 1 -> "You've considered the burrito potential once. The journey begins!"
    count in 2..4 -> "You're getting the hang of burrito consideration!"
    count in 5..9 -> "You're becoming a burrito consideration expert!"
    else -> "You are a true burrito consideration master!"
}
