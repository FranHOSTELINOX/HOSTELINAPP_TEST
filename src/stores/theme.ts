import { computed, ref } from 'vue'

// Modo claro / oscuro. La app sigue lo que tenga puesto el móvil o el
// ordenador; no hay botón para forzarlo. Todo el cambio de colores lo hace
// el CSS con @media (prefers-color-scheme: dark).
//
// Esto de aquí existe solo porque hay una cosa que el CSS no puede decidir:
// cuál de las dos versiones del logo cargar.
const consulta = window.matchMedia('(prefers-color-scheme: dark)')
const sistemaOscuro = ref(consulta.matches)
consulta.addEventListener('change', (e) => {
  sistemaOscuro.value = e.matches
})

/** ¿Se está viendo la app en oscuro ahora mismo? */
export const modoOscuro = computed(() => sistemaOscuro.value)
