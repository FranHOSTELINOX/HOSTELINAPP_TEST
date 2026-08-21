<script setup lang="ts">
// Cabecera común a todas las pantallas: rótulo pequeño, título y, si hace
// falta, una fila de acciones a la derecha (slot "acciones").
defineProps<{ eyebrow?: string; title: string; subtitle?: string }>()
</script>

<template>
  <header class="page-header">
    <div class="page-header-text">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="page-header-sub muted">{{ subtitle }}</p>
    </div>
    <div class="page-header-actions">
      <slot name="acciones" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 1.125rem;
  margin-bottom: 1.375rem;
  border-bottom: 1px solid var(--border);
}

.page-header-text {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
  min-width: 0;
}

.page-header-sub {
  font-size: 0.9375rem;
  max-width: 62ch;
}

.page-header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
