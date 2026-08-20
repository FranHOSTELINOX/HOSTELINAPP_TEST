<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']

const events = ref<CalendarEvent[]>([])
const loading = ref(true)
const error = ref('')

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
  <h2>Calendario</h2>
  <p v-if="error" style="color: crimson">{{ error }}</p>
  <p v-if="loading">Cargando…</p>
  <p v-else-if="events.length === 0">No hay eventos programados.</p>
  <div v-for="event in events" :key="event.id" class="card">
    <strong>{{ event.title }}</strong>
    <p>{{ new Date(event.start_at).toLocaleString() }}</p>
    <p v-if="event.description">{{ event.description }}</p>
  </div>
</template>
