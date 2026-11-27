package com.example.posthog

import android.app.Application
import android.util.Log
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

class BurritoApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Read the project token optionally and never call PostHogAndroid.setup with a blank or placeholder key,
        // so unconfigured builds skip SDK initialization cleanly.
        val token: String? = BuildConfig.POSTHOG_PROJECT_TOKEN?.trim()
        if (token.isNullOrBlank()) {
            if (BuildConfig.DEBUG) {
                Log.e(
                    "PostHog",
                    "posthog.projectToken variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once posthog.projectToken is configured"
                )
            }
            return
        }

        // Initialize PostHog early in the Application lifecycle once configured.
        val config = PostHogAndroidConfig(
            projectToken = token,
            host = BuildConfig.POSTHOG_HOST,
        ).apply {
            debug = BuildConfig.DEBUG
            errorTrackingConfig.autoCapture = true
        }

        PostHogAndroid.setup(this, config)
    }
}
