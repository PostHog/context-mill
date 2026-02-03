<template>
  <div class="container">
    <h1>Burrito consideration zone</h1>
    <p>Take a moment to truly consider the potential of burritos.</p>

    <div style="text-align: center">
      <button
        @click="handleConsideration"
        class="btn-burrito"
      >
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
const auth = useAuth()
const user = computed(() => auth.user.value)
const router = useRouter()
const hasConsidered = ref(false)
const { $posthog } = useNuxtApp()

// Redirect to home if not logged in
watchEffect(() => {
  if (!user.value) {
    router.push('/')
  }
})

const handleConsideration = () => {
  // Client-side only - no server calls
  if (user.value) {
    auth.incrementBurritoConsiderations()
    hasConsidered.value = true

    $posthog?.capture('burrito_considered', {
      total_considerations: user.value?.burritoConsiderations + 1,
      username: user.value?.username,
    })
    setTimeout(() => {
      hasConsidered.value = false
    }, 2000)
  }
}
</script>
