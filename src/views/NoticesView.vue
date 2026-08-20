<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type Notice = Database['public']['Tables']['notices']['Row']

const notices = ref<Notice[]>([])
const loading = ref(true)
const error = ref('')

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
  <h2>Avisos</h2>
  <p v-if="error" style="color: crimson">{{ error }}</p>
  <p v-if="loading">Cargando…</p>
  <p v-else-if="notices.length === 0">No hay avisos por ahora.</p>
  <div v-for="notice in notices" :key="notice.id" class="card">
    <strong>{{ notice.title }}</strong>
    <p v-if="notice.body">{{ notice.body }}</p>
  </div>
</template>
