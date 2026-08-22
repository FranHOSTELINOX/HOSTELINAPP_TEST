<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import type { Database } from '../lib/database.types'
import { formatDate, formatDateTime, initials } from '../lib/format'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import PageHeader from '../components/PageHeader.vue'
import type { IconName } from '../components/icons'

type Profile = Database['public']['Tables']['profiles']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type Product = Database['public']['Tables']['products']['Row']
type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']
type Notice = Database['public']['Tables']['notices']['Row']

const users = ref<Profile[]>([])
const projects = ref<Project[]>([])
const products = ref<Product[]>([])
const events = ref<CalendarEvent[]>([])
const notices = ref<Notice[]>([])

const error = ref('')
const message = ref('')
const guardando = ref(false)

// Id del elemento que se está editando (null = se está creando uno nuevo) y
// del que espera confirmación para borrarse. `editandoProd` va aparte porque
// en la pestaña de proyectos hay dos formularios a la vez.
const editando = ref<string | null>(null)
const editandoProd = ref<string | null>(null)
const borrando = ref<string | null>(null)

/** Proyecto cuyos productos se están gestionando. */
const proyectoSel = ref<string | null>(null)

const newProject = ref({ clientName: '', projectName: '', active: true })
const newProduct = ref({ name: '', active: true })
const newEvent = ref({ title: '', description: '', start_at: '', assigned_to: '' })
const newNotice = ref({ title: '', body: '', assigned_to: '' })
const newUser = ref({ full_name: '', email: '', password: '', puesto: '', isAdmin: false })
const editUser = ref({ full_name: '', puesto: '', isAdmin: false })
/** Contraseña nueva que el admin le pone a alguien que ha perdido la suya. */
const nuevaClave = ref('')
const cambiandoClave = ref(false)

type Seccion = 'equipo' | 'proyectos' | 'calendario' | 'avisos'

const secciones: { id: Seccion; etiqueta: string; icono: IconName }[] = [
  { id: 'equipo', etiqueta: 'Equipo', icono: 'usuarios' },
  { id: 'proyectos', etiqueta: 'Proyectos', icono: 'puesto' },
  { id: 'calendario', etiqueta: 'Calendario', icono: 'calendario' },
  { id: 'avisos', etiqueta: 'Avisos', icono: 'avisos' },
]

const seccion = ref<Seccion>('equipo')

function cambiarSeccion(id: Seccion) {
  seccion.value = id
  limpiar()
}

/** Deja los formularios y los avisos como recién entrados en la pantalla. */
function limpiar() {
  editando.value = null
  editandoProd.value = null
  borrando.value = null
  error.value = ''
  message.value = ''
  newProject.value = { clientName: '', projectName: '', active: true }
  newProduct.value = { name: '', active: true }
  newEvent.value = { title: '', description: '', start_at: '', assigned_to: '' }
  newNotice.value = { title: '', body: '', assigned_to: '' }
  newUser.value = { full_name: '', email: '', password: '', puesto: '', isAdmin: false }
  editUser.value = { full_name: '', puesto: '', isAdmin: false }
  nuevaClave.value = ''
}

const admins = computed(() => users.value.filter((u) => u.role === 'admin').length)

const proyectoActual = computed(
  () => projects.value.find((p) => p.id === proyectoSel.value) ?? null,
)

const productosDelProyecto = computed(() =>
  products.value.filter((p) => p.project_id === proyectoSel.value),
)

/** Cuántos productos tiene cada proyecto, para enseñarlo en la lista. */
function cuentaProductos(projectId: string) {
  return products.value.filter((p) => p.project_id === projectId).length
}

function nombreDe(id: string | null, siNulo = 'Todo el equipo') {
  if (!id) return siNulo
  const u = users.value.find((x) => x.id === id)
  return u?.full_name || u?.email || 'Alguien que ya no está'
}

/**
 * <input type="datetime-local"> trabaja con "2026-09-10T08:00" en hora local.
 * La base de datos guarda timestamptz, así que hay que convertir en los dos
 * sentidos; si se manda la cadena tal cual, Postgres la interpreta en UTC y
 * la hora se va un par de horas.
 */
function aInputLocal(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function aISO(local: string): string {
  return new Date(local).toISOString()
}

/**
 * Saca el motivo de verdad cuando falla una Edge Function.
 *
 * supabase-js envuelve las respuestas que no son 2xx en un error cuyo mensaje
 * es siempre el mismo ("Edge Function returned a non-2xx status code") y deja
 * el motivo bueno en el cuerpo de la respuesta. Sin esto, el administrador ve
 * un galimatías en inglés en vez de "La contraseña debe tener al menos 8
 * caracteres", que es justo lo que necesita leer.
 */
async function motivoDeFuncion(err: unknown, porDefecto: string): Promise<string> {
  const respuesta = (err as { context?: Response })?.context

  // 404 = la función no existe todavía en Supabase. Pasa cuando el token de
  // despliegue caduca: el código está subido pero no llegó a desplegarse, y
  // sin este aviso el administrador solo vería un error en inglés.
  if (respuesta?.status === 404) {
    return 'Esta función todavía no está instalada en Supabase. Hay que renovar el token de despliegue; avisa a quien lleve el proyecto.'
  }

  if (respuesta && typeof respuesta.json === 'function') {
    try {
      const cuerpo = await respuesta.json()
      if (cuerpo?.error) return String(cuerpo.error)
    } catch {
      // El cuerpo no era JSON; nos quedamos con el mensaje de siempre.
    }
  }
  return err instanceof Error ? err.message : porDefecto
}

/** Traduce el error de clave ajena a algo que se entienda. */
function explicaError(e: { message: string; code?: string }): string {
  if (e.code === '23503' || /foreign key|violates/i.test(e.message)) {
    return 'No se puede borrar porque ya tiene horas imputadas. Desactívalo en vez de borrarlo, así se queda fuera de la lista pero no se pierde el histórico.'
  }
  return e.message
}

// ---------------------------------------------------------------- cargas
async function loadUsers() {
  const { data, error: e } = await supabase
    .from('profiles')
    .select('*')
    .order('email', { ascending: true })
  if (e) error.value = e.message
  else users.value = data ?? []
}

async function loadProjects() {
  const { data, error: e } = await supabase.from('projects').select('*').order('client_name')
  if (e) error.value = e.message
  else projects.value = data ?? []
}

async function loadProducts() {
  const { data, error: e } = await supabase.from('products').select('*').order('name')
  if (e) error.value = e.message
  else products.value = data ?? []
}

async function loadEvents() {
  const { data, error: e } = await supabase
    .from('calendar_events')
    .select('*')
    .order('start_at', { ascending: true })
  if (e) error.value = e.message
  else events.value = data ?? []
}

async function loadNotices() {
  const { data, error: e } = await supabase
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false })
  if (e) error.value = e.message
  else notices.value = data ?? []
}

// -------------------------------------------------------------- proyectos
function editarProyecto(p: Project) {
  editando.value = p.id
  borrando.value = null
  error.value = ''
  message.value = ''
  newProject.value = {
    clientName: p.client_name,
    projectName: p.project_name ?? '',
    active: p.active,
  }
}

async function guardarProyecto() {
  if (!session.value) return
  error.value = ''
  message.value = ''
  guardando.value = true

  const campos = {
    client_name: newProject.value.clientName,
    project_name: newProject.value.projectName || null,
    active: newProject.value.active,
  }

  const { error: e } = editando.value
    ? await supabase.from('projects').update(campos).eq('id', editando.value)
    : await supabase
        .from('projects')
        .insert({ ...campos, created_by: session.value.user.id })

  guardando.value = false
  if (e) {
    error.value = e.message
    return
  }
  const eraEdicion = editando.value
  limpiar()
  message.value = eraEdicion ? 'Proyecto actualizado.' : 'Proyecto creado.'
  await loadProjects()
}

/**
 * Le pone una contraseña nueva a otra persona. Va por Edge Function porque
 * exige permisos de administrador sobre Supabase Auth, y esos no pueden
 * estar en el navegador.
 */
async function cambiarClave() {
  if (!editando.value) return
  error.value = ''
  message.value = ''

  if (nuevaClave.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  cambiandoClave.value = true
  try {
    const { data, error: fnError } = await supabase.functions.invoke('admin-set-password', {
      body: { user_id: editando.value, password: nuevaClave.value },
    })
    if (fnError) throw fnError
    if (data?.error) throw new Error(data.error)

    const quien = nombreDe(editando.value, '')
    message.value = `Contraseña cambiada. Pásasela a ${quien} y que se la cambie al entrar.`
    nuevaClave.value = ''
  } catch (err) {
    error.value = await motivoDeFuncion(err, 'No se pudo cambiar la contraseña')
  } finally {
    cambiandoClave.value = false
  }
}

async function borrarProyecto(id: string) {
  error.value = ''
  const { error: e } = await supabase.from('projects').delete().eq('id', id)
  borrando.value = null
  if (e) {
    error.value = explicaError(e)
    return
  }
  if (editando.value === id) limpiar()
  if (proyectoSel.value === id) proyectoSel.value = null
  message.value = 'Proyecto borrado.'
  await Promise.all([loadProjects(), loadProducts()])
}

function elegirProyecto(id: string) {
  proyectoSel.value = proyectoSel.value === id ? null : id
  editandoProd.value = null
  newProduct.value = { name: '', active: true }
}

// -------------------------------------------------------------- productos
function editarProducto(p: Product) {
  editandoProd.value = p.id
  borrando.value = null
  error.value = ''
  message.value = ''
  newProduct.value = { name: p.name, active: p.active }
}

async function guardarProducto() {
  if (!session.value || !proyectoSel.value) return
  error.value = ''
  message.value = ''
  guardando.value = true

  const campos = { name: newProduct.value.name, active: newProduct.value.active }

  const { error: e } = editandoProd.value
    ? await supabase.from('products').update(campos).eq('id', editandoProd.value)
    : await supabase.from('products').insert({
        ...campos,
        project_id: proyectoSel.value,
        created_by: session.value.user.id,
      })

  guardando.value = false
  if (e) {
    error.value = e.message
    return
  }
  const eraEdicion = editandoProd.value
  editandoProd.value = null
  newProduct.value = { name: '', active: true }
  message.value = eraEdicion ? 'Producto actualizado.' : 'Producto creado.'
  await loadProducts()
}

async function borrarProducto(id: string) {
  error.value = ''
  const { error: e } = await supabase.from('products').delete().eq('id', id)
  borrando.value = null
  if (e) {
    error.value = explicaError(e)
    return
  }
  if (editandoProd.value === id) {
    editandoProd.value = null
    newProduct.value = { name: '', active: true }
  }
  message.value = 'Producto borrado.'
  await loadProducts()
}

// ------------------------------------------------------------- calendario
function editarEvento(ev: CalendarEvent) {
  editando.value = ev.id
  borrando.value = null
  error.value = ''
  message.value = ''
  newEvent.value = {
    title: ev.title,
    description: ev.description ?? '',
    start_at: aInputLocal(ev.start_at),
    assigned_to: ev.assigned_to ?? '',
  }
}

async function guardarEvento() {
  if (!session.value) return
  error.value = ''
  message.value = ''
  guardando.value = true

  const campos = {
    title: newEvent.value.title,
    description: newEvent.value.description || null,
    start_at: aISO(newEvent.value.start_at),
    assigned_to: newEvent.value.assigned_to || null,
  }

  const { error: e } = editando.value
    ? await supabase.from('calendar_events').update(campos).eq('id', editando.value)
    : await supabase
        .from('calendar_events')
        .insert({ ...campos, created_by: session.value.user.id })

  guardando.value = false
  if (e) {
    error.value = e.message
    return
  }
  const eraEdicion = editando.value
  limpiar()
  message.value = eraEdicion ? 'Evento actualizado.' : 'Evento creado.'
  await loadEvents()
}

async function borrarEvento(id: string) {
  error.value = ''
  const { error: e } = await supabase.from('calendar_events').delete().eq('id', id)
  borrando.value = null
  if (e) {
    error.value = e.message
    return
  }
  if (editando.value === id) limpiar()
  message.value = 'Evento borrado.'
  await loadEvents()
}

// ----------------------------------------------------------------- avisos
function editarAviso(n: Notice) {
  editando.value = n.id
  borrando.value = null
  error.value = ''
  message.value = ''
  newNotice.value = { title: n.title, body: n.body ?? '', assigned_to: n.assigned_to ?? '' }
}

async function guardarAviso() {
  if (!session.value) return
  error.value = ''
  message.value = ''
  guardando.value = true

  const campos = {
    title: newNotice.value.title,
    body: newNotice.value.body || null,
    assigned_to: newNotice.value.assigned_to || null,
  }

  const { error: e } = editando.value
    ? await supabase.from('notices').update(campos).eq('id', editando.value)
    : await supabase.from('notices').insert({ ...campos, created_by: session.value.user.id })

  guardando.value = false
  if (e) {
    error.value = e.message
    return
  }
  const eraEdicion = editando.value
  limpiar()
  message.value = eraEdicion ? 'Aviso actualizado.' : 'Aviso publicado.'
  await loadNotices()
}

async function borrarAviso(id: string) {
  error.value = ''
  const { error: e } = await supabase.from('notices').delete().eq('id', id)
  borrando.value = null
  if (e) {
    error.value = e.message
    return
  }
  if (editando.value === id) limpiar()
  message.value = 'Aviso borrado.'
  await loadNotices()
}

// ----------------------------------------------------------------- equipo
function editarUsuario(u: Profile) {
  editando.value = u.id
  borrando.value = null
  error.value = ''
  message.value = ''
  editUser.value = {
    full_name: u.full_name ?? '',
    puesto: u.puesto ?? '',
    isAdmin: u.role === 'admin',
  }
}

async function guardarUsuario() {
  if (!editando.value) return
  error.value = ''
  message.value = ''

  // Quitarse a uno mismo el rol de administrador deja la cuenta fuera del
  // panel al instante, así que no se permite desde aquí.
  const esYoMismo = editando.value === session.value?.user.id
  if (esYoMismo && !editUser.value.isAdmin) {
    error.value = 'No puedes quitarte a ti mismo el rol de administrador.'
    return
  }

  guardando.value = true
  const { error: e } = await supabase
    .from('profiles')
    .update({
      full_name: editUser.value.full_name || null,
      puesto: editUser.value.puesto || null,
      role: editUser.value.isAdmin ? 'admin' : 'user',
    })
    .eq('id', editando.value)

  guardando.value = false
  if (e) {
    error.value = e.message
    return
  }
  limpiar()
  message.value = 'Usuario actualizado.'
  await loadUsers()
}

async function createUser() {
  error.value = ''
  message.value = ''

  if (newUser.value.password.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  guardando.value = true
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

    const eraAdmin = newUser.value.isAdmin
    limpiar()
    message.value = eraAdmin ? 'Administrador creado.' : 'Usuario creado.'
    await loadUsers()
  } catch (err) {
    error.value = await motivoDeFuncion(err, 'No se pudo crear el usuario')
  } finally {
    guardando.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadUsers(),
    loadProjects(),
    loadProducts(),
    loadEvents(),
    loadNotices(),
  ])
})
</script>

<template>
  <PageHeader
    eyebrow="Panel del administrador"
    title="Administración"
    subtitle="Da de alta al equipo, monta el catálogo de proyectos y reparte eventos y avisos."
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
    <section v-if="editando" class="panel">
      <header class="panel-head">
        <AppIcon name="usuario" :size="17" />
        <h3>Editar usuario</h3>
      </header>
      <div class="panel-body">
        <p class="small muted intro">{{ nombreDe(editando, '') }}</p>
        <form class="form-grid form-grid-2" @submit.prevent="guardarUsuario">
          <div class="field span-2">
            <label class="field-label" for="eu-nombre">Nombre completo</label>
            <input id="eu-nombre" v-model="editUser.full_name" class="input" required />
          </div>

          <div class="field span-2">
            <label class="field-label" for="eu-puesto">Puesto</label>
            <input
              id="eu-puesto"
              v-model="editUser.puesto"
              class="input"
              placeholder="Ej. Taller, Montaje…"
            />
          </div>

          <label class="switch span-2">
            <input v-model="editUser.isAdmin" type="checkbox" />
            <span class="switch-text">
              <strong>Es administrador</strong><br />
              <span class="small muted">
                Podrá crear y editar usuarios, proyectos, eventos y avisos.
              </span>
            </span>
          </label>

          <div class="form-actions span-2">
            <button type="submit" class="btn btn-primary" :disabled="guardando">
              {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
            </button>
            <button type="button" class="btn btn-ghost" @click="limpiar">Cancelar</button>
          </div>
        </form>

        <!-- Aparte del resto, y con su propio botón: cambiar la contraseña no
             es lo mismo que corregirle el puesto, y no debe irse en el mismo
             "Guardar cambios" sin querer. -->
        <div class="clave">
          <p class="eyebrow">Si ha perdido su contraseña</p>
          <p class="small muted">
            Ponle una nueva y pásasela. Al entrar, él puede cambiarla desde
            «Contraseña». No hace falta saber la anterior.
          </p>
          <form class="clave-form" @submit.prevent="cambiarClave">
            <div class="field">
              <label class="field-label" for="eu-clave">Nueva contraseña</label>
              <!-- A la vista y no con puntitos: el administrador tiene que
                   poder leerla para dictársela. -->
              <input
                id="eu-clave"
                v-model="nuevaClave"
                class="input"
                type="text"
                autocomplete="off"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <button
              type="submit"
              class="btn"
              :disabled="cambiandoClave || nuevaClave.length < 8"
            >
              {{ cambiandoClave ? 'Cambiando…' : 'Cambiar contraseña' }}
            </button>
          </form>
        </div>
      </div>
    </section>

    <section v-else class="panel">
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
                Podrá crear y editar usuarios, proyectos, eventos y avisos como tú.
              </span>
            </span>
          </label>

          <div class="form-actions span-2">
            <button type="submit" class="btn btn-primary" :disabled="guardando">
              <AppIcon name="mas" :size="16" />
              {{ guardando ? 'Creando…' : 'Crear usuario' }}
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

      <ul v-else class="lista">
        <li v-for="u in users" :key="u.id" class="fila" :class="{ activa: editando === u.id }">
          <span class="usuario-avatar">{{ initials(u.full_name || u.email) }}</span>
          <span class="fila-texto">
            <strong>{{ u.full_name || u.email }}</strong>
            <span class="small dim">{{ u.email }}</span>
          </span>
          <span v-if="u.puesto" class="pill pill-plain">{{ u.puesto }}</span>
          <span v-if="u.role === 'admin'" class="pill pill-accent">Admin</span>
          <span class="acciones">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-label="`Editar ${u.full_name || u.email}`"
              @click="editarUsuario(u)"
            >
              <AppIcon name="editar" :size="15" />
            </button>
          </span>
        </li>
      </ul>

      <footer v-if="users.length > 0" class="panel-foot small dim">
        {{ admins }} {{ admins === 1 ? 'administrador' : 'administradores' }} ·
        {{ users.length - admins }} del equipo · las cuentas no se borran desde
        aquí, se borran en Supabase
      </footer>
    </section>
  </div>

  <!-- ================= PROYECTOS Y PRODUCTOS ================= -->
  <div v-else-if="seccion === 'proyectos'" class="columnas">
    <!-- Proyectos -->
    <div class="stack">
      <section class="panel">
        <header class="panel-head">
          <AppIcon name="puesto" :size="17" />
          <h3>{{ editando ? 'Editar proyecto' : 'Nuevo proyecto' }}</h3>
        </header>
        <div class="panel-body">
          <form class="form-grid" @submit.prevent="guardarProyecto">
            <div class="field">
              <label class="field-label" for="p-cliente">Nombre del cliente</label>
              <input
                id="p-cliente"
                v-model="newProject.clientName"
                class="input"
                placeholder="Ej. Hoteles del Sur, S.L."
                required
              />
            </div>

            <div class="field">
              <label class="field-label" for="p-nombre">Proyecto (opcional)</label>
              <input
                id="p-nombre"
                v-model="newProject.projectName"
                class="input"
                placeholder="Ej. Hotel Giralda"
              />
            </div>

            <label class="switch">
              <input v-model="newProject.active" type="checkbox" />
              <span class="switch-text">
                <strong>Activo</strong><br />
                <span class="small muted">
                  Si lo desactivas, deja de aparecer al imputar horas, pero el
                  histórico se conserva.
                </span>
              </span>
            </label>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="guardando">
                <AppIcon v-if="!editando" name="mas" :size="16" />
                {{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cliente' }}
              </button>
              <button v-if="editando" type="button" class="btn btn-ghost" @click="limpiar">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <AppIcon name="puesto" :size="17" />
          <h3>Proyectos</h3>
          <span class="spacer"></span>
          <span class="pill pill-plain small">{{ projects.length }}</span>
        </header>

        <p v-if="projects.length === 0" class="panel-body muted small">
          Todavía no hay ningún proyecto. Crea el primero para que el equipo
          pueda imputarle horas.
        </p>

        <ul v-else class="lista">
          <li
            v-for="p in projects"
            :key="p.id"
            class="fila"
            :class="{ activa: editando === p.id, elegida: proyectoSel === p.id }"
          >
            <button type="button" class="fila-elegir" @click="elegirProyecto(p.id)">
              <span class="fila-texto">
                <strong>{{ p.client_name }}</strong>
                <span class="small dim">
                  {{ p.project_name || 'Sin proyecto' }} ·
                  {{ cuentaProductos(p.id) }}
                  {{ cuentaProductos(p.id) === 1 ? 'producto' : 'productos' }}
                </span>
              </span>
            </button>
            <span v-if="!p.active" class="pill pill-plain">Inactivo</span>

            <span v-if="borrando === p.id" class="acciones confirmar">
              <span class="small">¿Seguro?</span>
              <button type="button" class="btn btn-danger btn-sm" @click="borrarProyecto(p.id)">
                Sí, borrar
              </button>
              <button type="button" class="btn btn-ghost btn-sm" @click="borrando = null">
                No
              </button>
            </span>
            <span v-else class="acciones">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="`Editar ${p.client_name}`"
                @click="editarProyecto(p)"
              >
                <AppIcon name="editar" :size="15" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="`Borrar ${p.client_name}`"
                @click="borrando = p.id"
              >
                <AppIcon name="borrar" :size="15" />
              </button>
            </span>
          </li>
        </ul>
      </section>
    </div>

    <!-- Productos del proyecto elegido -->
    <section class="panel">
      <header class="panel-head">
        <AppIcon name="tareas" :size="17" />
        <h3>Productos</h3>
        <span class="spacer"></span>
        <span v-if="proyectoActual" class="pill pill-accent">{{ proyectoActual.client_name }}</span>
      </header>

      <p v-if="!proyectoActual" class="panel-body muted small">
        Elige un proyecto de la lista de la izquierda para ver y crear sus
        productos.
      </p>

      <template v-else>
        <div class="panel-body">
          <form class="form-grid" @submit.prevent="guardarProducto">
            <div class="field">
              <label class="field-label" for="pr-nombre">
                {{ editandoProd ? 'Editar producto' : 'Nuevo producto' }}
              </label>
              <input
                id="pr-nombre"
                v-model="newProduct.name"
                class="input"
                placeholder="Ej. Campana mural 3000×1100"
                required
              />
            </div>

            <label class="switch">
              <input v-model="newProduct.active" type="checkbox" />
              <span class="switch-text"><strong>Activo</strong></span>
            </label>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="guardando">
                <AppIcon v-if="!editandoProd" name="mas" :size="16" />
                {{ guardando ? 'Guardando…' : editandoProd ? 'Guardar cambios' : 'Añadir producto' }}
              </button>
              <button
                v-if="editandoProd"
                type="button"
                class="btn btn-ghost"
                @click="editandoProd = null; newProduct = { name: '', active: true }"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        <p v-if="productosDelProyecto.length === 0" class="panel-foot muted small">
          Este proyecto todavía no tiene productos.
        </p>

        <ul v-else class="lista lista-arriba">
          <li
            v-for="p in productosDelProyecto"
            :key="p.id"
            class="fila"
            :class="{ activa: editandoProd === p.id }"
          >
            <span class="fila-texto">
              <strong>{{ p.name }}</strong>
              <span class="small dim">Añadido el {{ formatDate(p.created_at) }}</span>
            </span>
            <span v-if="!p.active" class="pill pill-plain">Inactivo</span>

            <span v-if="borrando === p.id" class="acciones confirmar">
              <span class="small">¿Seguro?</span>
              <button type="button" class="btn btn-danger btn-sm" @click="borrarProducto(p.id)">
                Sí, borrar
              </button>
              <button type="button" class="btn btn-ghost btn-sm" @click="borrando = null">
                No
              </button>
            </span>
            <span v-else class="acciones">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="`Editar ${p.name}`"
                @click="editarProducto(p)"
              >
                <AppIcon name="editar" :size="15" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :aria-label="`Borrar ${p.name}`"
                @click="borrando = p.id"
              >
                <AppIcon name="borrar" :size="15" />
              </button>
            </span>
          </li>
        </ul>
      </template>
    </section>
  </div>

  <!-- ================= CALENDARIO ================= -->
  <div v-else-if="seccion === 'calendario'" class="columnas">
    <section class="panel">
      <header class="panel-head">
        <AppIcon name="calendario" :size="17" />
        <h3>{{ editando ? 'Editar evento' : 'Nuevo evento' }}</h3>
      </header>
      <div class="panel-body">
        <form class="form-grid form-grid-2" @submit.prevent="guardarEvento">
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
            <button type="submit" class="btn btn-primary" :disabled="guardando">
              <AppIcon v-if="!editando" name="mas" :size="16" />
              {{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear evento' }}
            </button>
            <button v-if="editando" type="button" class="btn btn-ghost" @click="limpiar">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <AppIcon name="calendario" :size="17" />
        <h3>Eventos</h3>
        <span class="spacer"></span>
        <span class="pill pill-plain small">{{ events.length }}</span>
      </header>

      <p v-if="events.length === 0" class="panel-body muted small">
        Todavía no has creado ningún evento.
      </p>

      <ul v-else class="lista">
        <li v-for="ev in events" :key="ev.id" class="fila" :class="{ activa: editando === ev.id }">
          <span class="fila-texto">
            <strong>{{ ev.title }}</strong>
            <span class="small dim">
              {{ formatDateTime(ev.start_at) }} · {{ nombreDe(ev.assigned_to) }}
            </span>
          </span>

          <span v-if="borrando === ev.id" class="acciones confirmar">
            <span class="small">¿Seguro?</span>
            <button type="button" class="btn btn-danger btn-sm" @click="borrarEvento(ev.id)">
              Sí, borrar
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="borrando = null">
              No
            </button>
          </span>
          <span v-else class="acciones">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-label="`Editar ${ev.title}`"
              @click="editarEvento(ev)"
            >
              <AppIcon name="editar" :size="15" />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-label="`Borrar ${ev.title}`"
              @click="borrando = ev.id"
            >
              <AppIcon name="borrar" :size="15" />
            </button>
          </span>
        </li>
      </ul>
    </section>
  </div>

  <!-- ================= AVISOS ================= -->
  <div v-else class="columnas">
    <section class="panel">
      <header class="panel-head">
        <AppIcon name="avisos" :size="17" />
        <h3>{{ editando ? 'Editar aviso' : 'Nuevo aviso' }}</h3>
      </header>
      <div class="panel-body">
        <form class="form-grid" @submit.prevent="guardarAviso">
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
            <button type="submit" class="btn btn-primary" :disabled="guardando">
              <AppIcon v-if="!editando" name="mas" :size="16" />
              {{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar aviso' }}
            </button>
            <button v-if="editando" type="button" class="btn btn-ghost" @click="limpiar">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <AppIcon name="avisos" :size="17" />
        <h3>Avisos</h3>
        <span class="spacer"></span>
        <span class="pill pill-plain small">{{ notices.length }}</span>
      </header>

      <p v-if="notices.length === 0" class="panel-body muted small">
        Todavía no has publicado ningún aviso.
      </p>

      <ul v-else class="lista">
        <li v-for="n in notices" :key="n.id" class="fila" :class="{ activa: editando === n.id }">
          <span class="fila-texto">
            <strong>{{ n.title }}</strong>
            <span class="small dim">
              {{ formatDate(n.created_at) }} · {{ nombreDe(n.assigned_to) }}
            </span>
          </span>

          <span v-if="borrando === n.id" class="acciones confirmar">
            <span class="small">¿Seguro?</span>
            <button type="button" class="btn btn-danger btn-sm" @click="borrarAviso(n.id)">
              Sí, borrar
            </button>
            <button type="button" class="btn btn-ghost btn-sm" @click="borrando = null">
              No
            </button>
          </span>
          <span v-else class="acciones">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-label="`Editar ${n.title}`"
              @click="editarAviso(n)"
            >
              <AppIcon name="editar" :size="15" />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-label="`Borrar ${n.title}`"
              @click="borrando = n.id"
            >
              <AppIcon name="borrar" :size="15" />
            </button>
          </span>
        </li>
      </ul>
    </section>
  </div>
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
  min-height: 38px;
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

/* Sin esto, un hijo que no sabe encogerse (una fila con pastillas que no
   parten) estira la columna entera y saca la página de la pantalla. */
.columnas > * {
  min-width: 0;
}

@media (min-width: 960px) {
  .columnas {
    grid-template-columns: 1fr 1fr;
  }
}

.intro {
  margin-bottom: 1.125rem;
  line-height: 1.55;
}

.panel-foot {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border-soft);
  line-height: 1.5;
}

/* ---------------- Listas con acciones ---------------- */
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lista-arriba {
  border-top: 1px solid var(--border-soft);
}

.fila {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem 0.6875rem;
  padding: 0.6875rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  transition: background-color var(--fast);
}

.fila:last-child {
  border-bottom: none;
}

/* La fila que se está editando ahora mismo */
.fila.activa {
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}

/* El proyecto cuyos productos se están viendo */
.fila.elegida:not(.activa) {
  background: var(--surface-inset);
  box-shadow: inset 3px 0 0 var(--border-strong);
}

/* El texto crece hasta empujar pastillas y botones a la derecha, pero por
   debajo de 200 px se pasa él solo a su propia línea en vez de recortarse
   hasta quedarse en "Rema…". */
.fila-texto {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
  flex: 1 1 200px;
}

.fila-texto strong {
  font-size: 0.875rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* La segunda línea (quién y cuándo) sí se recorta: es información de apoyo. */
.fila-texto span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* En la lista de proyectos, el texto es el botón que elige el proyecto. */
.fila-elegir {
  display: flex;
  flex: 1 1 200px;
  min-width: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.fila-elegir:hover .fila-texto strong {
  color: var(--accent-text);
}

.fila .acciones {
  margin-left: auto;
}

.clave {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}

.clave p {
  margin: 0 0 0.5rem;
}

.clave-form {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 0.625rem;
  margin-top: 0.75rem;
}

.clave-form .field {
  flex: 1 1 12rem;
  min-width: 0;
}

.acciones {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: none;
}

.acciones .btn-sm {
  padding: 0;
  width: 32px;
  min-height: 32px;
  justify-content: center;
}

/* Cuando pide confirmación, los botones sí llevan texto */
.confirmar {
  gap: 0.375rem;
}

.confirmar .btn-sm {
  width: auto;
  padding: 0.375rem 0.6875rem;
}

.confirmar .small {
  color: var(--danger-fg);
  font-weight: 600;
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
</style>
