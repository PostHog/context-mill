package com.example.posthog

import android.app.Application
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

class BurritoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // Initialize PostHog early in Application lifecycle
        val config = PostHogAndroidConfig(
            apiKey = BuildConfig.POSTHOG_API_KEY,
            host = BuildConfig.POSTHOG_HOST,
        ).apply {
            debug = true
            errorTrackingConfig.autoCapture = true
        }
        
        PostHogAndroid.setup(this, config)
    }
}
