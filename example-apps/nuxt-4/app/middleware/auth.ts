export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useAuth()
  const user = auth.user.value

  // If user is not logged in, redirect to home/login page
  if (!user) {
    return navigateTo('/')
  }
})
