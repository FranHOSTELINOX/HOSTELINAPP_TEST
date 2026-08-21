<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import type { Database } from '../lib/database.types'
import {
  daysFromToday,
  entryDuration,
  formatClock,
  formatDate,
  formatDuration,
  formatTime,
} from '../lib/format'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingList from '../components/LoadingList.vue'
import PageHeader from '../components/PageHeader.vue'

type TimeEntry = Database['public']['Tables']['time_entries']['Row']

const entries = ref<TimeEntry[]>([])
const loading = ref(true)
const error = ref('')
const notes = ref('')
const trabajando = ref(false)

// Reloj que avanza solo mientras hay un registro abierto.
const ahora = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined

const openEntry = computed(() => entries.value.find((entry) => !entry.ended_at) ?? null)

const cerradas = computed(() => entries.value.filter((e) => e.ended_at))

const transcurrido = computed(() =>
  openEntry.value ? ahora.value - new Date(openEntry.value.started_at).getTime() : 0,
)

/** Total de hoy, sumando lo ya cerrado más lo que lleve el registro abierto. */
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

/** Total de los últimos siete días. */
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

async function loadEntries() {
  loading.value = true
  const { data, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .order('started_at', { ascending: false })

  if (fetchError) {
    error.value = fetchError.message
  } else {
    entries.value = data ?? []
  }
  loading.value = false
}

async function startEntry() {
  if (!session.value) return
  trabajando.value = true
  error.value = ''
  const { error: insertError } = await supabase.from('time_entries').insert({
    user_id: session.value.user.id,
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

onMounted(() => {
  loadEntries()
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
    subtitle="Dale a empezar cuando te pongas y a parar cuando termines."
  />

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>

  <!-- ---------- El fichaje ---------- -->
  <section class="panel fichaje" :class="{ enMarcha: openEntry }">
    <template v-if="openEntry">
      <div class="fichaje-info">
        <span class="pill pill-accent pill-live">En marcha</span>
        <p class="reloj mono">{{ formatClock(transcurrido) }}</p>
        <p class="small muted">
          Empezaste a las {{ formatTime(openEntry.started_at) }}
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
        <p class="fichaje-titulo">¿Empezamos?</p>
        <p class="small muted">
          Si quieres, apunta en qué vas a trabajar antes de arrancar.
        </p>
      </div>
      <form class="fichaje-form" @submit.prevent="startEntry">
        <input
          v-model="notes"
          class="input"
          placeholder="Nota (opcional): en qué trabajas"
          aria-label="Nota del registro"
        />
        <button type="submit" class="btn btn-primary btn-lg" :disabled="trabajando">
          <AppIcon name="play" :size="16" />
          {{ trabajando ? 'Empezando…' : 'Empezar' }}
        </button>
      </form>
    </template>
  </section>

  <!-- ---------- Totales ---------- -->
  <section v-if="!loading && entries.length > 0" class="totales">
    <div class="panel total">
      <span class="cifra-eti">Hoy</span>
      <span class="total-num mono">{{ formatDuration(totalHoy) }}</span>
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
  <LoadingList v-if="loading" :rows="3" />

  <EmptyState
    v-else-if="cerradas.length === 0"
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
          <span v-if="entry.notes" class="registro-nota muted">{{ entry.notes }}</span>
          <span class="spacer"></span>
          <span class="pill pill-plain registro-dur mono">
            {{ formatDuration(entryDuration(entry.started_at, entry.ended_at as string)) }}
          </span>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mb {
  margin-bottom: 1rem;
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

.fichaje-titulo {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.fichaje-form {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: min(100%, 320px);
  max-width: 460px;
}

.fichaje-form .input {
  flex: 1;
}

@media (max-width: 560px) {
  .fichaje-form {
    flex-direction: column;
  }
  .fichaje-form .btn {
    width: 100%;
  }
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
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
}

.registro-horas {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.registro-nota {
  font-size: 0.875rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registro-dur {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}
</style>
