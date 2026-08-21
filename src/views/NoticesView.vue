<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { daysFromToday, formatDate, formatRelative } from '../lib/format'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingList from '../components/LoadingList.vue'
import PageHeader from '../components/PageHeader.vue'

type Notice = Database['public']['Tables']['notices']['Row']

const notices = ref<Notice[]>([])
const loading = ref(true)
const error = ref('')

/** Un aviso es "nuevo" si se publicó en los últimos tres días. */
function esNuevo(iso: string) {
  return daysFromToday(iso) > -3
}

const nuevos = computed(() => notices.value.filter((n) => esNuevo(n.created_at)).length)

onMounted(async () => {
  const { data, error: fetchError } = await supabase
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false })

  if (fetchError) {
    error.value = fetchError.message
  } else {
    notices.value = data ?? []
  }
  loading.value = false
})
</script>

<template>
  <PageHeader
    eyebrow="Tablón"
    title="Avisos"
    :subtitle="
      nuevos > 0
        ? `Tienes ${nuevos} ${nuevos === 1 ? 'aviso nuevo' : 'avisos nuevos'} de estos días.`
        : 'Lo que publica el administrador para todo el equipo.'
    "
  />

  <AlertMessage v-if="error" kind="error" class="mb">{{ error }}</AlertMessage>

  <LoadingList v-if="loading" :rows="3" />

  <EmptyState
    v-else-if="notices.length === 0"
    icon="avisos"
    title="No hay avisos por ahora"
    text="Cuando el administrador publique un aviso, lo verás aquí arriba del todo."
  />

  <div v-else class="stack">
    <article
      v-for="notice in notices"
      :key="notice.id"
      class="panel aviso"
      :class="{ nuevo: esNuevo(notice.created_at) }"
    >
      <div class="aviso-icono">
        <AppIcon name="avisos" :size="17" />
      </div>

      <div class="aviso-cuerpo">
        <div class="aviso-cab">
          <h3 class="aviso-titulo">{{ notice.title }}</h3>
          <span v-if="esNuevo(notice.created_at)" class="pill pill-accent">Nuevo</span>
        </div>
        <p v-if="notice.body" class="aviso-texto">{{ notice.body }}</p>
        <p class="aviso-pie dim small">
          <time :datetime="notice.created_at" :title="formatDate(notice.created_at)">
            {{ formatRelative(notice.created_at) }}
          </time>
        </p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

.aviso {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1.125rem 1.25rem;
  transition: box-shadow var(--fast), border-color var(--fast);
}

.aviso:hover {
  box-shadow: var(--shadow-md);
}

.aviso.nuevo {
  border-color: var(--accent-soft-border);
  background-image: linear-gradient(180deg, var(--sheen) 0, transparent 64px),
    radial-gradient(110% 120% at 0% 0%, var(--accent-soft) 0%, transparent 55%);
}

.aviso-icono {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  color: var(--text-dim);
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.aviso.nuevo .aviso-icono {
  color: var(--accent-text);
  background: var(--accent-soft);
  border-color: var(--accent-soft-border);
}

.aviso-cuerpo {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
  min-width: 0;
  padding-top: 2px;
}

.aviso-cab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.aviso-titulo {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.aviso-texto {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-muted);
  max-width: 68ch;
  white-space: pre-line;
}

.aviso-pie {
  margin-top: 0.125rem;
}
</style>
