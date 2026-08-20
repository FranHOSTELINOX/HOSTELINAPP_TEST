<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Database, TaskStatus } from '../lib/database.types'

type Task = Database['public']['Tables']['tasks']['Row']

const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref('')

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
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', task.id)

  if (updateError) {
    error.value = updateError.message
    return
  }
  task.status = status
}

onMounted(loadTasks)
</script>

<template>
  <h2>Tareas</h2>
  <p v-if="error" style="color: crimson">{{ error }}</p>
  <p v-if="loading">Cargando…</p>
  <p v-else-if="tasks.length === 0">No tienes tareas por ahora.</p>
  <div v-for="task in tasks" :key="task.id" class="card">
    <strong>{{ task.title }}</strong>
    <p v-if="task.description">{{ task.description }}</p>
    <p v-if="task.due_date">Fecha límite: {{ task.due_date }}</p>
    <select
      :value="task.status"
      @change="updateStatus(task, ($event.target as HTMLSelectElement).value as TaskStatus)"
    >
      <option value="pending">Pendiente</option>
      <option value="in_progress">En curso</option>
      <option value="done">Hecha</option>
    </select>
  </div>
</template>
