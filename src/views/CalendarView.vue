<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { daysFromToday, formatMonth, formatTime, monthKey } from '../lib/format'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingList from '../components/LoadingList.vue'
import PageHeader from '../components/PageHeader.vue'

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']

const events = ref<CalendarEvent[]>([])
const loading = ref(true)
const error = ref('')
const verPasados = ref(false)

const proximos = computed(() =>
  events.value.filter((e) => daysFromToday(e.start_at) >= 0),
)
const pasados = computed(() =>
  events.value.filter((e) => daysFromToday(e.start_at) < 0).reverse(),
)

const lista = computed(() => (verPasados.value ? pasados.value : proximos.value))

/** Los eventos visibles, agrupados por mes. */
const porMes = computed(() => {
  const grupos = new Map<string, { etiqueta: string; items: CalendarEvent[] }>()
  for (const evento of lista.value) {
    const clave = monthKey(evento.start_at)
    const grupo = grupos.get(clave) ?? { etiqueta: formatMonth(evento.start_at), items: [] }
    grupo.items.push(evento)
    grupos.set(clave, grupo)
  }
  return [...grupos.values()]
})

function diaCorto(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short' })
}

function numeroDia(iso: string) {
  return new Date(iso).getDate()
}

/** "Hoy" y "Mañana" se marcan en color; el resto va en gris. */
function cercania(iso: string): 'hoy' | 'manana' | null {
  const dias = daysFromToday(iso)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'manana'
  return null
}

onMounted(async () => {
  const { data, error: fetchError } = await supabase
    .from('calendar_events')
    .select('*')
    .order('start_at', { ascending: true })

  if (fetchError) {
    error.value = fetchError.message
  } else {
    events.value = data ?? []
  }
  loading.value = false
})
</script>

<template>
  <PageHeader
    eyebrow="Equipo"
    title="Calendario"
    subtitle="Lo que viene: turnos, montajes, reuniones y todo lo que publique el administrador."
  >
    <template #acciones>
      <div class="cambio" role="group" aria-label="Qué eventos ver">
        <button
          type="button"
          class="cambio-btn"
          :class="{ activo: !verPasados }"
          :aria-pressed="!verPasados"
          @click="verPasados = false"
        >
          Próximos <span class="cambio-num">{{ proximos.length }}</span>
        </button>
        <button
          type="button"
          class="cambio-btn"
          :class="{ activo: verPasados }"
          :aria-pressed="verPasados"
          @click="verPasados = true"
        >
          Pasados <span class="cambio-num">{{ pasados.length }}</span>
        </button>
      </div>
    </template>
  </PageHeader>

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>

  <LoadingList v-if="loading" :rows="3" />

  <EmptyState
    v-else-if="lista.length === 0"
    icon="calendario"
    :title="verPasados ? 'No hay eventos pasados' : 'No hay eventos programados'"
    :text="
      verPasados
        ? 'Aquí se quedan guardados los eventos que ya han pasado.'
        : 'Cuando el administrador publique algo en el calendario, aparecerá aquí.'
    "
  />

  <div v-else class="stack-lg">
    <section v-for="mes in porMes" :key="mes.etiqueta">
      <h3 class="mes">{{ mes.etiqueta }}</h3>
      <div class="stack-sm">
        <article
          v-for="event in mes.items"
          :key="event.id"
          class="panel evento"
          :class="cercania(event.start_at) ? 'destacado' : ''"
        >
          <!-- Taco de calendario -->
          <div class="taco" :class="cercania(event.start_at) ?? ''">
            <span class="taco-dia">{{ diaCorto(event.start_at) }}</span>
            <span class="taco-num mono">{{ numeroDia(event.start_at) }}</span>
          </div>

          <div class="evento-cuerpo">
            <div class="evento-cab">
              <h4 class="evento-titulo">{{ event.title }}</h4>
              <span v-if="cercania(event.start_at) === 'hoy'" class="pill pill-accent">
                Hoy
              </span>
              <span v-else-if="cercania(event.start_at) === 'manana'" class="pill pill-warn">
                Mañana
              </span>
            </div>
            <p class="evento-hora small muted">
              <AppIcon name="reloj" :size="13" />
              {{ formatTime(event.start_at) }}
              <template v-if="event.end_at"> – {{ formatTime(event.end_at) }}</template>
            </p>
            <p v-if="event.description" class="evento-desc muted">
              {{ event.description }}
            </p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

/* ---------------- Interruptor próximos / pasados ---------------- */
.cambio {
  display: inline-flex;
  padding: 3px;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.cambio-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.6875rem;
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

.cambio-btn:hover:not(.activo) {
  color: var(--text);
}

.cambio-btn.activo {
  color: var(--text);
  background: var(--surface);
  border-color: var(--border);
  box-shadow: var(--shadow-xs);
}

.cambio-num {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}

/* ---------------- Meses ---------------- */
.mes {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding-bottom: 0.5rem;
  margin-bottom: 0.625rem;
  border-bottom: 1px solid var(--border);
}

/* ---------------- Evento ---------------- */
.evento {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.9375rem 1.125rem;
  transition: box-shadow var(--fast), border-color var(--fast);
}

.evento:hover {
  box-shadow: var(--shadow-md);
}

.evento.destacado {
  border-color: var(--accent-soft-border);
}

/* El taco de calendario: día de la semana arriba, número grande abajo */
.taco {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 52px;
  padding: 0.4375rem 0;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.taco.hoy {
  color: var(--accent-fg);
  background: linear-gradient(180deg, var(--ember-500), var(--ember-600));
  border-color: var(--ember-700);
}

.taco.manana {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-color: var(--accent-soft-border);
}

.taco-dia {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.75;
}

.taco-num {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.evento-cuerpo {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding-top: 1px;
}

.evento-cab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.evento-titulo {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
}

.evento-hora {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.evento-desc {
  font-size: 0.875rem;
  line-height: 1.5;
  max-width: 66ch;
  margin-top: 0.125rem;
}
</style>
