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
        <span v-if="user">Welcome, {{ user.username }}!</span>
        <span v-else>Not logged in</span>
        <button v-if="user" @click="handleLogout" class="btn-logout">Logout</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const posthog = usePostHog()
const auth = useAuth()
const user = computed(() => auth.user.value)

const handleLogout = async () => {
  auth.logout()
  posthog?.capture('user_logged_out')
  posthog?.reset()
  await navigateTo('/')
}
</script>
