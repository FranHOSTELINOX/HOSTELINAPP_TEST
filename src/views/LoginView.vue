<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { signInWithEmail } from '../stores/auth'
import AppIcon from '../components/AppIcon.vue'
import BrandLogo from '../components/BrandLogo.vue'
import AlertMessage from '../components/AlertMessage.vue'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleEmailLogin() {
  error.value = ''
  loading.value = true
  try {
    await signInWithEmail(email.value, password.value)
    await router.push({ name: 'tiempos' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <!-- ---------- Lado izquierdo: la marca ---------- -->
    <section class="login-hero">
      <div class="hero-inner">
        <div class="hero-brand">
          <BrandLogo :width="300" fondo="oscuro" />
          <span class="hero-brand-app">HostelinApp</span>
        </div>

        <div class="hero-copy">
          <p class="hero-eyebrow">Acero inoxidable desde 1982</p>
          <p class="hero-text">
            Las horas, el calendario y los avisos del equipo de Hostelinox en
            un único sitio. Entra con tu cuenta para empezar.
          </p>
        </div>

        <ul class="hero-list">
          <li><AppIcon name="reloj" :size="16" /> Imputa tus horas a cada producto</li>
          <li><AppIcon name="puesto" :size="16" /> Proyectos y productos del taller</li>
          <li><AppIcon name="calendario" :size="16" /> Calendario y avisos compartidos</li>
        </ul>
      </div>
    </section>

    <!-- ---------- Lado derecho: el acceso ---------- -->
    <section class="login-panel">
      <div class="login-form">
        <div class="form-head">
          <p class="eyebrow">Acceso al equipo</p>
          <h1>Entra en tu cuenta</h1>
          <p class="muted small">
            Usa el correo y la contraseña que te haya dado el administrador.
          </p>
        </div>

        <form class="stack" @submit.prevent="handleEmailLogin">
          <div class="field">
            <label class="field-label" for="email">Correo electrónico</label>
            <input
              id="email"
              v-model="email"
              class="input"
              type="email"
              required
              autocomplete="email"
              placeholder="nombre@hostelinox.com"
            />
          </div>

          <div class="field">
            <label class="field-label" for="password">Contraseña</label>
            <input
              id="password"
              v-model="password"
              class="input"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="loading">
            <template v-if="loading">Entrando…</template>
            <template v-else>
              Entrar
              <AppIcon name="flecha" :size="17" />
            </template>
          </button>

          <AlertMessage v-if="error" kind="error">{{ error }}</AlertMessage>
        </form>

        <p class="login-foot dim small">
          ¿No tienes cuenta o has perdido la contraseña? Habla con el
          administrador y te la crea o te la cambia.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 940px) {
  .login {
    grid-template-columns: 1.05fr 1fr;
  }
}

/* ---------------- El panel de marca ---------------- */
.login-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 2.5rem 1.5rem;
  color: var(--steel-100);
  /* Chapa de acero: degradado en diagonal + veta vertical fina */
  background-color: var(--steel-950);
  background-image: radial-gradient(
      120% 90% at 12% 0%,
      rgba(253, 32, 21, 0.14) 0%,
      transparent 55%
    ),
    linear-gradient(155deg, #26313f 0%, #161d27 38%, #0b1017 100%);
}

/* La veta del cepillado */
.login-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.028) 0 1px,
    transparent 1px 4px
  );
  pointer-events: none;
}

/* El filo al rojo que separa los dos lados */
.login-hero::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--rojo-500) 35%,
    var(--rojo-300) 50%,
    var(--rojo-500) 65%,
    transparent
  );
}

@media (min-width: 940px) {
  .login-hero::after {
    inset: 0 0 0 auto;
    width: 3px;
    height: auto;
    background: linear-gradient(
      180deg,
      transparent,
      var(--rojo-500) 35%,
      var(--rojo-300) 50%,
      var(--rojo-500) 65%,
      transparent
    );
  }
}

.hero-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

@media (min-width: 940px) {
  .hero-inner {
    margin: 0 0 0 auto;
    padding-right: 3.5rem;
    max-width: 520px;
  }
}

.hero-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
}

.hero-brand-app {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--steel-400);
  padding-left: 3px;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.hero-eyebrow {
  font-family: var(--font-display);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--rojo-300);
}

.hero-text {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--steel-300);
  max-width: 42ch;
}

.hero-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
  padding: 1.25rem 0 0;
  list-style: none;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.hero-list li {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.875rem;
  color: var(--steel-300);
}

.hero-list svg {
  flex: none;
  color: var(--rojo-400);
}

/* ---------------- El panel del formulario ---------------- */
.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.25rem 3.5rem;
  background: var(--bg);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 380px;
}

.form-head {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-head h1 {
  font-size: 1.5rem;
}

.login-foot {
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  line-height: 1.5;
}
</style>
