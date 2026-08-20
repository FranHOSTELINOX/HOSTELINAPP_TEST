import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/database.types'

// Estado de sesión compartido por toda la app (patrón "store" sencillo,
// sin librerías extra como Pinia: para este tamaño de app no hace falta).
export const session = ref<Session | null>(null)
export const role = ref<Role | null>(null)
export const authReady = ref(false)

async function loadProfileRole(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('No se pudo cargar el perfil:', error.message)
    role.value = null
    return
  }
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
    }
  })
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}
