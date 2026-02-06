import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Home from '@/views/Home.vue'
import Burrito from '@/views/Burrito.vue'
import Profile from '@/views/Profile.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/burrito',
      name: 'burrito',
      component: Burrito,
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: Profile,
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // Check if user exists and has a valid username
  const isValidUser = authStore.user && authStore.user.username
  
  if (to.meta.requiresAuth && !isValidUser) {
    // Clear invalid state
    if (authStore.user && !authStore.user.username) {
      authStore.logout()
    }
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
