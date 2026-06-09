package com.example.posthog.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.posthog.ui.theme.LightGray
import com.example.posthog.ui.theme.TextDark
import com.example.posthog.ui.theme.TextGray

@Composable
fun StatsCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(
                color = LightGray,
                shape = RoundedCornerShape(4.dp)
            )
            .padding(16.dp)
    ) {
        Text(
            text = title,
            color = TextGray,
            fontSize = 14.sp
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            color = TextDark,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
