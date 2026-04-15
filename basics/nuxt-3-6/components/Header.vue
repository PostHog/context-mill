<template>
  <header class="header">
    <div class="header-container">
      <nav>
        <NuxtLink to="/">Home</NuxtLink>
        <template v-if="user">
          <NuxtLink to="/burrito">Burrito Consideration</NuxtLink>
          <NuxtLink to="/profile">Profile</NuxtLink>
        </template>
      </nav>
      <div class="user-section">
        <template v-if="user">
          <span>Welcome, {{ user.username }}!</span>
          <button @click="handleLogout" class="btn-logout">
            Logout
          </button>
        </template>
        <template v-else>
          <span>Not logged in</span>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const auth = useAuth()
const user = computed(() => auth.user.value)
const { $posthog: posthog } = useNuxtApp()

const handleLogout = () => {
  posthog?.capture('user_logged_out')
  posthog?.reset()
  auth.logout()
}
</script>
