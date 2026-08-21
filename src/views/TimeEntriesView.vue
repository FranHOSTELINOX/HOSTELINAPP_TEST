<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { role, session } from '../stores/auth'
import type { Database } from '../lib/database.types'
import {
  daysFromToday,
  entryDuration,
  formatClock,
  formatDate,
  formatDuration,
  formatTime,
} from '../lib/format'
import { avisoDeHorario, describeHorario, minutosPrevistos } from '../lib/horario'
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
const trabajando = ref(false)

// Selección de proyecto y producto, compartida por el fichaje y el parte manual.
const proyectoId = ref('')
const productoId = ref('')
const notes = ref('')

// Parte de horas a mano.
const manualAbierto = ref(false)
const manual = ref({ fecha: '', desde: '', hasta: '', notes: '' })

// Reloj que avanza solo mientras hay un registro abierto.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined

/** Solo el administrador puede imputar horas sin decir a qué producto. */
const requiereProducto = computed(() => role.value !== 'admin')

const proyectosActivos = computed(() => projects.value.filter((p) => p.active))

/** Los productos del proyecto elegido (los retirados no se ofrecen). */
const productosDelProyecto = computed(() =>
  products.value.filter((p) => p.project_id === proyectoId.value && p.active),
)

// Si cambia el proyecto, el producto elegido deja de tener sentido.
watch(proyectoId, () => {
  productoId.value = ''
})

const openEntry = computed(() => entries.value.find((entry) => !entry.ended_at) ?? null)
const cerradas = computed(() => entries.value.filter((e) => e.ended_at))

const transcurrido = computed(() =>
  openEntry.value ? ahora.value - new Date(openEntry.value.started_at).getTime() : 0,
)

const horarioDeHoy = computed(() => describeHorario(new Date()))
const previstoHoy = computed(() => minutosPrevistos(new Date()) * 60_000)

/** Nombre "Proyecto · Producto" de un registro, para las listas. */
function etiquetaProducto(productId: string | null): string {
  if (!productId) return 'Sin producto'
  const producto = products.value.find((p) => p.id === productId)
  if (!producto) return 'Producto borrado'
  const proyecto = projects.value.find((p) => p.id === producto.project_id)
  return proyecto ? `${proyecto.name} · ${producto.name}` : producto.name
}

const totalHoy = computed(() => {
  const cerrado = cerradas.value
    .filter((e) => daysFromToday(e.started_at) === 0)
    .reduce((suma, e) => suma + entryDuration(e.started_at, e.ended_at as string), 0)
  const abierto =
    openEntry.value && daysFromToday(openEntry.value.started_at) === 0
      ? transcurrido.value
      : 0
  return cerrado + abierto
})

const totalSemana = computed(() => {
  const cerrado = cerradas.value
    .filter((e) => daysFromToday(e.started_at) > -7)
    .reduce((suma, e) => suma + entryDuration(e.started_at, e.ended_at as string), 0)
  return cerrado + (openEntry.value ? transcurrido.value : 0)
})

/** Los registros cerrados, agrupados por día para que la lista se lea mejor. */
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

/** Aviso en vivo mientras se rellena el parte manual. */
const avisoManual = computed(() => {
  const { fecha, desde, hasta } = manual.value
  if (!fecha || !desde || !hasta) return null
  return avisoDeHorario(new Date(`${fecha}T${desde}`), new Date(`${fecha}T${hasta}`))
})

async function cargarCatalogo() {
  const [pr, pd] = await Promise.all([
    supabase.from('projects').select('*').order('name'),
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

/** Comprueba que hay producto elegido cuando hace falta. */
function faltaProducto(): boolean {
  if (!requiereProducto.value) return false
  if (!productoId.value) {
    error.value = 'Elige el proyecto y el producto al que imputas las horas.'
    return true
  }
  return false
}

async function startEntry() {
  if (!session.value) return
  error.value = ''
  if (faltaProducto()) return

  trabajando.value = true
  const { error: insertError } = await supabase.from('time_entries').insert({
    user_id: session.value.user.id,
    product_id: productoId.value || null,
    notes: notes.value || null,
  })
  trabajando.value = false
  if (insertError) {
    error.value = insertError.message
    return
  }
  notes.value = ''
  await loadEntries()
}

async function stopEntry(entry: TimeEntry) {
  trabajando.value = true
  error.value = ''
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', entry.id)

  trabajando.value = false
  if (updateError) {
    error.value = updateError.message
    return
  }
  await loadEntries()
}

function abrirManual() {
  manualAbierto.value = true
  error.value = ''
  const hoy = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  manual.value = {
    fecha: `${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-${p(hoy.getDate())}`,
    desde: '',
    hasta: '',
    notes: '',
  }
}

async function guardarManual() {
  if (!session.value) return
  error.value = ''
  if (faltaProducto()) return

  const { fecha, desde, hasta } = manual.value
  const inicio = new Date(`${fecha}T${desde}`)
  const fin = new Date(`${fecha}T${hasta}`)
  if (fin <= inicio) {
    error.value = 'La hora de fin tiene que ser posterior a la de inicio.'
    return
  }

  trabajando.value = true
  const { error: insertError } = await supabase.from('time_entries').insert({
    user_id: session.value.user.id,
    product_id: productoId.value || null,
    started_at: inicio.toISOString(),
    ended_at: fin.toISOString(),
    notes: manual.value.notes || null,
  })
  trabajando.value = false
  if (insertError) {
    error.value = insertError.message
    return
  }
  manualAbierto.value = false
  await loadEntries()
}

onMounted(async () => {
  await Promise.all([cargarCatalogo(), loadEntries()])
  loading.value = false
  tick = setInterval(() => {
    ahora.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (tick) clearInterval(tick)
})
</script>

<template>
  <PageHeader
    eyebrow="Mi jornada"
    title="Registro de tiempos"
    subtitle="Elige a qué estás trabajando y dale a empezar. Al terminar, para el reloj."
  >
    <template #acciones>
      <span class="pill pill-plain horario">
        <AppIcon name="reloj" :size="13" />
        Hoy: {{ horarioDeHoy }}
      </span>
    </template>
  </PageHeader>

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>

  <LoadingList v-if="loading" :rows="3" />

  <template v-else>
    <!-- Sin catálogo no se puede imputar nada -->
    <EmptyState
      v-if="proyectosActivos.length === 0 && requiereProducto"
      icon="puesto"
      title="Todavía no hay proyectos"
      text="El administrador tiene que crear los proyectos y sus productos antes de que puedas imputar horas."
    />

    <template v-else>
      <!-- ---------- El fichaje ---------- -->
      <section class="panel fichaje" :class="{ enMarcha: openEntry }">
        <template v-if="openEntry">
          <div class="fichaje-info">
            <span class="pill pill-accent pill-live">En marcha</span>
            <p class="reloj mono">{{ formatClock(transcurrido) }}</p>
            <p class="trabajo">{{ etiquetaProducto(openEntry.product_id) }}</p>
            <p class="small muted">
              Desde las {{ formatTime(openEntry.started_at) }}
              <template v-if="openEntry.notes"> · {{ openEntry.notes }}</template>
            </p>
          </div>
          <button
            type="button"
            class="btn btn-lg btn-parar"
            :disabled="trabajando"
            @click="stopEntry(openEntry)"
          >
            <AppIcon name="stop" :size="17" />
            {{ trabajando ? 'Parando…' : 'Parar' }}
          </button>
        </template>

        <template v-else>
          <div class="fichaje-info">
            <span class="eyebrow">Sin registro abierto</span>
            <p class="fichaje-titulo">¿En qué te pones?</p>
          </div>

          <form class="fichaje-form" @submit.prevent="startEntry">
            <div class="eleccion">
              <div class="field">
                <label class="field-label" for="proyecto">Proyecto</label>
                <select id="proyecto" v-model="proyectoId" class="select">
                  <option value="">Elige un proyecto…</option>
                  <option v-for="p in proyectosActivos" :key="p.id" :value="p.id">
                    {{ p.name }}<template v-if="p.client"> — {{ p.client }}</template>
                  </option>
                </select>
              </div>

              <div class="field">
                <label class="field-label" for="producto">Producto</label>
                <select
                  id="producto"
                  v-model="productoId"
                  class="select"
                  :disabled="!proyectoId"
                >
                  <option value="">
                    {{ proyectoId ? 'Elige un producto…' : 'Elige antes el proyecto' }}
                  </option>
                  <option v-for="p in productosDelProyecto" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
                <p
                  v-if="proyectoId && productosDelProyecto.length === 0"
                  class="field-hint aviso"
                >
                  Este proyecto todavía no tiene productos.
                </p>
              </div>

              <div class="field">
                <label class="field-label" for="nota">Nota (opcional)</label>
                <input
                  id="nota"
                  v-model="notes"
                  class="input"
                  placeholder="Ej. soldadura del bastidor"
                />
              </div>
            </div>

            <div class="fichaje-acciones">
              <button type="submit" class="btn btn-primary btn-lg" :disabled="trabajando">
                <AppIcon name="play" :size="16" />
                {{ trabajando ? 'Empezando…' : 'Empezar' }}
              </button>
              <button type="button" class="btn btn-ghost" @click="abrirManual">
                Añadir horas a mano
              </button>
            </div>
          </form>
        </template>
      </section>

      <!-- ---------- Parte de horas a mano ---------- -->
      <section v-if="manualAbierto" class="panel manual">
        <header class="panel-head">
          <AppIcon name="nota" :size="17" />
          <h3>Añadir horas a mano</h3>
          <span class="spacer"></span>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            aria-label="Cerrar"
            @click="manualAbierto = false"
          >
            <AppIcon name="cerrar" :size="15" />
          </button>
        </header>
        <div class="panel-body">
          <p class="small muted intro">
            Para apuntar un rato que ya has trabajado. Se imputa al proyecto y
            producto elegidos arriba.
          </p>
          <form class="form-grid form-grid-2" @submit.prevent="guardarManual">
            <div class="field span-2">
              <label class="field-label" for="m-fecha">Día</label>
              <input id="m-fecha" v-model="manual.fecha" class="input" type="date" required />
            </div>

            <div class="field">
              <label class="field-label" for="m-desde">Desde</label>
              <input id="m-desde" v-model="manual.desde" class="input" type="time" required />
            </div>

            <div class="field">
              <label class="field-label" for="m-hasta">Hasta</label>
              <input id="m-hasta" v-model="manual.hasta" class="input" type="time" required />
            </div>

            <div class="field span-2">
              <label class="field-label" for="m-nota">Nota (opcional)</label>
              <input id="m-nota" v-model="manual.notes" class="input" />
            </div>

            <p v-if="avisoManual" class="alert span-2 aviso-horario">
              <AppIcon name="aviso" :size="16" />
              <span>{{ avisoManual }}</span>
            </p>

            <div class="form-actions span-2">
              <button type="submit" class="btn btn-primary" :disabled="trabajando">
                {{ trabajando ? 'Guardando…' : 'Guardar horas' }}
              </button>
              <button type="button" class="btn btn-ghost" @click="manualAbierto = false">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </section>

      <!-- ---------- Totales ---------- -->
      <section v-if="entries.length > 0" class="totales">
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
          <span class="total-num mono">{{ entries.length }}</span>
        </div>
      </section>

      <!-- ---------- Historial ---------- -->
      <EmptyState
        v-if="cerradas.length === 0"
        icon="reloj"
        title="Todavía no has cerrado ningún registro"
        text="En cuanto pares un registro, lo verás aquí con las horas que has echado."
      />

      <div v-else class="stack-lg historial">
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

/* ---------------- Fichaje ---------------- */
.fichaje {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.5rem;
  margin-bottom: 1.125rem;
}

/* Cuando hay un registro abierto, la pieza se pone "caliente" */
.fichaje.enMarcha {
  border-color: var(--accent-soft-border);
  background-image: linear-gradient(180deg, var(--sheen) 0, transparent 64px),
    radial-gradient(120% 130% at 0% 0%, var(--accent-soft) 0%, transparent 62%);
}

.fichaje-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4375rem;
  min-width: 0;
}

.reloj {
  font-family: var(--font-mono);
  font-size: clamp(2.25rem, 1.6rem + 2.6vw, 3rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.trabajo {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--accent-text);
}

.fichaje-titulo {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Sin reloj en marcha no hay cifra grande que enseñar, así que el rótulo va
   arriba y el formulario ocupa el ancho entero en vez de dejar medio panel
   vacío. Con el reloj corriendo sí interesa el reparto en dos columnas. */
.fichaje:not(.enMarcha) {
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
}

.fichaje-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  flex: 1;
  min-width: min(100%, 320px);
}

.eleccion {
  display: grid;
  gap: 0.875rem;
}

@media (min-width: 560px) {
  .eleccion {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 860px) {
  .eleccion {
    grid-template-columns: 1fr 1fr 1fr;
  }
}

.fichaje-acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.aviso {
  color: var(--warn-fg);
}

.btn-parar {
  color: #fff;
  background: linear-gradient(180deg, var(--steel-700), var(--steel-900));
  border-color: var(--steel-900);
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.btn-parar:hover:not(:disabled) {
  background: linear-gradient(180deg, var(--steel-600), var(--steel-800));
  border-color: var(--steel-950);
}

/* ---------------- Parte manual ---------------- */
.manual {
  margin-bottom: 1.125rem;
}

.intro {
  margin-bottom: 1.125rem;
  line-height: 1.55;
}

.aviso-horario {
  color: var(--warn-fg);
  background: var(--warn-bg);
  border-color: var(--warn-line);
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
</style>
