<script setup lang="ts">
// Las horas imputadas. La misma pantalla sirve para dos cosas según quién
// mire: el administrador ve las de todo el equipo y puede agruparlas por
// persona; cualquier otro ve solo las suyas.
//
// El filtro de verdad lo pone la base de datos (política
// time_entries_select_own_or_admin: cada uno ve lo suyo, el admin lo ve todo),
// así que aunque alguien trastee con la petición no va a sacar las horas de un
// compañero. Aquí se filtra igualmente por dos motivos: no pedir lo que no se
// va a usar, y que el "ver como usuario" del administrador enseñe lo mismo que
// vería el equipo, y no sus horas de admin.
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import { esAdmin } from '../stores/vista'
import type { Database } from '../lib/database.types'
import { etiquetaProyecto, formatDate, formatDuration, formatTime, initials } from '../lib/format'
import { nombreTipo } from '../lib/ausencias'
import { minutosPrevistosEnRango } from '../lib/horario'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingList from '../components/LoadingList.vue'
import PageHeader from '../components/PageHeader.vue'

type TimeEntry = Database['public']['Tables']['time_entries']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type Product = Database['public']['Tables']['products']['Row']

const entries = ref<TimeEntry[]>([])
const users = ref<Profile[]>([])
const projects = ref<Project[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const error = ref('')

type Rango = 'semana' | 'mes' | 'mesPasado' | 'todo' | 'personalizado'
type Agrupacion = 'persona' | 'proyecto' | 'producto'

const rango = ref<Rango>('semana')
const agruparPor = ref<Agrupacion>(esAdmin.value ? 'persona' : 'proyecto')
const desdeManual = ref('')
const hastaManual = ref('')
/** Grupo desplegado, para ver su desglose. */
const abierto = ref<string | null>(null)

const rangos: { id: Rango; etiqueta: string }[] = [
  { id: 'semana', etiqueta: 'Esta semana' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mesPasado', etiqueta: 'Mes pasado' },
  { id: 'todo', etiqueta: 'Todo el histórico' },
  { id: 'personalizado', etiqueta: 'Otras fechas' },
]

// Agrupar "por persona" solo tiene sentido cuando hay más de una: a quien ve
// solo sus horas se le ofrecen proyecto y producto.
const agrupaciones = computed<{ id: Agrupacion; etiqueta: string }[]>(() => [
  ...(esAdmin.value ? [{ id: 'persona' as const, etiqueta: 'Por persona' }] : []),
  { id: 'proyecto', etiqueta: 'Por cliente' },
  { id: 'producto', etiqueta: 'Por producto' },
])

/** El lunes de la semana de una fecha (aquí la semana empieza en lunes). */
function lunesDe(d: Date): Date {
  const r = new Date(d)
  const dia = r.getDay()
  r.setDate(r.getDate() - (dia === 0 ? 6 : dia - 1))
  return r
}

/**
 * Las dos fechas del periodo elegido, como Date a medianoche. En "Todo el
 * histórico" no hay fecha de inicio: `desde` es null y la consulta sale sin
 * tope por abajo, así que entra todo lo que haya desde el primer día que se
 * usó la app. Poner ahí una fecha fija sería peor: el día que alguien apunte
 * un rato más antiguo, se quedaría fuera sin que nadie se entere.
 *
 * Ojo: esto NO puede depender de los registros cargados. `cargar()` se dispara
 * cuando cambia el periodo, así que si el periodo mirase los datos, cargarlos
 * volvería a cambiarlo y no pararía nunca.
 */
const periodo = computed<{ desde: Date | null; hasta: Date }>(() => {
  const hoy = new Date()
  if (rango.value === 'semana') {
    return { desde: lunesDe(hoy), hasta: hoy }
  }
  if (rango.value === 'mes') {
    return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: hoy }
  }
  if (rango.value === 'mesPasado') {
    return {
      desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1),
      hasta: new Date(hoy.getFullYear(), hoy.getMonth(), 0),
    }
  }
  if (rango.value === 'todo') {
    return { desde: null, hasta: hoy }
  }
  // Personalizado: si falta alguna fecha, se cae al mes en curso.
  const d = desdeManual.value ? new Date(`${desdeManual.value}T00:00`) : null
  const h = hastaManual.value ? new Date(`${hastaManual.value}T00:00`) : null
  if (!d || !h) return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: hoy }
  return { desde: d, hasta: h }
})

/** El día del registro más antiguo de los que se han traído. */
const primerDia = computed<Date | null>(() => {
  let menor: number | null = null
  for (const e of entries.value) {
    const t = new Date(e.started_at).getTime()
    if (menor === null || t < menor) menor = t
  }
  return menor === null ? null : new Date(menor)
})

/**
 * El primer día del periodo del que se puede hablar. En "Todo el histórico"
 * no lo marca el filtro sino el registro más antiguo que hay.
 */
const inicioReal = computed(() => periodo.value.desde ?? primerDia.value)

const etiquetaPeriodo = computed(() => {
  const fin = formatDate(periodo.value.hasta.toISOString())
  const ini = inicioReal.value
  if (!ini) return 'todo el histórico'
  return `${formatDate(ini.toISOString())} – ${fin}`
})

/** Cómo se lee el periodo dentro de una frase, bajo el título. */
const periodoEnFrase = computed(() =>
  rango.value === 'todo'
    ? inicioReal.value
      ? `desde el principio (${etiquetaPeriodo.value})`
      : 'desde el principio'
    : `entre el ${etiquetaPeriodo.value}`,
)

/**
 * Lo que tocaba trabajar en el periodo, según el horario del taller. En "Todo
 * el histórico" se cuenta desde el primer registro: antes de eso no había ni
 * app ni horas que esperar.
 */
const previstoPorPersona = computed(() => {
  const ini = inicioReal.value
  if (!ini) return 0
  return minutosPrevistosEnRango(ini, periodo.value.hasta) * 60_000
})

function nombreUsuario(id: string) {
  const u = users.value.find((x) => x.id === id)
  return u?.full_name || u?.email || 'Alguien que ya no está'
}

function nombreProducto(id: string | null) {
  if (!id) return 'Sin producto'
  return products.value.find((p) => p.id === id)?.name ?? 'Producto borrado'
}

function nombreProyecto(productId: string | null) {
  if (!productId) return 'Sin proyecto'
  const prod = products.value.find((p) => p.id === productId)
  if (!prod) return 'Producto borrado'
  const proy = projects.value.find((p) => p.id === prod.project_id)
  return proy ? etiquetaProyecto(proy.client_name, proy.project_name) : 'Proyecto borrado'
}

function duracion(e: TimeEntry) {
  return new Date(e.ended_at as string).getTime() - new Date(e.started_at).getTime()
}

/** Con qué clave y con qué nombre se agrupa cada registro. */
function claveDe(e: TimeEntry): { id: string; nombre: string } {
  if (agruparPor.value === 'persona') {
    return { id: e.user_id, nombre: nombreUsuario(e.user_id) }
  }
  if (e.tipo !== 'trabajo') {
    return { id: e.tipo, nombre: nombreTipo(e.tipo) }
  }
  if (agruparPor.value === 'producto') {
    const prod = products.value.find((p) => p.id === e.product_id)
    return {
      id: e.product_id ?? 'sin',
      nombre: prod ? `${nombreProyecto(e.product_id)} · ${prod.name}` : nombreProducto(e.product_id),
    }
  }
  const prod = products.value.find((p) => p.id === e.product_id)
  return { id: prod?.project_id ?? 'sin', nombre: nombreProyecto(e.product_id) }
}

/** Cómo se desglosa por dentro cada grupo (la otra dimensión). */
function subclaveDe(e: TimeEntry): string {
  if (agruparPor.value === 'persona') {
    if (e.tipo !== 'trabajo') return nombreTipo(e.tipo)
    return e.product_id
      ? `${nombreProyecto(e.product_id)} · ${nombreProducto(e.product_id)}`
      : 'Sin producto'
  }
  // Agrupando por proyecto, dentro se ve el reparto por producto. Agrupando
  // ya por producto no queda nada por desglosar, así que solo quedan los
  // registros sueltos.
  if (!esAdmin.value) {
    if (e.tipo !== 'trabajo') return ''
    return agruparPor.value === 'proyecto' ? nombreProducto(e.product_id) : ''
  }
  return nombreUsuario(e.user_id)
}

interface Grupo {
  id: string
  nombre: string
  total: number
  registros: number
  detalle: { nombre: string; total: number }[]
  items: TimeEntry[]
}

const grupos = computed<Grupo[]>(() => {
  const mapa = new Map<string, Grupo>()
  for (const e of entries.value) {
    const { id, nombre } = claveDe(e)
    const g = mapa.get(id) ?? { id, nombre, total: 0, registros: 0, detalle: [], items: [] }
    g.total += duracion(e)
    g.registros += 1
    g.items.push(e)
    mapa.set(id, g)
  }

  for (const g of mapa.values()) {
    const sub = new Map<string, number>()
    for (const e of g.items) {
      const k = subclaveDe(e)
      sub.set(k, (sub.get(k) ?? 0) + duracion(e))
    }
    g.detalle = [...sub.entries()]
      .filter(([nombre]) => nombre !== '')
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
    g.items.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total)
})

const totalGeneral = computed(() => grupos.value.reduce((s, g) => s + g.total, 0))
const mayor = computed(() => Math.max(1, ...grupos.value.map((g) => g.total)))

/**
 * Supabase no devuelve más de mil filas por petición. Con "Esta semana" eso no
 * se roza ni de lejos, pero "Todo el histórico" acabará pasándose, y entonces
 * el total saldría corto sin avisar de nada. Así que se pide por páginas hasta
 * que llegue una a medias, que es la última.
 */
const PAGINA = 1000

async function traerHoras(): Promise<{ data: TimeEntry[]; error: { message: string } | null }> {
  // El día de "hasta" cuenta entero: se pide hasta el principio del siguiente.
  const finExclusivo = new Date(periodo.value.hasta)
  finExclusivo.setHours(0, 0, 0, 0)
  finExclusivo.setDate(finExclusivo.getDate() + 1)

  const todas: TimeEntry[] = []
  for (let pagina = 0; ; pagina += 1) {
    // La consulta se arma de cero en cada vuelta: el constructor de Supabase
    // no se puede reutilizar una vez lanzado.
    let consulta = supabase
      .from('time_entries')
      .select('*')
      .not('ended_at', 'is', null)
      .lt('started_at', finExclusivo.toISOString())
      .order('started_at', { ascending: false })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)

    // En "Todo el histórico" no hay tope por abajo: entra todo lo que haya.
    if (periodo.value.desde) {
      const inicio = new Date(periodo.value.desde)
      inicio.setHours(0, 0, 0, 0)
      consulta = consulta.gte('started_at', inicio.toISOString())
    }
    if (!esAdmin.value) {
      consulta = consulta.eq('user_id', session.value?.user.id ?? '')
    }

    const { data, error: fallo } = await consulta
    if (fallo) return { data: [], error: fallo }
    todas.push(...(data ?? []))
    // Una página incompleta es la última. Y un tope por si acaso: sin él, un
    // error raro que devolviera siempre lo mismo dejaría la app dando vueltas.
    if ((data?.length ?? 0) < PAGINA || pagina >= 50) break
  }
  return { data: todas, error: null }
}

async function cargar() {
  loading.value = true
  error.value = ''

  const [te, pe, pr, pd] = await Promise.all([
    traerHoras(),
    // La lista de personas solo hace falta para poder poner nombres a las
    // horas de otros, cosa que solo hace el administrador.
    esAdmin.value ? supabase.from('profiles').select('*') : Promise.resolve({ data: [], error: null }),
    supabase.from('projects').select('*'),
    supabase.from('products').select('*'),
  ])

  const fallo = te.error || pe.error || pr.error || pd.error
  if (fallo) error.value = fallo.message
  else {
    entries.value = te.data ?? []
    users.value = pe.data ?? []
    projects.value = pr.data ?? []
    products.value = pd.data ?? []
  }
  loading.value = false
}

// Al cambiar de periodo hay que volver a pedir los datos; al cambiar de
// agrupación no, que se recalcula con lo que ya está cargado.
watch(periodo, cargar)
watch(agruparPor, () => {
  abierto.value = null
})

// Si el administrador entra o sale del "ver como usuario", cambia lo que hay
// que pedir (todas las horas o solo las suyas) y cómo se puede agrupar.
watch(esAdmin, (ahoraAdmin) => {
  if (!ahoraAdmin && agruparPor.value === 'persona') agruparPor.value = 'proyecto'
  abierto.value = null
  cargar()
})

onMounted(cargar)
</script>

<template>
  <PageHeader
    :eyebrow="esAdmin ? 'Panel del administrador' : 'Mi jornada'"
    :title="esAdmin ? 'Horas del equipo' : 'Mis horas'"
    :subtitle="
      esAdmin
        ? `Lo que ha imputado cada uno ${periodoEnFrase}.`
        : `Lo que has imputado tú ${periodoEnFrase}.`
    "
  />

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>

  <!-- ---------- Filtros ---------- -->
  <section class="panel filtros">
    <div class="filtro-grupo">
      <span class="eyebrow">Periodo</span>
      <div class="segmentos" role="group" aria-label="Periodo">
        <button
          v-for="r in rangos"
          :key="r.id"
          type="button"
          class="segmento"
          :class="{ activo: rango === r.id }"
          :aria-pressed="rango === r.id"
          @click="rango = r.id"
        >
          {{ r.etiqueta }}
        </button>
      </div>
    </div>

    <div v-if="rango === 'personalizado'" class="fechas">
      <div class="field">
        <label class="field-label" for="f-desde">Desde</label>
        <input id="f-desde" v-model="desdeManual" class="input" type="date" />
      </div>
      <div class="field">
        <label class="field-label" for="f-hasta">Hasta</label>
        <input id="f-hasta" v-model="hastaManual" class="input" type="date" />
      </div>
    </div>

    <div class="filtro-grupo">
      <span class="eyebrow">Agrupar</span>
      <div class="segmentos" role="group" aria-label="Agrupar por">
        <button
          v-for="a in agrupaciones"
          :key="a.id"
          type="button"
          class="segmento"
          :class="{ activo: agruparPor === a.id }"
          :aria-pressed="agruparPor === a.id"
          @click="agruparPor = a.id"
        >
          {{ a.etiqueta }}
        </button>
      </div>
    </div>
  </section>

  <LoadingList v-if="loading" :rows="4" />

  <EmptyState
    v-else-if="entries.length === 0"
    icon="barras"
    :title="
      rango === 'todo'
        ? esAdmin
          ? 'Todavía no hay ninguna hora imputada'
          : 'Todavía no has imputado ninguna hora'
        : esAdmin
          ? 'No hay horas imputadas en este periodo'
          : 'No has imputado horas en este periodo'
    "
    :text="
      rango === 'todo'
        ? 'Aquí saldrá todo lo apuntado desde el primer día, en cuanto haya algo.'
        : 'Prueba a cambiar las fechas de arriba.'
    "
  />

  <template v-else>
    <!-- ---------- Totales ---------- -->
    <section class="totales">
      <div class="panel total">
        <span class="cifra-eti">Total imputado</span>
        <span class="total-num mono">{{ formatDuration(totalGeneral) }}</span>
        <span class="small dim">
          {{ entries.length }} {{ entries.length === 1 ? 'registro' : 'registros' }}
          <template v-if="!esAdmin && previstoPorPersona > 0">
            · {{ Math.round((totalGeneral / previstoPorPersona) * 100) }}% de lo previsto
          </template>
        </span>
      </div>
      <div class="panel total">
        <span class="cifra-eti">
          {{ agruparPor === 'persona' ? 'Personas' : agruparPor === 'proyecto' ? 'Clientes' : 'Productos' }}
        </span>
        <span class="total-num mono">{{ grupos.length }}</span>
      </div>
      <div v-if="agruparPor === 'persona' || !esAdmin" class="panel total">
        <span class="cifra-eti">{{ esAdmin ? 'Previstas por persona' : 'Previstas' }}</span>
        <span class="total-num mono">{{ formatDuration(previstoPorPersona) }}</span>
        <span class="small dim">
          según el horario del taller<template v-if="rango === 'todo'">, desde el primer registro</template>
        </span>
      </div>
    </section>

    <!-- ---------- El reparto ---------- -->
    <div class="stack">
      <article v-for="g in grupos" :key="g.id" class="panel grupo">
        <button
          type="button"
          class="grupo-cab"
          :aria-expanded="abierto === g.id"
          @click="abierto = abierto === g.id ? null : g.id"
        >
          <span v-if="agruparPor === 'persona'" class="avatar-mini">
            {{ initials(g.nombre) }}
          </span>

          <span class="grupo-texto">
            <strong>{{ g.nombre }}</strong>
            <span class="small dim">
              {{ g.registros }} {{ g.registros === 1 ? 'registro' : 'registros' }}
              <template v-if="totalGeneral > 0">
                · {{ Math.round((g.total / totalGeneral) * 100) }}% del total
              </template>
            </span>
          </span>

          <span class="grupo-cifra mono">{{ formatDuration(g.total) }}</span>

          <span
            v-if="agruparPor === 'persona' && previstoPorPersona > 0"
            class="pill"
            :class="g.total >= previstoPorPersona ? 'pill-ok' : 'pill-plain'"
          >
            {{ Math.round((g.total / previstoPorPersona) * 100) }}% de lo previsto
          </span>

          <AppIcon
            class="grupo-flecha"
            :class="{ girada: abierto === g.id }"
            name="abajo"
            :size="16"
          />
        </button>

        <div class="barra" aria-hidden="true">
          <span class="barra-relleno" :style="{ width: `${(g.total / mayor) * 100}%` }"></span>
        </div>

        <!-- Desglose por la otra dimensión -->
        <div v-if="abierto === g.id" class="detalle">
          <p v-if="g.detalle.length > 0" class="eyebrow detalle-titulo">
            {{ agruparPor === 'persona' ? 'En qué' : esAdmin ? 'Quién' : 'En qué' }}
          </p>
          <ul v-if="g.detalle.length > 0" class="detalle-lista">
            <li v-for="d in g.detalle" :key="d.nombre">
              <span class="detalle-nombre">{{ d.nombre }}</span>
              <span class="detalle-cifra mono">{{ formatDuration(d.total) }}</span>
            </li>
          </ul>

          <p class="eyebrow detalle-titulo">Registros</p>
          <ul class="detalle-lista">
            <li v-for="e in g.items.slice(0, 12)" :key="e.id">
              <span class="detalle-nombre">
                <span class="mono">{{ formatDate(e.started_at) }}</span>
                <span class="dim">
                  {{ formatTime(e.started_at) }}–{{ formatTime(e.ended_at as string) }}
                </span>
                <template v-if="agruparPor !== 'persona' && esAdmin">
                  · {{ nombreUsuario(e.user_id) }}
                </template>
                <template v-else-if="e.notes"> · {{ e.notes }}</template>
              </span>
              <span class="detalle-cifra mono">{{ formatDuration(duracion(e)) }}</span>
            </li>
          </ul>
          <p v-if="g.items.length > 12" class="small dim detalle-mas">
            y {{ g.items.length - 12 }} registros más
          </p>
        </div>
      </article>
    </div>
  </template>
</template>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

/* ---------------- Filtros ---------------- */
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1.125rem;
  padding: 1.125rem 1.25rem;
  margin-bottom: 1.125rem;
}

.filtro-grupo {
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  min-width: 0;
}

.segmentos {
  display: inline-flex;
  flex-wrap: wrap;
  padding: 3px;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.segmento {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0.375rem 0.75rem;
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

.segmento:hover:not(.activo) {
  color: var(--text);
}

.segmento.activo {
  color: var(--text);
  background: var(--surface);
  border-color: var(--border);
  box-shadow: var(--shadow-xs);
}

.fechas {
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.fechas .field {
  min-width: 150px;
}

/* ---------------- Totales ---------------- */
.totales {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
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

/* ---------------- Cada grupo ---------------- */
.grupo {
  overflow: hidden;
}

.grupo-cab {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  width: 100%;
  padding: 0.875rem 1.125rem;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.grupo-cab:hover .grupo-texto strong {
  color: var(--accent-text);
}

.avatar-mini {
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

.grupo-texto {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
  flex: 1 1 200px;
}

.grupo-texto strong {
  font-size: 0.9375rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  transition: color var(--fast);
}

.grupo-cifra {
  font-family: var(--font-display);
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  white-space: nowrap;
  flex: none;
  margin-left: auto;
}

.grupo-flecha {
  flex: none;
  color: var(--text-dim);
  transition: transform var(--fast);
}

.grupo-flecha.girada {
  transform: rotate(180deg);
}

/* La barra proporcional, al pie de cada fila */
.barra {
  height: 4px;
  background: var(--surface-inset);
}

.barra-relleno {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--azul-400));
  transition: width var(--slow);
}

/* ---------------- Desglose ---------------- */
.detalle {
  padding: 1rem 1.125rem 1.125rem;
  background: var(--surface-inset);
  border-top: 1px solid var(--border-soft);
}

.detalle-titulo {
  margin-bottom: 0.5rem;
}

.detalle-titulo + .detalle-lista {
  margin-bottom: 1rem;
}

.detalle-lista {
  list-style: none;
  margin: 0;
  padding: 0;
}

.detalle-lista li {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.3125rem 0;
  border-bottom: 1px solid var(--border-soft);
  font-size: 0.8125rem;
}

.detalle-lista li:last-child {
  border-bottom: none;
}

.detalle-nombre {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  color: var(--text-muted);
  min-width: 0;
  flex: 1;
}

.detalle-cifra {
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  margin-left: auto;
}

.detalle-mas {
  padding-top: 0.5rem;
}
</style>
