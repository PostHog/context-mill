package com.example.posthog.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.posthog.ui.theme.BackgroundGray
import com.example.posthog.ui.theme.BorderGray
import com.example.posthog.ui.theme.PrimaryBlue
import com.example.posthog.ui.theme.TextDark
import com.example.posthog.ui.theme.TextGray
import com.example.posthog.ui.theme.White

@Composable
fun HomeScreen(
    isAuthenticated: Boolean,
    username: String?,
    onLogin: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundGray)
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
        contentAlignment = if (isAuthenticated) Alignment.TopCenter else Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 600.dp)
                .padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (isAuthenticated && username != null) {
                LoggedInContent(username = username)
            } else {
                LoginForm(onLogin = onLogin)
            }
        }
    }
}

@Composable
private fun LoggedInContent(username: String) {
    ContentCard {
        Text(
            text = "Welcome back, $username!",
            fontSize = 24.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextDark
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Ready to consider some burritos?",
            fontSize = 16.sp,
            color = TextGray,
            lineHeight = 26.sp
        )
    }
}

@Composable
private fun LoginForm(onLogin: (String) -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    ContentCard {
        Text(
            text = "Welcome to Burrito Consideration App",
            fontSize = 24.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextDark,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Username field
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Username",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = TextDark,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(4.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedBorderColor = BorderGray,
                    focusedBorderColor = PrimaryBlue,
                    unfocusedContainerColor = White,
                    focusedContainerColor = White
                )
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Password field
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Password",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = TextDark,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                shape = RoundedCornerShape(4.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedBorderColor = BorderGray,
                    focusedBorderColor = PrimaryBlue,
                    unfocusedContainerColor = White,
                    focusedContainerColor = White
                )
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                if (username.isNotBlank()) {
                    onLogin(username)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = PrimaryBlue
            ),
            shape = RoundedCornerShape(4.dp)
        ) {
            Text(
                text = "Sign In",
                fontSize = 16.sp,
                color = White
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Note: This is a demo app. Enter any username to sign in.",
            fontSize = 14.sp,
            color = TextGray,
            textAlign = TextAlign.Center,
            lineHeight = 21.sp
        )
    }
}

@Composable
private fun ContentCard(
    content: @Composable () -> Unit
) {
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
        content()
    }
}
