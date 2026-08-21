<script setup lang="ts">
// Mensaje de error o de confirmación. Se anuncia por lector de pantalla.
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{ kind?: 'error' | 'success' }>(), {
  kind: 'error',
})
</script>

<template>
  <p
    class="alert"
    :class="props.kind === 'error' ? 'alert-error' : 'alert-success'"
    role="status"
    aria-live="polite"
  >
    <AppIcon :name="props.kind === 'error' ? 'error' : 'exito'" :size="17" />
    <span><slot /></span>
  </p>
</template>
