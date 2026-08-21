<script setup lang="ts">
// Dibuja uno de los iconos de `icons.ts`.  Uso: <AppIcon name="reloj" :size="18" />
import { iconPaths, type IconName } from './icons'

const props = withDefaults(defineProps<{ name: IconName; size?: number | string }>(), {
  size: 18,
})
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="iconPaths[props.name]" />
  </svg>
</template>
