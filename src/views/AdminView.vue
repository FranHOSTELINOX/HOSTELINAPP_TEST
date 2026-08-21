<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import type { Database } from '../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

const users = ref<Profile[]>([])
const error = ref('')
const message = ref('')

const newTask = ref({ title: '', description: '', assigned_to: '', due_date: '' })
const newEvent = ref({ title: '', description: '', start_at: '', assigned_to: '' })
const newNotice = ref({ title: '', body: '', assigned_to: '' })
const newUser = ref({ full_name: '', email: '', password: '', puesto: '', isAdmin: false })
const creatingUser = ref(false)

async function loadUsers() {
  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .order('email', { ascending: true })

  if (fetchError) {
    error.value = fetchError.message
    return
  }
  users.value = data ?? []
}

async function createTask() {
  if (!session.value) return
  error.value = ''
  message.value = ''
  const { error: insertError } = await supabase.from('tasks').insert({
    title: newTask.value.title,
    description: newTask.value.description || null,
    assigned_to: newTask.value.assigned_to || null,
    due_date: newTask.value.due_date || null,
    created_by: session.value.user.id,
  })
  if (insertError) {
    error.value = insertError.message
    return
  }
  message.value = 'Tarea creada.'
  newTask.value = { title: '', description: '', assigned_to: '', due_date: '' }
}

async function createEvent() {
  if (!session.value) return
  error.value = ''
  message.value = ''
  const { error: insertError } = await supabase.from('calendar_events').insert({
    title: newEvent.value.title,
    description: newEvent.value.description || null,
    start_at: newEvent.value.start_at,
    assigned_to: newEvent.value.assigned_to || null,
    created_by: session.value.user.id,
  })
  if (insertError) {
    error.value = insertError.message
    return
  }
  message.value = 'Evento creado.'
  newEvent.value = { title: '', description: '', start_at: '', assigned_to: '' }
}

async function createNotice() {
  if (!session.value) return
  error.value = ''
  message.value = ''
  const { error: insertError } = await supabase.from('notices').insert({
    title: newNotice.value.title,
    body: newNotice.value.body || null,
    assigned_to: newNotice.value.assigned_to || null,
    created_by: session.value.user.id,
  })
  if (insertError) {
    error.value = insertError.message
    return
  }
  message.value = 'Aviso publicado.'
  newNotice.value = { title: '', body: '', assigned_to: '' }
}

async function createUser() {
  error.value = ''
  message.value = ''

  if (newUser.value.password.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  creatingUser.value = true
  try {
    const { data, error: fnError } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: newUser.value.email,
        password: newUser.value.password,
        full_name: newUser.value.full_name,
        puesto: newUser.value.puesto,
        role: newUser.value.isAdmin ? 'admin' : 'user',
      },
    })
    if (fnError) throw fnError
    if (data?.error) throw new Error(data.error)

    message.value = newUser.value.isAdmin ? 'Administrador creado.' : 'Usuario creado.'
    newUser.value = { full_name: '', email: '', password: '', puesto: '', isAdmin: false }
    await loadUsers()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo crear el usuario'
  } finally {
    creatingUser.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <h2>Administración</h2>
  <p v-if="error" style="color: crimson">{{ error }}</p>
  <p v-if="message" style="color: green">{{ message }}</p>

  <div class="card">
    <h3>Nuevo usuario</h3>
    <form @submit.prevent="createUser">
      <input v-model="newUser.full_name" placeholder="Nombre" required />
      <br />
      <input v-model="newUser.email" type="email" placeholder="Email" required />
      <br />
      <input
        v-model="newUser.password"
        type="password"
        placeholder="Contraseña (mínimo 8 caracteres)"
        minlength="8"
        required
      />
      <br />
      <input v-model="newUser.puesto" placeholder="Puesto (p. ej. Recepción)" />
      <br />
      <label>
        <input v-model="newUser.isAdmin" type="checkbox" />
        Es administrador (puede crear tareas, usuarios, calendario y avisos)
      </label>
      <br />
      <button type="submit" :disabled="creatingUser">
        {{ creatingUser ? 'Creando…' : 'Crear usuario' }}
      </button>
    </form>
  </div>

  <div class="card">
    <h3>Nueva tarea</h3>
    <form @submit.prevent="createTask">
      <input v-model="newTask.title" placeholder="Título" required />
      <br />
      <textarea v-model="newTask.description" placeholder="Descripción"></textarea>
      <br />
      <select v-model="newTask.assigned_to">
        <option value="">Sin asignar</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.email }}</option>
      </select>
      <input v-model="newTask.due_date" type="date" />
      <br />
      <button type="submit">Crear tarea</button>
    </form>
  </div>

  <div class="card">
    <h3>Nuevo evento de calendario</h3>
    <form @submit.prevent="createEvent">
      <input v-model="newEvent.title" placeholder="Título" required />
      <br />
      <textarea v-model="newEvent.description" placeholder="Descripción"></textarea>
      <br />
      <input v-model="newEvent.start_at" type="datetime-local" required />
      <select v-model="newEvent.assigned_to">
        <option value="">Todos</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.email }}</option>
      </select>
      <br />
      <button type="submit">Crear evento</button>
    </form>
  </div>

  <div class="card">
    <h3>Nuevo aviso</h3>
    <form @submit.prevent="createNotice">
      <input v-model="newNotice.title" placeholder="Título" required />
      <br />
      <textarea v-model="newNotice.body" placeholder="Contenido"></textarea>
      <br />
      <select v-model="newNotice.assigned_to">
        <option value="">Todos</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.email }}</option>
      </select>
      <br />
      <button type="submit">Publicar aviso</button>
    </form>
  </div>

  <div class="card">
    <h3>Usuarios</h3>
    <ul>
      <li v-for="u in users" :key="u.id">
        {{ u.full_name || u.email }} — {{ u.email }} — {{ u.role }}
        <template v-if="u.puesto"> — {{ u.puesto }}</template>
      </li>
    </ul>
  </div>
</template>
