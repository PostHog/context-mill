package com.example.posthog.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

class UserRepository(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME, Context.MODE_PRIVATE
    )

    companion object {
        private const val PREFS_NAME = "burrito_app_prefs"
        private const val KEY_CURRENT_USERNAME = "current_username"
        private const val KEY_USER_DATA_PREFIX = "user_data_"
    }

    fun getCurrentUsername(): String? {
        return prefs.getString(KEY_CURRENT_USERNAME, null)
    }

    fun getUser(username: String): User? {
        val json = prefs.getString("$KEY_USER_DATA_PREFIX$username", null) ?: return null
        return try {
            val obj = JSONObject(json)
            User(
                username = obj.getString("username"),
                burritoConsiderations = obj.getInt("burritoConsiderations")
            )
        } catch (e: Exception) {
            null
        }
    }

    fun saveUser(user: User) {
        val json = JSONObject().apply {
            put("username", user.username)
            put("burritoConsiderations", user.burritoConsiderations)
        }.toString()

        prefs.edit()
            .putString("$KEY_USER_DATA_PREFIX${user.username}", json)
            .putString(KEY_CURRENT_USERNAME, user.username)
            .apply()
    }

    fun clearCurrentUser() {
        prefs.edit()
            .remove(KEY_CURRENT_USERNAME)
            .apply()
    }

    fun getCurrentUser(): User? {
        val username = getCurrentUsername() ?: return null
        return getUser(username)
    }
}
