<template>
  <div class="container">
    <h1 v-if="user">Welcome back, {{ user.username }}!</h1>
    <h1 v-else>Welcome to Burrito Consideration App</h1>

    <div v-if="user">
      <p>You are now logged in. Feel free to explore:</p>
      <ul>
        <li>Consider the potential of burritos</li>
        <li>View your profile and statistics</li>
      </ul>
    </div>

    <div v-else>
      <p>Please sign in to begin your burrito journey</p>

      <form @submit.prevent="handleSubmit" class="form" novalidate>
        <div class="form-group">
          <label for="username">Username:</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            placeholder="Enter any username"
            :class="{ 'error-input': errors.username }"
            @blur="validateField('username')"
            @input="clearError('username')"
          />
          <p v-if="errors.username" class="field-error">{{ errors.username }}</p>
        </div>

        <div class="form-group">
          <label for="password">Password:</label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            placeholder="Enter any password"
            :class="{ 'error-input': errors.password }"
            @blur="validateField('password')"
            @input="clearError('password')"
          />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <p class="note">
        Note: This is a demo app. Use any username and password to sign in.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { loginSchema, validateForm, type LoginFormData } from '../utils/formValidation'

const auth = useAuth()
const user = computed(() => auth.user.value)

const posthog = usePostHog()

const formData = reactive<LoginFormData>({
  username: '',
  password: '',
})

const errors = reactive<Partial<Record<keyof LoginFormData, string>>>({})
const error = ref('')
const isSubmitting = ref(false)

const validateField = (field: keyof LoginFormData) => {
  const fieldSchema = loginSchema.shape[field]
  if (!fieldSchema) return

  const result = fieldSchema.safeParse(formData[field])
  if (!result.success) {
    errors[field] = result.error.errors[0]?.message || 'Invalid value'
  } else {
    delete errors[field]
  }
}

const clearError = (field: keyof LoginFormData) => {
  delete errors[field]
}

const handleSubmit = async () => {
  // Clear previous errors
  error.value = ''
  Object.keys(errors).forEach((key) => {
    delete errors[key as keyof LoginFormData]
  })

  // Validate entire form
  const validation = validateForm(loginSchema, formData)
  if (!validation.success) {
    Object.assign(errors, validation.errors)
    return
  }

  isSubmitting.value = true

  try {
    const success = await auth.login(formData.username, formData.password)
    if (success) {
      // Identifying the user once on login/sign up is enough.
      posthog?.identify(formData.username)
      
      // Capture login event
      posthog?.capture('user_logged_in')
      formData.username = ''
      formData.password = ''
      await navigateTo('/')
    } else {
      error.value = 'Login failed. Please check your credentials and try again.'
    }
  } catch (err) {
    console.error('Login failed:', err)
    error.value = 'An error occurred during login. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>
