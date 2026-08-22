<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import { esAdmin } from '../stores/vista'
import type { Database } from '../lib/database.types'
import {
  daysFromToday,
  entryDuration,
  etiquetaProyecto,
  formatDate,
  formatDuration,
  formatTime,
} from '../lib/format'
import {
  avisoDeHorario,
  describeHorario,
  franjasDelDia,
  minutosPrevistos,
} from '../lib/horario'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingList from '../components/LoadingList.vue'
import PageHeader from '../components/PageHeader.vue'

type TimeEntry = Database['public']['Tables']['time_entries']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type Product = Database['public']['Tables']['products']['Row']

const entries = ref<TimeEntry[]>([])
const projects = ref<Project[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const guardando = ref(false)

/** Fecha de hoy en el formato que entiende <input type="date">. */
function hoyISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const parte = ref({
  fecha: hoyISO(),
  proyectoId: '',
  productoId: '',
  desde: '',
  hasta: '',
  notes: '',
})

/** Solo el administrador puede imputar horas sin decir a qué producto. */
const requiereProducto = computed(() => !esAdmin.value)

const proyectosActivos = computed(() => projects.value.filter((p) => p.active))

const productosDelProyecto = computed(() =>
  products.value.filter((p) => p.project_id === parte.value.proyectoId && p.active),
)

// Si cambia el proyecto, el producto elegido deja de tener sentido.
watch(
  () => parte.value.proyectoId,
  () => {
    parte.value.productoId = ''
  },
)

/** El día elegido, como Date, para preguntarle al horario. */
const diaElegido = computed(() =>
  parte.value.fecha ? new Date(`${parte.value.fecha}T12:00`) : new Date(),
)

/** Los huecos de 15 min que se pueden elegir ese día, por tramo. */
const franjas = computed(() => franjasDelDia(diaElegido.value))

const seTrabaja = computed(() => franjas.value.length > 0)

/**
 * Para "hasta" solo tienen sentido las horas posteriores a la de inicio, así
 * que las anteriores ni se ofrecen.
 */
const franjasHasta = computed(() =>
  franjas.value
    .map((f) => ({
      etiqueta: f.etiqueta,
      horas: f.horas.filter((h) => !parte.value.desde || h > parte.value.desde),
    }))
    .filter((f) => f.horas.length > 0),
)

// Al cambiar de día cambian los huecos disponibles, así que las horas
// elegidas antes pueden dejar de existir.
watch(
  () => parte.value.fecha,
  () => {
    parte.value.desde = ''
    parte.value.hasta = ''
  },
)

// Si "hasta" se queda antes o igual que "desde", deja de valer.
watch(
  () => parte.value.desde,
  () => {
    if (parte.value.hasta && parte.value.hasta <= parte.value.desde) {
      parte.value.hasta = ''
    }
  },
)

const horarioDeHoy = computed(() => describeHorario(new Date()))
const previstoHoy = computed(() => minutosPrevistos(new Date()) * 60_000)

const cerradas = computed(() => entries.value.filter((e) => e.ended_at))

/** Registros que se quedaron abiertos con el cronómetro de antes. */
const abiertas = computed(() => entries.value.filter((e) => !e.ended_at))

/** Aviso en vivo mientras se rellena el parte. */
const aviso = computed(() => {
  const { fecha, desde, hasta } = parte.value
  if (!fecha || !desde || !hasta) return null
  return avisoDeHorario(new Date(`${fecha}T${desde}`), new Date(`${fecha}T${hasta}`))
})

/** Cuánto suma el rato elegido, para enseñarlo antes de guardar. */
const duracionElegida = computed(() => {
  const { fecha, desde, hasta } = parte.value
  if (!fecha || !desde || !hasta) return 0
  return new Date(`${fecha}T${hasta}`).getTime() - new Date(`${fecha}T${desde}`).getTime()
})

/** Nombre "Proyecto · Producto" de un registro, para las listas. */
function etiquetaProducto(productId: string | null): string {
  if (!productId) return 'Sin producto'
  const producto = products.value.find((p) => p.id === productId)
  if (!producto) return 'Producto borrado'
  const proyecto = projects.value.find((p) => p.id === producto.project_id)
  return proyecto
    ? `${etiquetaProyecto(proyecto.client_name, proyecto.project_name)} · ${producto.name}`
    : producto.name
}

const totalHoy = computed(() =>
  cerradas.value
    .filter((e) => daysFromToday(e.started_at) === 0)
    .reduce((suma, e) => suma + entryDuration(e.started_at, e.ended_at as string), 0),
)

const totalSemana = computed(() =>
  cerradas.value
    .filter((e) => daysFromToday(e.started_at) > -7)
    .reduce((suma, e) => suma + entryDuration(e.started_at, e.ended_at as string), 0),
)

/** Los registros, agrupados por día para que la lista se lea mejor. */
const porDia = computed(() => {
  const grupos = new Map<string, { etiqueta: string; total: number; items: TimeEntry[] }>()
  for (const entry of cerradas.value) {
    const fecha = new Date(entry.started_at)
    const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`
    const dias = daysFromToday(entry.started_at)
    const etiqueta = dias === 0 ? 'Hoy' : dias === -1 ? 'Ayer' : formatDate(entry.started_at)
    const grupo = grupos.get(clave) ?? { etiqueta, total: 0, items: [] }
    grupo.items.push(entry)
    grupo.total += entryDuration(entry.started_at, entry.ended_at as string)
    grupos.set(clave, grupo)
  }
  return [...grupos.values()]
})

async function cargarCatalogo() {
  const [pr, pd] = await Promise.all([
    supabase.from('projects').select('*').order('client_name'),
    supabase.from('products').select('*').order('name'),
  ])
  if (pr.error) error.value = pr.error.message
  else projects.value = pr.data ?? []
  if (pd.error) error.value = pd.error.message
  else products.value = pd.data ?? []
}

async function loadEntries() {
  const { data, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .order('started_at', { ascending: false })

  if (fetchError) error.value = fetchError.message
  else entries.value = data ?? []
}

async function guardar() {
  if (!session.value) return
  error.value = ''
  message.value = ''

  if (requiereProducto.value && !parte.value.productoId) {
    error.value = 'Elige el cliente y el producto al que imputas las horas.'
    return
  }

  const { fecha, desde, hasta } = parte.value
  const inicio = new Date(`${fecha}T${desde}`)
  const fin = new Date(`${fecha}T${hasta}`)
  if (fin <= inicio) {
    error.value = 'La hora de fin tiene que ser posterior a la de inicio.'
    return
  }

  guardando.value = true
  const { error: insertError } = await supabase.from('time_entries').insert({
    user_id: session.value.user.id,
    product_id: parte.value.productoId || null,
    started_at: inicio.toISOString(),
    ended_at: fin.toISOString(),
    notes: parte.value.notes || null,
  })
  guardando.value = false

  if (insertError) {
    error.value = insertError.message
    return
  }

  message.value = `Apuntadas ${formatDuration(fin.getTime() - inicio.getTime())}.`
  // Se conservan día, proyecto y producto: lo normal es apuntar varios ratos
  // seguidos del mismo trabajo.
  parte.value.desde = ''
  parte.value.hasta = ''
  parte.value.notes = ''
  await loadEntries()
}

// Borrar un registro es cosa del administrador (política RLS
// time_entries_delete_admin). El botón solo se le enseña a él; esta guarda
// está por si acaso.
async function borrarRegistro(id: string) {
  if (!esAdmin.value) return
  error.value = ''
  const { error: e } = await supabase.from('time_entries').delete().eq('id', id)
  if (e) {
    error.value = e.message
    return
  }
  message.value = 'Registro borrado.'
  await loadEntries()
}

onMounted(async () => {
  await Promise.all([cargarCatalogo(), loadEntries()])
  loading.value = false
})
</script>

<template>
  <PageHeader
    eyebrow="Mi jornada"
    title="Registro de tiempos"
    subtitle="Apunta las horas que has echado en cada producto."
  >
    <template #acciones>
      <span class="pill pill-plain horario">
        <AppIcon name="reloj" :size="13" />
        Hoy: {{ horarioDeHoy }}
      </span>
    </template>
  </PageHeader>

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>
  <AlertMessage v-if="message" kind="success" class="mb">{{ message }}</AlertMessage>

  <LoadingList v-if="loading" :rows="3" />

  <template v-else>
    <EmptyState
      v-if="proyectosActivos.length === 0 && requiereProducto"
      icon="puesto"
      title="Todavía no hay clientes en el catálogo"
      text="El administrador tiene que dar de alta los clientes y sus productos antes de que puedas imputar horas."
    />

    <template v-else>
      <!-- ---------- El parte de horas ---------- -->
      <section class="panel parte">
        <header class="panel-head">
          <AppIcon name="nota" :size="17" />
          <h3>Imputar horas</h3>
        </header>

        <div class="panel-body">
          <form class="form-grid campos" @submit.prevent="guardar">
            <div class="field">
              <label class="field-label" for="fecha">Día</label>
              <input id="fecha" v-model="parte.fecha" class="input" type="date" required />
            </div>

            <div class="field">
              <label class="field-label" for="proyecto">Cliente</label>
              <select id="proyecto" v-model="parte.proyectoId" class="select">
                <option value="">Elige un cliente…</option>
                <option v-for="p in proyectosActivos" :key="p.id" :value="p.id">
                  {{ etiquetaProyecto(p.client_name, p.project_name) }}
                </option>
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="producto">Producto</label>
              <select
                id="producto"
                v-model="parte.productoId"
                class="select"
                :disabled="!parte.proyectoId"
              >
                <option value="">
                  {{ parte.proyectoId ? 'Elige un producto…' : 'Elige antes el cliente' }}
                </option>
                <option v-for="p in productosDelProyecto" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
              <p
                v-if="parte.proyectoId && productosDelProyecto.length === 0"
                class="field-hint aviso"
              >
                Este proyecto todavía no tiene productos.
              </p>
            </div>

            <div class="field">
              <label class="field-label" for="desde">Desde</label>
              <select
                id="desde"
                v-model="parte.desde"
                class="select"
                :disabled="!seTrabaja"
                required
              >
                <option value="">{{ seTrabaja ? 'Hora…' : 'No se trabaja' }}</option>
                <optgroup v-for="f in franjas" :key="f.etiqueta" :label="f.etiqueta">
                  <option v-for="h in f.horas" :key="h" :value="h">{{ h }}</option>
                </optgroup>
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="hasta">Hasta</label>
              <select
                id="hasta"
                v-model="parte.hasta"
                class="select"
                :disabled="!seTrabaja || !parte.desde"
                required
              >
                <option value="">
                  {{ !seTrabaja ? 'No se trabaja' : parte.desde ? 'Hora…' : 'Elige antes la de inicio' }}
                </option>
                <optgroup v-for="f in franjasHasta" :key="f.etiqueta" :label="f.etiqueta">
                  <option v-for="h in f.horas" :key="h" :value="h">{{ h }}</option>
                </optgroup>
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="nota">Nota (opcional)</label>
              <input
                id="nota"
                v-model="parte.notes"
                class="input"
                placeholder="Ej. soldadura del bastidor"
              />
            </div>

            <p v-if="!seTrabaja" class="alert span-todo aviso-horario">
              <AppIcon name="aviso" :size="16" />
              <span>Ese día no se trabaja según el horario del taller.</span>
            </p>

            <p v-else-if="aviso" class="alert span-todo aviso-horario">
              <AppIcon name="aviso" :size="16" />
              <span>{{ aviso }}</span>
            </p>

            <div class="form-actions span-todo">
              <button
                type="submit"
                class="btn btn-primary btn-lg"
                :disabled="guardando || !seTrabaja"
              >
                <AppIcon name="mas" :size="16" />
                {{ guardando ? 'Guardando…' : 'Apuntar horas' }}
              </button>
              <span v-if="duracionElegida > 0" class="duracion">
                Son <strong>{{ formatDuration(duracionElegida) }}</strong>
              </span>
            </div>
          </form>
        </div>
      </section>

      <!-- ---------- Restos del cronómetro de antes ---------- -->
      <section v-if="abiertas.length > 0" class="panel sin-cerrar">
        <header class="panel-head">
          <AppIcon name="aviso" :size="17" />
          <h3>Registros sin cerrar</h3>
        </header>
        <div class="panel-body">
          <p class="small muted intro">
            <template v-if="esAdmin">
              Se quedaron abiertos con el botón de empezar y parar, que ya no
              existe. No cuentan para los totales. Bórralos y vuelve a apuntar
              esas horas con el parte de arriba.
            </template>
            <template v-else>
              Se quedaron abiertos con el botón de empezar y parar, que ya no
              existe. No cuentan para los totales y no hace falta que hagas
              nada: pídele a un administrador que los borre.
            </template>
          </p>
          <div class="stack-sm">
            <article v-for="entry in abiertas" :key="entry.id" class="panel registro">
              <span class="registro-horas mono">
                {{ formatDate(entry.started_at) }} · {{ formatTime(entry.started_at) }}
              </span>
              <span class="registro-trabajo">
                {{ etiquetaProducto(entry.product_id) }}
              </span>
              <button
                v-if="esAdmin"
                type="button"
                class="btn btn-ghost btn-sm borrar"
                :aria-label="`Borrar el registro sin cerrar del ${formatDate(entry.started_at)}`"
                @click="borrarRegistro(entry.id)"
              >
                <AppIcon name="borrar" :size="15" />
              </button>
            </article>
          </div>
        </div>
      </section>

      <!-- ---------- Totales ---------- -->
      <section v-if="cerradas.length > 0" class="totales">
        <div class="panel total">
          <span class="cifra-eti">Hoy</span>
          <span class="total-num mono">{{ formatDuration(totalHoy) }}</span>
          <span v-if="previstoHoy > 0" class="small dim">
            de {{ formatDuration(previstoHoy) }} previstas
          </span>
        </div>
        <div class="panel total">
          <span class="cifra-eti">Últimos 7 días</span>
          <span class="total-num mono">{{ formatDuration(totalSemana) }}</span>
        </div>
        <div class="panel total">
          <span class="cifra-eti">Registros</span>
          <span class="total-num mono">{{ cerradas.length }}</span>
        </div>
      </section>

      <!-- ---------- Historial ---------- -->
      <EmptyState
        v-if="cerradas.length === 0"
        icon="reloj"
        title="Todavía no has apuntado ninguna hora"
        text="Rellena el parte de arriba y las verás aquí, agrupadas por día."
      />

      <div v-else class="stack-lg historial">
        <p v-if="!esAdmin" class="small muted historial-nota">
          Lo que apuntes aquí queda registrado. Si te equivocas en una hora,
          díselo a un administrador: son los únicos que pueden borrar un
          registro.
        </p>
        <section v-for="grupo in porDia" :key="grupo.etiqueta" class="dia">
          <header class="dia-cab">
            <h3 class="dia-titulo">{{ grupo.etiqueta }}</h3>
            <span class="dia-total mono">{{ formatDuration(grupo.total) }}</span>
          </header>
          <div class="stack-sm">
            <article v-for="entry in grupo.items" :key="entry.id" class="panel registro">
              <span class="registro-horas mono">
                {{ formatTime(entry.started_at) }}
                <span class="dim">→</span>
                {{ formatTime(entry.ended_at as string) }}
              </span>
              <span class="registro-trabajo">
                {{ etiquetaProducto(entry.product_id) }}
                <span v-if="entry.notes" class="dim"> · {{ entry.notes }}</span>
              </span>
              <span class="pill pill-plain registro-dur mono">
                {{ formatDuration(entryDuration(entry.started_at, entry.ended_at as string)) }}
              </span>
              <button
                v-if="esAdmin"
                type="button"
                class="btn btn-ghost btn-sm borrar"
                :aria-label="`Borrar el registro de las ${formatTime(entry.started_at)}`"
                @click="borrarRegistro(entry.id)"
              >
                <AppIcon name="borrar" :size="15" />
              </button>
            </article>
          </div>
        </section>
      </div>
    </template>
  </template>
</template>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

.horario {
  font-weight: 600;
}

/* ---------------- El parte ---------------- */
.parte {
  margin-bottom: 1.125rem;
}

.campos {
  grid-template-columns: 1fr;
}

@media (min-width: 620px) {
  .campos {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 960px) {
  .campos {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Lo que ocupa toda la fila, sea cual sea el número de columnas */
.span-todo {
  grid-column: 1 / -1;
}

.aviso {
  color: var(--warn-fg);
}

.aviso-horario {
  color: var(--warn-fg);
  background: var(--warn-bg);
  border-color: var(--warn-line);
}

.duracion {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.duracion strong {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* ---------------- Registros sin cerrar ---------------- */
.sin-cerrar {
  margin-bottom: 1.125rem;
  border-color: var(--warn-line);
}

.intro {
  margin-bottom: 1rem;
  line-height: 1.55;
}

/* ---------------- Totales ---------------- */
.totales {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 520px) {
  .totales {
    grid-template-columns: 1fr;
  }
}

.total {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.875rem 1rem;
  min-width: 0;
}

.cifra-eti {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-dim);
}

.total-num {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--text);
}

/* ---------------- Historial ---------------- */
.dia-cab {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  margin-bottom: 0.625rem;
  border-bottom: 1px solid var(--border);
}

.dia-titulo {
  font-size: 0.9375rem;
  font-weight: 600;
}

.dia-total {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.registro {
  display: flex;
  align-items: center;
  gap: 0.5rem 0.875rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
}

.registro-horas {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  flex: none;
}

.registro-trabajo {
  font-size: 0.875rem;
  color: var(--text-muted);
  flex: 1 1 180px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registro-dur {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-left: auto;
  flex: none;
}

.historial-nota {
  margin: 0 0 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--surface-inset);
  line-height: 1.45;
}

.borrar {
  flex: none;
  padding: 0;
  width: 32px;
  min-height: 32px;
  justify-content: center;
  color: var(--text-dim);
}

.borrar:hover {
  color: var(--danger-fg);
}
</style>
