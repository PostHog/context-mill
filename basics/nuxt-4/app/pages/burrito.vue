<template>
  <div class="container">
    <h1>Burrito consideration zone</h1>
    <p>Take a moment to truly consider the potential of burritos.</p>

    <div style="text-align: center">
      <button @click="handleConsideration" class="btn-burrito">
        I have considered the burrito potential
      </button>

      <p v-if="hasConsidered" class="success">
        Thank you for your consideration! Count: {{ user?.burritoConsiderations }}
      </p>
    </div>

    <div class="stats">
      <h3>Consideration stats</h3>
      <p>Total considerations: {{ user?.burritoConsiderations }}</p>
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
const hasConsidered = ref(false)

const handleConsideration = () => {
  auth.incrementBurritoConsiderations()
  
  // Capture burrito consideration event
  if (user.value) {
    posthog?.capture('burrito_considered', {
      total_considerations: user.value.burritoConsiderations,
      username: user.value.username,
    })
  }
  
  hasConsidered.value = true
  setTimeout(() => {
    hasConsidered.value = false
  }, 2000)
}
</script>
