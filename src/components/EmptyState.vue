<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'

withDefaults(defineProps<{ icon?: IconName; title: string; text?: string }>(), {
  icon: 'bandeja',
})
</script>

<template>
  <div class="panel empty">
    <span class="empty-icon"><AppIcon :name="icon" :size="24" /></span>
    <p class="empty-title">{{ title }}</p>
    <p v-if="text" class="empty-text">{{ text }}</p>
    <slot />
  </div>
</template>
