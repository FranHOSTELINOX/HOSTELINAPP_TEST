<script setup lang="ts">
// El logo de Hostelinox, entero: el óvalo completo y la razón social debajo.
//
//   <BrandLogo :width="200" />                el fondo lo decide el tema
//   <BrandLogo :width="300" fondo="oscuro" />  forzado, para sitios siempre oscuros
//
// La línea "HOSTELERIA E INOXIDABLES, S.L." es negra y sobre fondo oscuro no
// se vería, así que hay una segunda versión con esa línea aclarada. Cuál toca
// se decide en JS y no con CSS, porque hay sitios (la chapa del acceso) que
// son oscuros siempre, tenga el usuario el modo que tenga.
import { computed } from 'vue'
import { modoOscuro } from '../stores/theme'
import claro from '../assets/logo-hostelinox-completo.png'
import oscuro from '../assets/logo-hostelinox-completo-oscuro.png'

const props = withDefaults(
  defineProps<{ width?: number; fondo?: 'auto' | 'claro' | 'oscuro' }>(),
  { width: 200, fondo: 'auto' },
)

const enOscuro = computed(
  () => props.fondo === 'oscuro' || (props.fondo === 'auto' && modoOscuro.value),
)
</script>

<template>
  <img
    class="brand-logo"
    :src="enOscuro ? oscuro : claro"
    width="760"
    height="270"
    :style="{ width: `${props.width}px` }"
    alt="Hostelinox — Hostelería e Inoxidables, S.L."
    decoding="async"
  />
</template>

<style scoped>
.brand-logo {
  display: block;
  flex: none;
  height: auto;
  max-width: 100%;
}
</style>
