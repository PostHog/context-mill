<template>
  <header class="header">
    <div class="header-container">
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <template v-if="authStore.user">
          <RouterLink to="/burrito">Burrito Consideration</RouterLink>
          <RouterLink to="/profile">Profile</RouterLink>
        </template>
      </nav>
      <div class="user-section">
        <template v-if="authStore.user && authStore.user.username">
          <span>Welcome, {{ authStore.user.username }}!</span>
          <button @click="handleLogout" class="btn-logout">
            Logout
          </button>
        </template>
        <template v-else>
          <span>Not logged in</span>
          <button v-if="authStore.user" @click="handleLogout" class="btn-logout">
            Clear Session
          </button>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const handleLogout = () => {
  authStore.logout()
  router.push({ name: 'home' })
}
</script>

<style scoped>
.header {
  background-color: #333;
  color: white;
  padding: 1rem;
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header nav {
  display: flex;
  gap: 1rem;
}

.header a {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.header a:hover {
  background-color: #555;
  text-decoration: none;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-logout {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-logout:hover {
  background-color: #c82333;
}
</style>
