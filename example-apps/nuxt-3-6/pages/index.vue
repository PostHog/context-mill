<template>
  <div class="container">
    <template v-if="user">
      <h1>Welcome back, {{ user.username }}!</h1>
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
const auth = useAuth()
const user = computed(() => auth.user.value)
const username = ref('')
const password = ref('')
const error = ref('')
const { $posthog: posthog } = useNuxtApp()

const handleSubmit = async () => {
  error.value = ''

  const success = await auth.login(username.value, password.value)
  if (success) {
    // Identifying the user once on login/sign up is enough.
    posthog?.identify(username.value)
    
    // Capture login event
    posthog?.capture('user_logged_in')
    
    username.value = ''
    password.value = ''
  } else {
    error.value = 'Please provide both username and password'
  }
}
</script>
