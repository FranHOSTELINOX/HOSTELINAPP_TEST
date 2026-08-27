import { computed, ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { mensajeDeAuth } from '../lib/errores-auth'
import type { Database, Role } from '../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

// Estado de sesión compartido por toda la app (patrón "store" sencillo,
// sin librerías extra como Pinia: para este tamaño de app no hace falta).
export const session = ref<Session | null>(null)
export const role = ref<Role | null>(null)
export const profile = ref<Profile | null>(null)
export const authReady = ref(false)

/**
 * ¿Sigue usando la contraseña que le dio el administrador? Mientras sea que
 * sí, el router no le deja salir de la pantalla de cambiarla.
 */
export const debeCambiarClave = computed(() => profile.value?.must_change_password === true)

async function loadProfileRole(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('No se pudo cargar el perfil:', error.message)
    role.value = null
    profile.value = null
    return
  }
  profile.value = data
  role.value = data.role
}

export async function initAuth() {
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  if (data.session) {
    await loadProfileRole(data.session.user.id)
  }
  authReady.value = true

  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    session.value = newSession
    if (newSession) {
      await loadProfileRole(newSession.user.id)
    } else {
      role.value = null
      profile.value = null
    }
  })
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(mensajeDeAuth(error, 'No se pudo iniciar sesión.'))
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const email = session.value?.user.email
  if (!email) throw new Error('No hay sesión activa')

  // Reautentica con la contraseña actual antes de cambiarla, para que no
  // baste con tener la sesión abierta en el navegador de otra persona.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (reauthError) throw new Error('La contraseña actual no es correcta')

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  // Supabase contesta en inglés ("New password should be different from the
  // old password"), y esto lo lee gente del taller: se traduce antes de salir.
  if (updateError) throw new Error(mensajeDeAuth(updateError, 'No se pudo cambiar la contraseña.'))

  // Ya no usa la que le dieron: se le quita la marca y se refresca el perfil
  // para que el router le deje salir de esta pantalla sin recargar.
  const id = session.value?.user.id
  if (id) {
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', id)
    await loadProfileRole(id)
  }
}
