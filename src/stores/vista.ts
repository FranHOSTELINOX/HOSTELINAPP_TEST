import { computed, ref, watch } from 'vue'
import { role } from './auth'

// "Ver como usuario": el administrador puede mirar la app tal y como la ve
// alguien del equipo, para comprobar qué le aparece y qué no sin tener que
// entrar con otra cuenta.
//
// Ojo con lo que es y lo que no es: esto cambia SOLO lo que se enseña en
// pantalla. Los permisos de verdad viven en la base de datos (RLS) y siguen
// siendo los del administrador. No sirve para "probar" si un usuario podría
// hacer algo prohibido; sirve para ver su menú y sus pantallas.
export const verComoUsuario = ref(false)

/** ¿Hay que pintar la app con las cosas de administrador? */
export const esAdmin = computed(() => role.value === 'admin' && !verComoUsuario.value)

/** Solo un administrador tiene algo que alternar. */
export const puedeCambiarVista = computed(() => role.value === 'admin')

export function alternarVista() {
  if (!puedeCambiarVista.value) return
  verComoUsuario.value = !verComoUsuario.value
}

// Al cambiar de cuenta (o al salir) se vuelve a la vista normal, para que
// nadie herede la vista de prueba de la sesión anterior.
watch(role, (nuevo) => {
  if (nuevo !== 'admin') verComoUsuario.value = false
})
