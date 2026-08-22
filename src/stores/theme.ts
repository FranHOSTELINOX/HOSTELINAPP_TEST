import { computed, ref, watch } from 'vue'

// Modo claro / oscuro. "auto" sigue lo que tenga puesto el móvil o el
// ordenador; los otros dos lo fuerzan. Se recuerda en el navegador.
export type Theme = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'hostelinapp:tema'

function leerGuardado(): Theme {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY)
    if (guardado === 'light' || guardado === 'dark' || guardado === 'auto') {
      return guardado
    }
  } catch {
    // Navegador en modo privado o con el almacenamiento bloqueado: da igual,
    // seguimos con "auto".
  }
  return 'auto'
}

export const theme = ref<Theme>(leerGuardado())

function aplicar(valor: Theme) {
  const raiz = document.documentElement
  if (valor === 'auto') {
    raiz.removeAttribute('data-theme')
  } else {
    raiz.setAttribute('data-theme', valor)
  }
  try {
    localStorage.setItem(STORAGE_KEY, valor)
  } catch {
    // Si no se puede guardar, el tema vale solo para esta visita.
  }
}

// Lo que tiene puesto el sistema, vigilado por si el usuario lo cambia
// mientras la app está abierta.
const consulta = window.matchMedia('(prefers-color-scheme: dark)')
const sistemaOscuro = ref(consulta.matches)
consulta.addEventListener('change', (e) => {
  sistemaOscuro.value = e.matches
})

/**
 * ¿Se está viendo la app en oscuro ahora mismo? Resuelve el "auto" contra lo
 * que tenga el sistema. Hace falta en JS (y no solo en CSS) para elegir la
 * versión del logo que toca.
 */
export const modoOscuro = computed(
  () => theme.value === 'dark' || (theme.value === 'auto' && sistemaOscuro.value),
)

export function initTheme() {
  aplicar(theme.value)
}

/** Va rotando entre claro y oscuro (partiendo de lo que se ve ahora). */
export function toggleTheme() {
  const oscuroAhora =
    theme.value === 'dark' ||
    (theme.value === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  theme.value = oscuroAhora ? 'light' : 'dark'
}

watch(theme, aplicar)
