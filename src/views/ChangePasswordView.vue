<script setup lang="ts">
import { ref } from 'vue'
import { changePassword } from '../stores/auth'

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const message = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  message.value = ''

  if (newPassword.value.length < 8) {
    error.value = 'La contraseña nueva debe tener al menos 8 caracteres.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Las dos contraseñas nuevas no coinciden.'
    return
  }

  loading.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    message.value = 'Contraseña actualizada.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo cambiar la contraseña'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <h2>Cambiar contraseña</h2>
  <div class="card" style="max-width: 360px">
    <form @submit.prevent="handleSubmit">
      <div>
        <label for="current-password">Contraseña actual</label><br />
        <input
          id="current-password"
          v-model="currentPassword"
          type="password"
          required
          autocomplete="current-password"
        />
      </div>
      <div style="margin-top: 0.5rem">
        <label for="new-password">Contraseña nueva</label><br />
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
        />
      </div>
      <div style="margin-top: 0.5rem">
        <label for="confirm-password">Repite la contraseña nueva</label><br />
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
        />
      </div>
      <button type="submit" :disabled="loading" style="margin-top: 1rem">
        {{ loading ? 'Cambiando…' : 'Cambiar contraseña' }}
      </button>
    </form>
    <p v-if="error" style="color: crimson">{{ error }}</p>
    <p v-if="message" style="color: green">{{ message }}</p>
  </div>
</template>
