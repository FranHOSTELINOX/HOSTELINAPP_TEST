<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Database, TaskStatus } from '../lib/database.types'
import { dueState, formatDayLabel } from '../lib/format'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingList from '../components/LoadingList.vue'
import PageHeader from '../components/PageHeader.vue'

type Task = Database['public']['Tables']['tasks']['Row']

const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref<string | null>(null)
const filtro = ref<TaskStatus | 'todas'>('todas')

const estados: { valor: TaskStatus; etiqueta: string }[] = [
  { valor: 'pending', etiqueta: 'Pendiente' },
  { valor: 'in_progress', etiqueta: 'En curso' },
  { valor: 'done', etiqueta: 'Hecha' },
]

const cuentas = computed(() => ({
  todas: tasks.value.length,
  pending: tasks.value.filter((t) => t.status === 'pending').length,
  in_progress: tasks.value.filter((t) => t.status === 'in_progress').length,
  done: tasks.value.filter((t) => t.status === 'done').length,
}))

const visibles = computed(() =>
  filtro.value === 'todas'
    ? tasks.value
    : tasks.value.filter((t) => t.status === filtro.value),
)

const progreso = computed(() =>
  tasks.value.length === 0
    ? 0
    : Math.round((cuentas.value.done / tasks.value.length) * 100),
)

async function loadTasks() {
  loading.value = true
  const { data, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (fetchError) {
    error.value = fetchError.message
  } else {
    tasks.value = data ?? []
  }
  loading.value = false
}

async function updateStatus(task: Task, status: TaskStatus) {
  if (task.status === status) return
  const anterior = task.status
  // Cambio optimista: se pinta ya y se revierte si Supabase lo rechaza.
  task.status = status
  saving.value = task.id
  error.value = ''

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', task.id)

  saving.value = null
  if (updateError) {
    task.status = anterior
    error.value = updateError.message
  }
}

function etiquetaFecha(fecha: string) {
  return formatDayLabel(fecha)
}

function claseFecha(task: Task) {
  // Una tarea ya hecha no se pinta como atrasada aunque su fecha haya pasado.
  if (task.status === 'done' || !task.due_date) return 'pill pill-plain'
  const estado = dueState(task.due_date)
  if (estado === 'vencida') return 'pill pill-danger'
  if (estado === 'hoy') return 'pill pill-accent'
  if (estado === 'pronto') return 'pill pill-warn'
  return 'pill pill-plain'
}

onMounted(loadTasks)
</script>

<template>
  <PageHeader
    eyebrow="Mi trabajo"
    title="Tareas"
    subtitle="Lo que tienes asignado. Marca cada tarea según vayas avanzando."
  >
    <template #acciones>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadTasks">
        Actualizar
      </button>
    </template>
  </PageHeader>

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>

  <LoadingList v-if="loading" :rows="4" />

  <template v-else-if="tasks.length === 0">
    <EmptyState
      icon="tareas"
      title="No tienes tareas por ahora"
      text="Cuando el administrador te asigne una tarea, aparecerá aquí."
    />
  </template>

  <template v-else>
    <!-- Resumen: cuántas hay de cada y cuánto llevas hecho -->
    <section class="panel resumen">
      <div class="resumen-cifras">
        <div class="cifra">
          <span class="cifra-num mono">{{ cuentas.pending }}</span>
          <span class="cifra-eti">Pendientes</span>
        </div>
        <div class="cifra">
          <span class="cifra-num mono cifra-curso">{{ cuentas.in_progress }}</span>
          <span class="cifra-eti">En curso</span>
        </div>
        <div class="cifra">
          <span class="cifra-num mono cifra-hecha">{{ cuentas.done }}</span>
          <span class="cifra-eti">Hechas</span>
        </div>
      </div>
      <div class="resumen-barra">
        <div class="barra-cab">
          <span class="small muted">Progreso</span>
          <span class="small mono">{{ progreso }}%</span>
        </div>
        <div
          class="barra"
          role="progressbar"
          :aria-valuenow="progreso"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="barra-relleno" :style="{ width: progreso + '%' }"></span>
        </div>
      </div>
    </section>

    <!-- Filtros -->
    <div class="filtros" role="tablist" aria-label="Filtrar tareas">
      <button
        type="button"
        role="tab"
        class="filtro"
        :class="{ activo: filtro === 'todas' }"
        :aria-selected="filtro === 'todas'"
        @click="filtro = 'todas'"
      >
        Todas <span class="filtro-num">{{ cuentas.todas }}</span>
      </button>
      <button
        v-for="e in estados"
        :key="e.valor"
        type="button"
        role="tab"
        class="filtro"
        :class="{ activo: filtro === e.valor }"
        :aria-selected="filtro === e.valor"
        @click="filtro = e.valor"
      >
        {{ e.etiqueta }} <span class="filtro-num">{{ cuentas[e.valor] }}</span>
      </button>
    </div>

    <p v-if="visibles.length === 0" class="panel panel-pad muted small sin-filtro">
      No hay tareas en este filtro.
    </p>

    <!-- Lista -->
    <div v-else class="stack">
      <article
        v-for="task in visibles"
        :key="task.id"
        class="panel tarea"
        :class="[`estado-${task.status}`, { guardando: saving === task.id }]"
      >
        <div class="tarea-cuerpo">
          <div class="tarea-cab">
            <h3 class="tarea-titulo">{{ task.title }}</h3>
            <span v-if="task.due_date" :class="claseFecha(task)">
              <AppIcon name="calendario" :size="12" />
              {{ etiquetaFecha(task.due_date) }}
            </span>
          </div>
          <p v-if="task.description" class="tarea-desc muted">{{ task.description }}</p>
        </div>

        <!-- Selector de estado: tres botones en vez de un desplegable -->
        <div class="segmentos" role="group" aria-label="Estado de la tarea">
          <button
            v-for="e in estados"
            :key="e.valor"
            type="button"
            class="segmento"
            :class="{ activo: task.status === e.valor }"
            :aria-pressed="task.status === e.valor"
            @click="updateStatus(task, e.valor)"
          >
            <AppIcon v-if="task.status === e.valor" name="check" :size="13" />
            {{ e.etiqueta }}
          </button>
        </div>
      </article>
    </div>
  </template>
</template>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

.sin-filtro {
  text-align: center;
}

/* ---------------- Resumen ---------------- */
.resumen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem;
  padding: 1.125rem 1.25rem;
  margin-bottom: 1.125rem;
}

.resumen-cifras {
  display: flex;
  gap: 1.75rem;
}

.cifra {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cifra-num {
  font-family: var(--font-display);
  font-size: 1.625rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--text);
}

.cifra-curso {
  color: var(--accent-text);
}

.cifra-hecha {
  color: var(--ok-fg);
}

.cifra-eti {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-dim);
}

.resumen-barra {
  flex: 1;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.barra-cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.barra {
  height: 7px;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  overflow: hidden;
}

.barra-relleno {
  display: block;
  height: 100%;
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--ember-500), var(--ember-300));
  transition: width var(--slow);
}

/* ---------------- Filtros ---------------- */
.filtros {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  margin-bottom: 0.875rem;
  scrollbar-width: none;
}

.filtros::-webkit-scrollbar {
  display: none;
}

.filtro {
  display: inline-flex;
  align-items: center;
  gap: 0.4375rem;
  min-height: 34px;
  padding: 0.4375rem 0.8125rem;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--fast), border-color var(--fast),
    background-color var(--fast);
}

.filtro:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.filtro.activo {
  color: var(--accent-fg);
  background: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 76%, #000);
}

.filtro-num {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

/* ---------------- Tarjeta de tarea ---------------- */
.tarea {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.875rem 1.25rem;
  padding: 1.0625rem 1.25rem 1.0625rem 1.375rem;
  overflow: hidden;
  transition: box-shadow var(--fast), border-color var(--fast), opacity var(--fast);
}

.tarea:hover {
  box-shadow: var(--shadow-md);
}

/* Franja de color a la izquierda según el estado */
.tarea::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--border-strong);
}

.estado-in_progress::after {
  background: linear-gradient(180deg, var(--ember-400), var(--ember-600));
}

.estado-done::after {
  background: var(--ok-fg);
}

.estado-done .tarea-titulo {
  color: var(--text-muted);
  text-decoration: line-through;
  text-decoration-color: var(--text-dim);
  text-decoration-thickness: 1px;
}

.guardando {
  opacity: 0.6;
}

.tarea-cuerpo {
  flex: 1;
  min-width: min(100%, 240px);
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
}

.tarea-cab {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.tarea-titulo {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.tarea-desc {
  font-size: 0.875rem;
  line-height: 1.5;
  max-width: 66ch;
}

/* ---------------- Selector de estado ---------------- */
.segmentos {
  display: inline-flex;
  flex: none;
  padding: 3px;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.segmento {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3125rem;
  min-height: 36px;
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
    border-color var(--fast), box-shadow var(--fast);
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

.estado-in_progress .segmento.activo {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-color: var(--accent-soft-border);
}

.estado-done .segmento.activo {
  color: var(--ok-fg);
  background: var(--ok-bg);
  border-color: var(--ok-line);
}

@media (max-width: 520px) {
  .segmentos {
    width: 100%;
  }
  .segmento {
    flex: 1;
    min-height: 40px;
    padding: 0.4375rem 0.375rem;
  }
}
</style>
