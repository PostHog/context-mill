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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.posthog.ui.components.StatsCard
import com.example.posthog.ui.theme.BackgroundGray
import com.example.posthog.ui.theme.SuccessGreen
import com.example.posthog.ui.theme.TextDark
import com.example.posthog.ui.theme.TextGray
import com.example.posthog.ui.theme.White
import kotlinx.coroutines.delay

@Composable
fun BurritoScreen(
    burritoCount: Int,
    onConsiderBurrito: () -> Unit
) {
    var showSuccess by remember { mutableStateOf(false) }

    LaunchedEffect(showSuccess) {
        if (showSuccess) {
            delay(2000)
            showSuccess = false
        }
    }

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
                    text = "Burrito consideration zone",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextDark,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Take a moment to truly consider the burrito.",
                    fontSize = 16.sp,
                    color = TextGray,
                    textAlign = TextAlign.Center,
                    lineHeight = 26.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = {
                        onConsiderBurrito()
                        showSuccess = true
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SuccessGreen
                    ),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = "Consider the Burrito",
                        fontSize = 18.sp,
                        color = White
                    )
                }

                if (showSuccess) {
                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "You have considered the burrito. Well done!",
                        color = SuccessGreen,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Consideration stats",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextDark,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                StatsCard(
                    title = "Total Burrito Considerations",
                    value = burritoCount.toString()
                )
            }
        }
    }
}
