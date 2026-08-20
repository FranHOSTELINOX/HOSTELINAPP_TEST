<script setup lang="ts">
import { watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { role, session, signOut } from './stores/auth'

const route = useRoute()
const router = useRouter()

// Los cambios de sesión (login, logout, expiración) no siempre pasan por
// una navegación de vue-router, así que hay que vigilarlos aparte y
// mandar a la pantalla correcta cuando cambian.
watch(session, (newSession) => {
  if (!newSession && route.meta.requiresAuth) {
    router.push({ name: 'login' })
  } else if (newSession && route.name === 'login') {
    router.push({ name: 'tareas' })
  }
})
</script>

<template>
  <div class="app-layout">
    <nav v-if="session" class="app-nav">
      <RouterLink to="/tareas">Tareas</RouterLink>
      <RouterLink to="/tiempos">Tiempos</RouterLink>
      <RouterLink to="/calendario">Calendario</RouterLink>
      <RouterLink to="/avisos">Avisos</RouterLink>
      <RouterLink v-if="role === 'admin'" to="/admin">Administración</RouterLink>
      <span style="flex: 1"></span>
      <RouterLink to="/cambiar-contrasena">Cambiar contraseña</RouterLink>
      <button type="button" @click="signOut()">Salir</button>
    </nav>
    <RouterView />
  </div>
</template>
