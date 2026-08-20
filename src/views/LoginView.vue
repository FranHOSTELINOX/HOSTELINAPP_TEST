<script setup lang="ts">
import { ref } from 'vue'
import { signInWithEmail, signInWithGoogle } from '../stores/auth'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleEmailLogin() {
  error.value = ''
  loading.value = true
  try {
    await signInWithEmail(email.value, password.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo iniciar sesión'
  } finally {
    loading.value = false
  }
}

async function handleGoogleLogin() {
  error.value = ''
  try {
    await signInWithGoogle()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google'
  }
}
</script>

<template>
  <div class="card" style="max-width: 360px; margin: 3rem auto">
    <h1>HostelinApp</h1>
    <form @submit.prevent="handleEmailLogin">
      <div>
        <label for="email">Email</label><br />
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>
      <div style="margin-top: 0.5rem">
        <label for="password">Contraseña</label><br />
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </div>
      <button type="submit" :disabled="loading" style="margin-top: 1rem">
        {{ loading ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
    <hr style="margin: 1rem 0" />
    <button type="button" @click="handleGoogleLogin">Entrar con Google</button>
    <p v-if="error" style="color: crimson">{{ error }}</p>
  </div>
</template>
