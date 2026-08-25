<script setup lang="ts">
// Baja laboral y permiso retribuido. Es la MISMA pantalla para los dos: lo
// único que cambia son los textos y el icono, que vienen de lib/ausencias.ts.
//
// Una ausencia se guarda en time_entries igual que un rato de taller, con la
// etiqueta `tipo`. Así ocupa la jornada de verdad: el trigger de la base de
// datos impide estar de baja y trabajando a la vez, y las horas cuadran en
// los informes sin cruzar dos tablas.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import { esAdmin } from '../stores/vista'
import type { Database } from '../lib/database.types'
import { formatDate, formatDuration, formatTime } from '../lib/format'
import { describeHorario, franjasDelDia } from '../lib/horario'
import {
  HORAS_AUSENCIA_DIA,
  HORAS_AUSENCIA_SEMANA,
  ausenciaDe,
  jornadaDeAusencia,
  lunesDe,
} from '../lib/ausencias'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingList from '../components/LoadingList.vue'
import PageHeader from '../components/PageHeader.vue'

type TimeEntry = Database['public']['Tables']['time_entries']['Row']

const route = useRoute()
const ficha = computed(() => ausenciaDe(String(route.meta.tipoAusencia))!)

/** Las ausencias de los dos tipos: el tope diario y el semanal son conjuntos. */
const ausencias = ref<TimeEntry[]>([])
/** Las de esta pantalla, que son las que se listan. */
const entries = computed(() => ausencias.value.filter((e) => e.tipo === ficha.value.tipo))
const loading = ref(true)
const error = ref('')
const message = ref('')
const guardando = ref(false)
const borrando = ref<string | null>(null)

const hoy = new Date().toISOString().slice(0, 10)
const parte = ref({
  desdeDia: hoy,
  hastaDia: hoy,
  jornadaCompleta: true,
  desdeHora: '',
  hastaHora: '',
  notes: '',
})

// Al cambiar de pantalla (baja ↔ permiso) se empieza de cero.
watch(
  () => ficha.value.tipo,
  () => {
    parte.value = { desdeDia: hoy, hastaDia: hoy, jornadaCompleta: true, desdeHora: '', hastaHora: '', notes: '' }
    error.value = ''
    message.value = ''
    cargar()
  },
)

/** Por horas solo tiene sentido en un día suelto. */
watch(
  () => parte.value.jornadaCompleta,
  (completa) => {
    if (!completa) parte.value.hastaDia = parte.value.desdeDia
  },
)
watch(
  () => parte.value.desdeDia,
  (d) => {
    if (!parte.value.jornadaCompleta || parte.value.hastaDia < d) parte.value.hastaDia = d
    parte.value.desdeHora = ''
    parte.value.hastaHora = ''
  },
)

const diaElegido = computed(() => new Date(`${parte.value.desdeDia}T00:00`))
const franjas = computed(() => franjasDelDia(diaElegido.value))
const franjasHasta = computed(() =>
  franjas.value
    .map((f) => ({ ...f, horas: f.horas.filter((h) => h > parte.value.desdeHora) }))
    .filter((f) => f.horas.length > 0),
)
const esFestivo = computed(() => jornadaDeAusencia(diaElegido.value) === null)
const horarioDelDia = computed(() => describeHorario(diaElegido.value))

/**
 * Las jornadas del rango elegido: una por día, de 8 h, de lunes a viernes.
 * Una ausencia se mide con la jornada de convenio y no con el horario del
 * taller, así que el sábado no genera horas aunque en el taller se trabaje.
 */
const jornadasDelRango = computed(() => {
  const salida: { dia: Date; desde: Date; hasta: Date }[] = []
  const fin = new Date(`${parte.value.hastaDia}T00:00`)
  const cursor = new Date(`${parte.value.desdeDia}T00:00`)
  // Un tope por si alguien escribe un año a mano: evita quedarse dando
  // vueltas si las fechas vienen disparatadas.
  let vueltas = 0
  while (cursor <= fin && vueltas < 400) {
    const jornada = jornadaDeAusencia(cursor)
    if (jornada) salida.push({ dia: new Date(cursor), ...jornada })
    cursor.setDate(cursor.getDate() + 1)
    vueltas += 1
  }
  return salida
})

const diasLaborables = computed(() => jornadasDelRango.value.length)
const totalPrevisto = computed(() =>
  jornadasDelRango.value.reduce((s, j) => s + (j.hasta.getTime() - j.desde.getTime()), 0),
)

const cerradas = computed(() => entries.value.filter((e) => e.ended_at))
const totalApuntado = computed(() =>
  cerradas.value.reduce(
    (s, e) => s + (new Date(e.ended_at as string).getTime() - new Date(e.started_at).getTime()),
    0,
  ),
)

/** Los ratos del mismo día se juntan en una sola línea. */
interface Grupo {
  clave: string
  etiqueta: string
  total: number
  items: TimeEntry[]
}
const porDia = computed<Grupo[]>(() => {
  const mapa = new Map<string, Grupo>()
  for (const e of cerradas.value) {
    const d = new Date(e.started_at)
    const clave = d.toDateString()
    const g = mapa.get(clave) ?? { clave, etiqueta: formatDate(e.started_at), total: 0, items: [] }
    g.total += new Date(e.ended_at as string).getTime() - d.getTime()
    g.items.push(e)
    mapa.set(clave, g)
  }
  return [...mapa.values()].sort((a, b) => (a.clave < b.clave ? 1 : -1))
})

async function cargar() {
  loading.value = true
  const { data, error: e } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', session.value?.user.id ?? '')
    .neq('tipo', 'trabajo')
    .order('started_at', { ascending: false })
  if (e) error.value = e.message
  else ausencias.value = data ?? []
  loading.value = false
}

const duracionMs = (e: { started_at: string; ended_at: string | null }) =>
  new Date(e.ended_at as string).getTime() - new Date(e.started_at).getTime()

const HORA_MS = 60 * 60 * 1000

/**
 * ¿Lo que se va a apuntar deja algún día por encima de 8 h o alguna semana
 * por encima de 40, contando lo que ya hay? Devuelve el aviso o null.
 *
 * Cuenta las dos ausencias juntas: nadie puede estar ausente más de lo que
 * dura su jornada, dé igual que sea media mañana de baja y media de permiso.
 * La base de datos lo impide igualmente; esto es para decirlo antes y con
 * palabras, en vez de soltar el error de Postgres.
 */
function excedeTope(ratos: { started_at: string; ended_at: string }[]): string | null {
  const porDia = new Map<string, number>()
  const porSemana = new Map<string, number>()

  const anota = (inicio: Date, ms: number) => {
    const d = inicio.toDateString()
    const s = lunesDe(inicio).toDateString()
    porDia.set(d, (porDia.get(d) ?? 0) + ms)
    porSemana.set(s, (porSemana.get(s) ?? 0) + ms)
  }

  for (const e of ausencias.value) {
    if (e.ended_at) anota(new Date(e.started_at), duracionMs(e))
  }
  for (const r of ratos) {
    anota(new Date(r.started_at), duracionMs(r))
  }

  for (const [clave, ms] of porDia) {
    if (ms > HORAS_AUSENCIA_DIA * HORA_MS) {
      return `El ${formatDate(new Date(clave).toISOString())} te saldrían ${formatDuration(ms)} entre bajas y permisos, y un día no puede pasar de ${HORAS_AUSENCIA_DIA} h.`
    }
  }
  for (const [clave, ms] of porSemana) {
    if (ms > HORAS_AUSENCIA_SEMANA * HORA_MS) {
      return `La semana del ${formatDate(new Date(clave).toISOString())} te saldrían ${formatDuration(ms)} entre bajas y permisos, y una semana no puede pasar de ${HORAS_AUSENCIA_SEMANA} h.`
    }
  }
  return null
}

async function guardar() {
  if (!session.value) return
  error.value = ''
  message.value = ''

  let ratos: { started_at: string; ended_at: string }[] = []

  if (parte.value.jornadaCompleta) {
    if (parte.value.hastaDia < parte.value.desdeDia) {
      error.value = 'El último día no puede ser anterior al primero.'
      return
    }
    if (jornadasDelRango.value.length === 0) {
      error.value =
        'En esos días no hay nada que apuntar: las ausencias se cuentan de lunes a viernes.'
      return
    }
    ratos = jornadasDelRango.value.map((j) => ({
      started_at: j.desde.toISOString(),
      ended_at: j.hasta.toISOString(),
    }))
  } else {
    if (!parte.value.desdeHora || !parte.value.hastaHora) {
      error.value = 'Elige desde qué hora hasta qué hora.'
      return
    }
    const inicio = new Date(`${parte.value.desdeDia}T${parte.value.desdeHora}`)
    const fin = new Date(`${parte.value.desdeDia}T${parte.value.hastaHora}`)
    if (fin <= inicio) {
      error.value = 'La hora de fin tiene que ser posterior a la de inicio.'
      return
    }
    ratos = [{ started_at: inicio.toISOString(), ended_at: fin.toISOString() }]
  }

  const pasado = excedeTope(ratos)
  if (pasado) {
    error.value = pasado
    return
  }

  guardando.value = true
  const { error: e } = await supabase.from('time_entries').insert(
    ratos.map((r) => ({
      user_id: session.value!.user.id,
      tipo: ficha.value.tipo,
      product_id: null,
      notes: parte.value.notes || null,
      ...r,
    })),
  )
  guardando.value = false

  if (e) {
    // El trigger de solapes habla en cristiano; el resto de errores, no tanto.
    error.value = /solape|apuntadas|no puede tener más/i.test(e.message)
      ? e.message
      : `No se pudo apuntar: ${e.message}`
    return
  }

  const total = ratos.reduce(
    (s, r) => s + (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()),
    0,
  )
  message.value = parte.value.jornadaCompleta
    ? `Apuntados ${diasLaborables.value} ${diasLaborables.value === 1 ? 'día' : 'días'} (${formatDuration(total)}).`
    : `Apuntadas ${formatDuration(total)}.`
  parte.value.desdeHora = ''
  parte.value.hastaHora = ''
  parte.value.notes = ''
  await cargar()
}

async function borrar(id: string) {
  if (!esAdmin.value) return
  borrando.value = null
  error.value = ''
  const { error: e } = await supabase.from('time_entries').delete().eq('id', id)
  if (e) {
    error.value = e.message
    return
  }
  message.value = 'Registro borrado.'
  await cargar()
}

onMounted(cargar)
</script>

<template>
  <PageHeader :eyebrow="ficha.eyebrow" :title="ficha.titulo" :subtitle="ficha.subtitulo" />

  <LoadingList v-if="loading" :rows="3" />

  <template v-else>
    <section class="panel parte">
      <header class="panel-head">
        <AppIcon :name="ficha.icono" :size="17" />
        <h3>Apuntar {{ ficha.tipo === 'baja' ? 'baja' : 'permiso' }}</h3>
      </header>

      <div class="panel-body">
        <form class="stack" @submit.prevent="guardar">
          <!-- Días completos o solo unas horas: es lo primero que hay que
               decidir, porque cambia el resto del formulario. -->
          <div class="segmentos" role="group" aria-label="Cómo se apunta">
            <button
              type="button"
              class="segmento"
              :class="{ activo: parte.jornadaCompleta }"
              :aria-pressed="parte.jornadaCompleta"
              @click="parte.jornadaCompleta = true"
            >
              Días completos
            </button>
            <button
              type="button"
              class="segmento"
              :class="{ activo: !parte.jornadaCompleta }"
              :aria-pressed="!parte.jornadaCompleta"
              @click="parte.jornadaCompleta = false"
            >
              Solo unas horas
            </button>
          </div>

          <div class="campos">
            <div class="field">
              <label class="field-label" for="a-desde">
                {{ parte.jornadaCompleta ? 'Primer día' : 'Día' }}
              </label>
              <input id="a-desde" v-model="parte.desdeDia" class="input" type="date" required />
            </div>

            <div v-if="parte.jornadaCompleta" class="field">
              <label class="field-label" for="a-hasta">Último día</label>
              <input
                id="a-hasta"
                v-model="parte.hastaDia"
                class="input"
                type="date"
                :min="parte.desdeDia"
                required
              />
            </div>

            <template v-else>
              <div class="field">
                <label class="field-label" for="a-desde-hora">Desde</label>
                <select
                  id="a-desde-hora"
                  v-model="parte.desdeHora"
                  class="select"
                  :disabled="esFestivo"
                >
                  <option value="">
                    {{ esFestivo ? 'Sábados y domingos no cuentan' : 'Hora…' }}
                  </option>
                  <optgroup v-for="f in franjas" :key="f.etiqueta" :label="f.etiqueta">
                    <option v-for="h in f.horas" :key="h" :value="h">{{ h }}</option>
                  </optgroup>
                </select>
              </div>

              <div class="field">
                <label class="field-label" for="a-hasta-hora">Hasta</label>
                <select
                  id="a-hasta-hora"
                  v-model="parte.hastaHora"
                  class="select"
                  :disabled="!parte.desdeHora"
                >
                  <option value="">
                    {{ parte.desdeHora ? 'Hora…' : 'Elige antes la de inicio' }}
                  </option>
                  <optgroup v-for="f in franjasHasta" :key="f.etiqueta" :label="f.etiqueta">
                    <option v-for="h in f.horas" :key="h" :value="h">{{ h }}</option>
                  </optgroup>
                </select>
              </div>
            </template>

            <div class="field nota">
              <label class="field-label" for="a-nota">Nota (opcional)</label>
              <input
                id="a-nota"
                v-model="parte.notes"
                class="input"
                :placeholder="ficha.ejemploNota"
              />
            </div>
          </div>

          <p v-if="!parte.jornadaCompleta && !esFestivo" class="small dim horario">
            <AppIcon name="reloj" :size="13" />
            Ese día se trabaja de {{ horarioDelDia }}
          </p>
          <p v-if="parte.jornadaCompleta" class="small dim horario">
            <AppIcon name="reloj" :size="13" />
            Un día completo son {{ HORAS_AUSENCIA_DIA }} h, y la semana no pasa de
            {{ HORAS_AUSENCIA_SEMANA }} h
          </p>

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="guardando || (parte.jornadaCompleta && diasLaborables === 0)"
            >
              <AppIcon name="mas" :size="16" />
              {{ guardando ? 'Guardando…' : 'Apuntar' }}
            </button>
            <span v-if="parte.jornadaCompleta && diasLaborables > 0" class="resumen">
              Son <strong>{{ diasLaborables }}</strong>
              {{ diasLaborables === 1 ? 'día laborable' : 'días laborables' }}
              · <strong>{{ formatDuration(totalPrevisto) }}</strong>
            </span>
            <span v-else-if="parte.jornadaCompleta" class="resumen dim">
              Ahí no hay días que contar: las ausencias van de lunes a viernes
            </span>
          </div>
        </form>
      </div>
    </section>

    <AlertMessage v-if="error" kind="error" class="aviso-parte">{{ error }}</AlertMessage>
    <AlertMessage v-if="message" kind="success" class="aviso-parte">{{ message }}</AlertMessage>

    <section v-if="cerradas.length > 0" class="totales">
      <div class="panel total">
        <span class="cifra-eti">Total apuntado</span>
        <span class="total-num mono">{{ formatDuration(totalApuntado) }}</span>
        <span class="small dim">
          {{ porDia.length }} {{ porDia.length === 1 ? 'día' : 'días' }}
        </span>
      </div>
    </section>

    <EmptyState
      v-if="cerradas.length === 0"
      :icon="ficha.icono"
      :title="ficha.vacio"
      text="Rellena el parte de arriba y lo verás aquí."
    />

    <div v-else class="stack-sm">
      <article v-for="g in porDia" :key="g.clave" class="panel registro">
        <span class="registro-dia">{{ g.etiqueta }}</span>
        <span class="registro-horas mono">
          <template v-for="(e, i) in g.items" :key="e.id">
            <span v-if="i > 0" class="dim"> · </span>
            {{ formatTime(e.started_at) }}–{{ formatTime(e.ended_at as string) }}
          </template>
        </span>
        <span v-if="g.items[0].notes" class="registro-nota dim">{{ g.items[0].notes }}</span>
        <span class="pill pill-plain registro-dur mono">{{ formatDuration(g.total) }}</span>

        <span v-if="esAdmin && borrando === g.clave" class="confirmar">
          <span class="small">¿Seguro?</span>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            @click="g.items.forEach((e) => borrar(e.id))"
          >
            Sí, borrar
          </button>
          <button type="button" class="btn btn-ghost btn-sm" @click="borrando = null">No</button>
        </span>
        <button
          v-else-if="esAdmin"
          type="button"
          class="btn btn-ghost btn-sm borrar"
          :aria-label="`Borrar lo apuntado el ${g.etiqueta}`"
          @click="borrando = g.clave"
        >
          <AppIcon name="borrar" :size="15" />
        </button>
      </article>
    </div>
  </template>
</template>

<style scoped>
.parte {
  margin-bottom: 1.125rem;
}

.aviso-parte {
  margin-top: -0.375rem;
  margin-bottom: 1.125rem;
}

.segmentos {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  align-self: flex-start;
}

.segmento {
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  min-height: 34px;
  padding: 0 0.875rem;
  border: 0;
  border-radius: calc(var(--r-md) - 3px);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.segmento.activo {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-xs);
}

.campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.75rem 1rem;
}

.campos > * {
  min-width: 0;
}

.nota {
  grid-column: 1 / -1;
}

.horario {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0;
}

.resumen {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.totales {
  margin-bottom: 1.25rem;
}

.total {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.875rem 1rem;
}

.cifra-eti {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.total-num {
  font-size: 1.5rem;
  font-weight: 700;
}

.registro {
  display: flex;
  align-items: center;
  gap: 0.5rem 0.875rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
}

.registro-dia {
  font-size: 0.875rem;
  font-weight: 600;
  flex: none;
}

.registro-horas {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.registro-nota {
  font-size: 0.8125rem;
  flex: 1 1 8rem;
  min-width: 0;
}

.registro-dur {
  margin-left: auto;
}

.confirmar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: none;
  flex-wrap: wrap;
}

.confirmar .btn-sm {
  min-height: 34px;
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
