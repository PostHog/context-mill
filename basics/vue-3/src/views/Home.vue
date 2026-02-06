<template>
  <div class="container">
    <template v-if="authStore.user && authStore.user.username">
      <h1>Welcome back, {{ authStore.user.username }}!</h1>
      <p>You are now logged in. Feel free to explore:</p>
      <ul>
        <li>Consider the potential of burritos</li>
        <li>View your profile and statistics</li>
      </ul>
    </template>
    <template v-else>
      <h1>Welcome to Burrito Consideration App</h1>
      <p>Please sign in to begin your burrito journey</p>

      <form @submit.prevent="handleSubmit" class="form">
        <div class="form-group">
          <label for="username">Username:</label>
          <input
            type="text"
            id="username"
            v-model="username"
            placeholder="Enter any username"
          />
        </div>

        <div class="form-group">
          <label for="password">Password:</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="Enter any password"
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="btn-primary">Sign In</button>
      </form>

      <p class="note">
        Note: This is a demo app. Use any username and password to sign in.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import posthog from 'posthog-js'

const authStore = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')

// Clean up invalid user state on mount
onMounted(() => {
  if (authStore.user && !authStore.user.username) {
    authStore.logout()
  }
})

const handleSubmit = async () => {
  error.value = ''

  const success = await authStore.login(username.value, password.value)
  if (success) {
    // Identifying the user once on login/sign up is enough.
    posthog.identify(username.value)
    posthog.capture('user_logged_in')
    
    username.value = ''
    password.value = ''
  } else {
    error.value = 'Please provide both username and password'
  }
}
</script>

<style scoped>
.container {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form {
  margin-top: 2rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.form-group input:focus {
  outline: none;
  border-color: #0070f3;
}

.btn-primary {
  background-color: #0070f3;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  width: 100%;
  margin-top: 1rem;
}

.btn-primary:hover {
  background-color: #0051cc;
}

.error {
  color: #dc3545;
  margin-top: 0.5rem;
}

.note {
  margin-top: 2rem;
  color: #666;
  font-size: 14px;
  text-align: center;
}

ul {
  margin-top: 1rem;
  padding-left: 1.5rem;
}

li {
  margin-bottom: 0.5rem;
}
</style>
