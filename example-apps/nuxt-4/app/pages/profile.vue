<template>
  <div class="container">
    <h1>User Profile</h1>

    <div class="stats">
      <h2>Your Information</h2>
      <p><strong>Username:</strong> {{ user?.username }}</p>
      <p><strong>Burrito Considerations:</strong> {{ user?.burritoConsiderations }}</p>
    </div>

    <div style="margin-top: 2rem">
      <button @click="triggerTestError" class="btn-primary" style="background-color: #dc3545">
        Trigger Test Error (for PostHog)
      </button>
    </div>

    <div style="margin-top: 2rem">
      <h3>Your Burrito Journey</h3>
      <p v-if="user?.burritoConsiderations === 0">
        You haven't considered any burritos yet. Visit the Burrito Consideration page to start!
      </p>
      <p v-else-if="user?.burritoConsiderations === 1">
        You've considered the burrito potential once. Keep going!
      </p>
      <p v-else-if="user && user.burritoConsiderations < 5">
        You're getting the hang of burrito consideration!
      </p>
      <p v-else-if="user && user.burritoConsiderations < 10">
        You're becoming a burrito consideration expert!
      </p>
      <p v-else>You are a true burrito consideration master! 🌯</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const auth = useAuth()
const user = computed(() => auth.user.value)
const posthog = usePostHog()

const triggerTestError = () => {
  try {
    throw new Error('Test error for PostHog error tracking')
  } catch (err) {
    console.error('Captured error:', err)
    posthog?.captureException(err)
  }
}
</script>
