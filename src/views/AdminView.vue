<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import type { Database } from '../lib/database.types'
import { initials } from '../lib/format'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import PageHeader from '../components/PageHeader.vue'
import type { IconName } from '../components/icons'

type Profile = Database['public']['Tables']['profiles']['Row']

const users = ref<Profile[]>([])
const error = ref('')
const message = ref('')

const newTask = ref({ title: '', description: '', assigned_to: '', due_date: '' })
const newEvent = ref({ title: '', description: '', start_at: '', assigned_to: '' })
const newNotice = ref({ title: '', body: '', assigned_to: '' })
const newUser = ref({ full_name: '', email: '', password: '', puesto: '', isAdmin: false })
const creatingUser = ref(false)

type Seccion = 'equipo' | 'tareas' | 'calendario' | 'avisos'

const secciones: { id: Seccion; etiqueta: string; icono: IconName }[] = [
  { id: 'equipo', etiqueta: 'Equipo', icono: 'usuarios' },
  { id: 'tareas', etiqueta: 'Tareas', icono: 'tareas' },
  { id: 'calendario', etiqueta: 'Calendario', icono: 'calendario' },
  { id: 'avisos', etiqueta: 'Avisos', icono: 'avisos' },
]

const seccion = ref<Seccion>('equipo')

function cambiarSeccion(id: Seccion) {
  seccion.value = id
  error.value = ''
  message.value = ''
}

const admins = computed(() => users.value.filter((u) => u.role === 'admin').length)

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
  <PageHeader
    eyebrow="Panel del administrador"
    title="Administración"
    subtitle="Da de alta al equipo y reparte tareas, eventos y avisos."
  />

  <!-- ---------- Pestañas ---------- -->
  <nav class="secciones" aria-label="Secciones de administración">
    <button
      v-for="s in secciones"
      :key="s.id"
      type="button"
      class="seccion"
      :class="{ activa: seccion === s.id }"
      :aria-current="seccion === s.id ? 'page' : undefined"
      @click="cambiarSeccion(s.id)"
    >
      <AppIcon :name="s.icono" :size="16" />
      {{ s.etiqueta }}
    </button>
  </nav>

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>
  <AlertMessage v-if="message" kind="success" class="mb">{{ message }}</AlertMessage>

  <!-- ================= EQUIPO ================= -->
  <div v-if="seccion === 'equipo'" class="columnas">
    <section class="panel">
      <header class="panel-head">
        <AppIcon name="usuario" :size="17" />
        <h3>Nuevo usuario</h3>
      </header>
      <div class="panel-body">
        <form class="form-grid form-grid-2" @submit.prevent="createUser">
          <div class="field span-2">
            <label class="field-label" for="u-nombre">Nombre completo</label>
            <input
              id="u-nombre"
              v-model="newUser.full_name"
              class="input"
              placeholder="Ej. Ana García"
              required
            />
          </div>

          <div class="field span-2">
            <label class="field-label" for="u-email">Correo electrónico</label>
            <input
              id="u-email"
              v-model="newUser.email"
              class="input"
              type="email"
              placeholder="ana@hostelinox.com"
              required
            />
          </div>

          <div class="field">
            <label class="field-label" for="u-pass">Contraseña</label>
            <input
              id="u-pass"
              v-model="newUser.password"
              class="input"
              type="password"
              placeholder="Mínimo 8 caracteres"
              minlength="8"
              required
            />
            <p class="field-hint">Se la das tú y ya la cambiará al entrar.</p>
          </div>

          <div class="field">
            <label class="field-label" for="u-puesto">Puesto</label>
            <input
              id="u-puesto"
              v-model="newUser.puesto"
              class="input"
              placeholder="Ej. Taller, Montaje…"
            />
          </div>

          <label class="switch span-2">
            <input v-model="newUser.isAdmin" type="checkbox" />
            <span class="switch-text">
              <strong>Es administrador</strong><br />
              <span class="small muted">
                Podrá crear usuarios, tareas, eventos y avisos como tú.
              </span>
            </span>
          </label>

          <div class="form-actions span-2">
            <button type="submit" class="btn btn-primary" :disabled="creatingUser">
              <AppIcon name="mas" :size="16" />
              {{ creatingUser ? 'Creando…' : 'Crear usuario' }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <AppIcon name="usuarios" :size="17" />
        <h3>Usuarios</h3>
        <span class="spacer"></span>
        <span class="pill pill-plain small">{{ users.length }}</span>
      </header>

      <p v-if="users.length === 0" class="panel-body muted small">
        Todavía no hay ningún usuario dado de alta.
      </p>

      <ul v-else class="lista-usuarios">
        <li v-for="u in users" :key="u.id" class="usuario">
          <span class="usuario-avatar">{{ initials(u.full_name || u.email) }}</span>
          <span class="usuario-texto">
            <strong>{{ u.full_name || u.email }}</strong>
            <span class="small dim">{{ u.email }}</span>
          </span>
          <span class="spacer"></span>
          <span v-if="u.puesto" class="pill pill-plain">{{ u.puesto }}</span>
          <span v-if="u.role === 'admin'" class="pill pill-accent">Admin</span>
        </li>
      </ul>

      <footer v-if="users.length > 0" class="panel-foot small dim">
        {{ admins }} {{ admins === 1 ? 'administrador' : 'administradores' }} ·
        {{ users.length - admins }} del equipo
      </footer>
    </section>
  </div>

  <!-- ================= TAREAS ================= -->
  <section v-else-if="seccion === 'tareas'" class="panel formulario">
    <header class="panel-head">
      <AppIcon name="tareas" :size="17" />
      <h3>Nueva tarea</h3>
    </header>
    <div class="panel-body">
      <form class="form-grid form-grid-2" @submit.prevent="createTask">
        <div class="field span-2">
          <label class="field-label" for="t-titulo">Título</label>
          <input
            id="t-titulo"
            v-model="newTask.title"
            class="input"
            placeholder="Ej. Montar la campana del office"
            required
          />
        </div>

        <div class="field span-2">
          <label class="field-label" for="t-desc">Descripción</label>
          <textarea
            id="t-desc"
            v-model="newTask.description"
            class="textarea"
            placeholder="Detalles, materiales, dónde es…"
          ></textarea>
        </div>

        <div class="field">
          <label class="field-label" for="t-quien">Asignar a</label>
          <select id="t-quien" v-model="newTask.assigned_to" class="select">
            <option value="">Sin asignar</option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.full_name || u.email }}
            </option>
          </select>
        </div>

        <div class="field">
          <label class="field-label" for="t-fecha">Fecha límite</label>
          <input id="t-fecha" v-model="newTask.due_date" class="input" type="date" />
        </div>

        <div class="form-actions span-2">
          <button type="submit" class="btn btn-primary">
            <AppIcon name="mas" :size="16" />
            Crear tarea
          </button>
        </div>
      </form>
    </div>
  </section>

  <!-- ================= CALENDARIO ================= -->
  <section v-else-if="seccion === 'calendario'" class="panel formulario">
    <header class="panel-head">
      <AppIcon name="calendario" :size="17" />
      <h3>Nuevo evento</h3>
    </header>
    <div class="panel-body">
      <form class="form-grid form-grid-2" @submit.prevent="createEvent">
        <div class="field span-2">
          <label class="field-label" for="e-titulo">Título</label>
          <input
            id="e-titulo"
            v-model="newEvent.title"
            class="input"
            placeholder="Ej. Entrega en el hotel del centro"
            required
          />
        </div>

        <div class="field span-2">
          <label class="field-label" for="e-desc">Descripción</label>
          <textarea
            id="e-desc"
            v-model="newEvent.description"
            class="textarea"
            placeholder="Dirección, contacto, qué hay que llevar…"
          ></textarea>
        </div>

        <div class="field">
          <label class="field-label" for="e-cuando">Cuándo</label>
          <input
            id="e-cuando"
            v-model="newEvent.start_at"
            class="input"
            type="datetime-local"
            required
          />
        </div>

        <div class="field">
          <label class="field-label" for="e-quien">Para quién</label>
          <select id="e-quien" v-model="newEvent.assigned_to" class="select">
            <option value="">Todo el equipo</option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.full_name || u.email }}
            </option>
          </select>
        </div>

        <div class="form-actions span-2">
          <button type="submit" class="btn btn-primary">
            <AppIcon name="mas" :size="16" />
            Crear evento
          </button>
        </div>
      </form>
    </div>
  </section>

  <!-- ================= AVISOS ================= -->
  <section v-else class="panel formulario">
    <header class="panel-head">
      <AppIcon name="avisos" :size="17" />
      <h3>Nuevo aviso</h3>
    </header>
    <div class="panel-body">
      <form class="form-grid" @submit.prevent="createNotice">
        <div class="field">
          <label class="field-label" for="a-titulo">Título</label>
          <input
            id="a-titulo"
            v-model="newNotice.title"
            class="input"
            placeholder="Ej. El viernes cerramos a las 14:00"
            required
          />
        </div>

        <div class="field">
          <label class="field-label" for="a-cuerpo">Contenido</label>
          <textarea
            id="a-cuerpo"
            v-model="newNotice.body"
            class="textarea"
            placeholder="Escribe aquí el aviso para el equipo."
          ></textarea>
        </div>

        <div class="field">
          <label class="field-label" for="a-quien">Para quién</label>
          <select id="a-quien" v-model="newNotice.assigned_to" class="select">
            <option value="">Todo el equipo</option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.full_name || u.email }}
            </option>
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <AppIcon name="mas" :size="16" />
            Publicar aviso
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

/* ---------------- Pestañas ---------------- */
.secciones {
  display: flex;
  gap: 0.25rem;
  padding: 4px;
  margin-bottom: 1.25rem;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow-x: auto;
  scrollbar-width: none;
}

.secciones::-webkit-scrollbar {
  display: none;
}

.seccion {
  display: inline-flex;
  align-items: center;
  gap: 0.4375rem;
  flex: 1;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--fast), background-color var(--fast),
    border-color var(--fast);
}

.seccion:hover:not(.activa) {
  color: var(--text);
}

.seccion.activa {
  color: var(--text);
  background: var(--surface);
  border-color: var(--border);
  box-shadow: var(--shadow-xs);
}

.seccion.activa svg {
  color: var(--accent);
}

/* ---------------- Disposición ---------------- */
.columnas {
  display: grid;
  gap: 1.125rem;
  align-items: start;
}

@media (min-width: 960px) {
  .columnas {
    grid-template-columns: 1fr 1fr;
  }
}

.formulario {
  max-width: 620px;
}

.panel-foot {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border-soft);
}

/* ---------------- Lista de usuarios ---------------- */
.lista-usuarios {
  list-style: none;
  margin: 0;
  padding: 0;
}

.usuario {
  display: flex;
  align-items: center;
  gap: 0.6875rem;
  padding: 0.6875rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
}

.usuario:last-child {
  border-bottom: none;
}

.usuario-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  font-family: var(--font-display);
  font-size: 0.6875rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(160deg, var(--steel-500), var(--steel-800));
  border-radius: var(--r-sm);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.usuario-texto {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
}

.usuario-texto strong {
  font-size: 0.875rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usuario-texto span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
