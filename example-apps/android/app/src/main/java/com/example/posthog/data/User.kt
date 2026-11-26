package com.example.posthog.data

import java.util.UUID

data class User(
    val id: String = UUID.randomUUID().toString(),
    val username: String,
    val burritoConsiderations: Int = 0
)
