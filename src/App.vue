<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { role, session, signOut } from './stores/auth'
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
