<script setup lang="ts">
// Marca de HostelinApp: una placa de acero con la "H" troquelada y el
// travesaño al rojo, como una pieza recién salida de la fragua.
// El `uid` evita que dos marcas en la misma página compartan degradados.
import { computed } from 'vue'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 34 })

const uid = Math.random().toString(36).slice(2, 8)
const g1 = computed(() => `hm-plate-${uid}`)
const g2 = computed(() => `hm-edge-${uid}`)
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
    focusable="false"
    class="brand-mark"
  >
    <defs>
      <linearGradient :id="g1" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stop-color="#4b5869" />
        <stop offset="42%" stop-color="#232c38" />
        <stop offset="58%" stop-color="#2b3541" />
        <stop offset="100%" stop-color="#131a23" />
      </linearGradient>
      <linearGradient :id="g2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fdba74" />
        <stop offset="55%" stop-color="#f97316" />
        <stop offset="100%" stop-color="#c2410c" />
      </linearGradient>
    </defs>

    <!-- La placa -->
    <rect x="2" y="2" width="44" height="44" rx="12" :fill="`url(#${g1})`" />
    <!-- Hilo de luz del canto superior -->
    <path
      d="M14 3.2h20"
      stroke="rgba(255,255,255,.55)"
      stroke-width="1.2"
      stroke-linecap="round"
    />
    <rect
      x="2.6"
      y="2.6"
      width="42.8"
      height="42.8"
      rx="11.4"
      stroke="rgba(255,255,255,.14)"
      stroke-width="1.2"
    />

    <!-- Los dos montantes de la H -->
    <rect x="13" y="13" width="6" height="22" rx="2.4" fill="#e7ebf0" />
    <rect x="29" y="13" width="6" height="22" rx="2.4" fill="#e7ebf0" />
    <!-- El travesaño, al rojo -->
    <rect x="17" y="21" width="14" height="6" rx="2.4" :fill="`url(#${g2})`" />
  </svg>
</template>

<style scoped>
.brand-mark {
  flex: none;
  border-radius: 12px;
  filter: drop-shadow(0 2px 5px rgba(11, 16, 23, 0.28));
}
</style>
