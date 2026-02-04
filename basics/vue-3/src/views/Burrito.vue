<template>
  <div class="container">
    <h1>Burrito consideration zone</h1>
    <p>Take a moment to truly consider the potential of burritos.</p>

    <div style="text-align: center">
      <button @click="handleConsideration" class="btn-burrito">
        I have considered the burrito potential
      </button>

      <p v-if="hasConsidered" class="success">
        Thank you for your consideration! Count: {{ authStore.user?.burritoConsiderations }}
      </p>
    </div>

    <div class="stats">
      <h3>Consideration stats</h3>
      <p>Total considerations: {{ authStore.user?.burritoConsiderations }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import posthog from 'posthog-js'

const authStore = useAuthStore()
const hasConsidered = ref(false)

const handleConsideration = () => {
  if (!authStore.user) return

  // Client-side only - no server calls
  const updatedUser = {
    ...authStore.user,
    burritoConsiderations: authStore.user.burritoConsiderations + 1
  }
  authStore.setUser(updatedUser)
  hasConsidered.value = true
  setTimeout(() => {
    hasConsidered.value = false
  }, 2000)

  // Capture burrito consideration event
  posthog.capture('burrito_considered', {
    total_considerations: updatedUser.burritoConsiderations,
    username: updatedUser.username
  })
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

.btn-burrito {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  margin: 2rem 0;
}

.btn-burrito:hover {
  background-color: #218838;
}

.success {
  color: #28a745;
  margin-top: 0.5rem;
}

.stats {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

h3 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
</style>
