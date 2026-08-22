<script setup lang="ts">
import { computed, ref } from 'vue'
import { changePassword, profile, session } from '../stores/auth'
import { esAdmin } from '../stores/vista'
import { initials } from '../lib/format'
import AppIcon from '../components/AppIcon.vue'
import AlertMessage from '../components/AlertMessage.vue'
import PageHeader from '../components/PageHeader.vue'

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const message = ref('')
const loading = ref(false)

const nombre = computed(() => profile.value?.full_name || session.value?.user.email || '')
const correo = computed(() => session.value?.user.email ?? '')

/** Fuerza aproximada de la contraseña nueva, solo para orientar al usuario. */
const fuerza = computed(() => {
  const valor = newPassword.value
  if (!valor) return { nivel: 0, texto: '', clase: '' }
  let puntos = 0
  if (valor.length >= 8) puntos++
  if (valor.length >= 12) puntos++
  if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos++
  if (/\d/.test(valor)) puntos++
  if (/[^A-Za-z0-9]/.test(valor)) puntos++
  if (puntos <= 2) return { nivel: 1, texto: 'Débil', clase: 'debil' }
  if (puntos <= 3) return { nivel: 2, texto: 'Aceptable', clase: 'media' }
  return { nivel: 3, texto: 'Buena', clase: 'buena' }
})

const coinciden = computed(
  () => confirmPassword.value.length > 0 && newPassword.value === confirmPassword.value,
)

async function handleSubmit() {
  error.value = ''
  message.value = ''

  if (newPassword.value.length < 8) {
    error.value = 'La contraseña nueva debe tener al menos 8 caracteres.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Las dos contraseñas nuevas no coinciden.'
    return
  }

  loading.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    message.value = 'Contraseña actualizada.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo cambiar la contraseña'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PageHeader eyebrow="Mi cuenta" title="Cambiar contraseña" />

  <div class="cuenta">
    <!-- ---------- Ficha del usuario ---------- -->
    <aside class="panel panel-pad ficha">
      <span class="ficha-avatar">{{ initials(nombre) }}</span>
      <div class="ficha-texto">
        <strong>{{ nombre }}</strong>
        <span class="small muted">{{ correo }}</span>
      </div>
      <div class="ficha-datos">
        <div class="dato">
          <AppIcon name="escudo" :size="15" />
          <span>{{ esAdmin ? 'Administrador' : 'Miembro del equipo' }}</span>
        </div>
        <div v-if="profile?.puesto" class="dato">
          <AppIcon name="puesto" :size="15" />
          <span>{{ profile.puesto }}</span>
        </div>
      </div>
    </aside>

    <!-- ---------- Formulario ---------- -->
    <section class="panel formulario">
      <header class="panel-head">
        <AppIcon name="llave" :size="17" />
        <h3>Nueva contraseña</h3>
      </header>

      <div class="panel-body">
        <p class="small muted intro">
          Para cambiarla tienes que escribir primero la que usas ahora. Así nadie
          puede cambiártela aunque te dejes la sesión abierta.
        </p>

        <form class="stack" @submit.prevent="handleSubmit">
          <div class="field">
            <label class="field-label" for="current-password">Contraseña actual</label>
            <input
              id="current-password"
              v-model="currentPassword"
              class="input"
              type="password"
              required
              autocomplete="current-password"
            />
          </div>

          <div class="field">
            <label class="field-label" for="new-password">Contraseña nueva</label>
            <input
              id="new-password"
              v-model="newPassword"
              class="input"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <div v-if="newPassword" class="fuerza">
              <span class="fuerza-barras" :class="fuerza.clase">
                <i v-for="n in 3" :key="n" :class="{ on: n <= fuerza.nivel }"></i>
              </span>
              <span class="small" :class="fuerza.clase">{{ fuerza.texto }}</span>
            </div>
            <p v-else class="field-hint">Mínimo 8 caracteres.</p>
          </div>

          <div class="field">
            <label class="field-label" for="confirm-password">
              Repite la contraseña nueva
            </label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              class="input"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <p v-if="confirmPassword && !coinciden" class="field-hint aviso-no">
              Las dos contraseñas no coinciden todavía.
            </p>
            <p v-else-if="coinciden" class="field-hint aviso-si">
              <AppIcon name="check" :size="13" /> Coinciden.
            </p>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? 'Cambiando…' : 'Cambiar contraseña' }}
            </button>
          </div>

          <AlertMessage v-if="error" kind="error">{{ error }}</AlertMessage>
          <AlertMessage v-if="message" kind="success">{{ message }}</AlertMessage>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cuenta {
  display: grid;
  gap: 1.125rem;
  align-items: start;
}

@media (min-width: 860px) {
  .cuenta {
    grid-template-columns: 260px 1fr;
  }
}

/* ---------------- Ficha ---------------- */
.ficha {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ficha-avatar {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(160deg, var(--steel-600), var(--steel-900));
  border-radius: var(--r-lg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), var(--shadow-sm);
}

.ficha-texto {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ficha-texto strong {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.ficha-texto span {
  overflow-wrap: anywhere;
}

.ficha-datos {
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-soft);
}

.dato {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.dato svg {
  flex: none;
  color: var(--text-dim);
}

/* ---------------- Formulario ---------------- */
.formulario {
  max-width: 480px;
}

.intro {
  margin-bottom: 1.125rem;
  line-height: 1.55;
}

/* ---------------- Medidor de fuerza ---------------- */
.fuerza {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.125rem;
}

.fuerza-barras {
  display: flex;
  gap: 3px;
}

.fuerza-barras i {
  width: 26px;
  height: 4px;
  border-radius: var(--r-pill);
  background: var(--border);
}

.fuerza-barras.debil i.on {
  background: var(--danger-fg);
}

.fuerza-barras.media i.on {
  background: var(--warn-fg);
}

.fuerza-barras.buena i.on {
  background: var(--ok-fg);
}

.small.debil {
  color: var(--danger-fg);
}

.small.media {
  color: var(--warn-fg);
}

.small.buena {
  color: var(--ok-fg);
}

.aviso-no {
  color: var(--warn-fg);
}

.aviso-si {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--ok-fg);
}
</style>
