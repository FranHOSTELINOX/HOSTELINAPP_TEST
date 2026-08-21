<script setup lang="ts">
// Esqueleto de carga: en vez de un "Cargando…" suelto, enseña la forma que
// van a tener las tarjetas para que la pantalla no dé un salto al llegar.
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>

<template>
  <div class="stack" aria-hidden="true">
    <div v-for="n in rows" :key="n" class="panel panel-pad skel-card">
      <div class="skeleton" style="height: 15px; width: 42%"></div>
      <div class="skeleton" style="height: 12px; width: 78%"></div>
      <div class="skeleton" style="height: 22px; width: 96px; border-radius: 999px"></div>
    </div>
  </div>
</template>

<style scoped>
.skel-card {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
</style>
