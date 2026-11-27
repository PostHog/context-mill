import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        load(localPropertiesFile.inputStream())
    }
}

android {
    namespace = "com.example.posthog"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "com.example.posthog"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Read posthog.projectToken optionally and emit null when missing or blank,
        // rather than defaulting BuildConfig.POSTHOG_PROJECT_TOKEN to an empty string.
        val rawPostHogToken = localProperties.getProperty("posthog.projectToken")?.trim()
        val postHogTokenLiteral =
            if (rawPostHogToken.isNullOrEmpty()) "null" else "\"$rawPostHogToken\""
        val rawPostHogHost = localProperties.getProperty("posthog.host")?.trim()
        val postHogHost =
            if (rawPostHogHost.isNullOrEmpty()) "https://us.i.posthog.com" else rawPostHogHost

        buildConfigField(
            "String",
            "POSTHOG_PROJECT_TOKEN",
            postHogTokenLiteral
        )
        buildConfigField(
            "String",
            "POSTHOG_HOST",
            "\"$postHogHost\""
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.posthog.android)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
