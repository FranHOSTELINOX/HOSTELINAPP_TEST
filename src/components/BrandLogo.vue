<script setup lang="ts">
// El logo de Hostelinox.
//
//   <BrandLogo :width="186" />                     solo el óvalo
//   <BrandLogo :width="286" completo />            con la razón social debajo
//   <BrandLogo :width="286" completo sobre-oscuro />   ídem, sobre fondo oscuro
//
// El óvalo vale igual sobre cualquier fondo: es plateado y no tiene ni un
// píxel negro. El logo completo sí lleva la línea "HOSTELERIA E INOXIDABLES,
// S.L." en negro, que sobre fondo oscuro no se vería; para eso está la
// variante con esa línea aclarada.
//
// Cuál usar se dice con una prop y no detectando el modo claro/oscuro,
// porque hay sitios (la chapa del acceso) que son oscuros siempre, tenga el
// usuario el tema que tenga.
import { computed } from 'vue'
import ovalo from '../assets/logo-hostelinox.png'
import completoClaro from '../assets/logo-hostelinox-completo.png'
import completoOscuro from '../assets/logo-hostelinox-completo-oscuro.png'

const props = withDefaults(
  defineProps<{ width?: number; completo?: boolean; sobreOscuro?: boolean }>(),
  { width: 180, completo: false, sobreOscuro: false },
)

const src = computed(() => {
  if (!props.completo) return ovalo
  return props.sobreOscuro ? completoOscuro : completoClaro
})

const alto = computed(() => (props.completo ? 176 : 124))
const ancho = computed(() => (props.completo ? 473 : 469))
</script>

<template>
  <img
    class="brand-logo"
    :src="src"
    :width="ancho"
    :height="alto"
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
