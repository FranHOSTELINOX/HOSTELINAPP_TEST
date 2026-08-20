<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { session } from '../stores/auth'
import type { Database } from '../lib/database.types'

type TimeEntry = Database['public']['Tables']['time_entries']['Row']

const entries = ref<TimeEntry[]>([])
const loading = ref(true)
const error = ref('')
const notes = ref('')

const openEntry = computed(() => entries.value.find((entry) => !entry.ended_at) ?? null)

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
  const { error: insertError } = await supabase.from('time_entries').insert({
    user_id: session.value.user.id,
    notes: notes.value || null,
  })
  if (insertError) {
    error.value = insertError.message
    return
  }
  notes.value = ''
  await loadEntries()
}

async function stopEntry(entry: TimeEntry) {
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', entry.id)

  if (updateError) {
    error.value = updateError.message
    return
  }
  await loadEntries()
}

onMounted(loadEntries)
</script>

<template>
  <h2>Registro de tiempos</h2>
  <p v-if="error" style="color: crimson">{{ error }}</p>

  <div class="card">
    <template v-if="openEntry">
      <p>Tienes un registro en marcha desde {{ new Date(openEntry.started_at).toLocaleString() }}</p>
      <button type="button" @click="stopEntry(openEntry)">Parar</button>
    </template>
    <template v-else>
      <input v-model="notes" placeholder="Nota (opcional)" />
      <button type="button" @click="startEntry">Empezar a registrar tiempo</button>
    </template>
  </div>

  <p v-if="loading">Cargando…</p>
  <div v-for="entry in entries" :key="entry.id" class="card">
    <p>Inicio: {{ new Date(entry.started_at).toLocaleString() }}</p>
    <p v-if="entry.ended_at">Fin: {{ new Date(entry.ended_at).toLocaleString() }}</p>
    <p v-else>En curso</p>
    <p v-if="entry.notes">{{ entry.notes }}</p>
  </div>
</template>
