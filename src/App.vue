<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { profile, role, session, signOut } from './stores/auth'
import { theme, toggleTheme } from './stores/theme'
import { initials } from './lib/format'
import AppIcon from './components/AppIcon.vue'
import BrandLogo from './components/BrandLogo.vue'
import type { IconName } from './components/icons'

const route = useRoute()
const router = useRouter()

// Los cambios de sesión (login, logout, expiración) no siempre pasan por
// una navegación de vue-router, así que hay que vigilarlos aparte y
// mandar a la pantalla correcta cuando cambian.
watch(session, (newSession) => {
  if (!newSession && route.meta.requiresAuth) {
    router.push({ name: 'login' })
  } else if (newSession && route.name === 'login') {
    router.push({ name: 'tiempos' })
  }
})

type NavItem = { to: string; label: string; short: string; icon: IconName; admin?: boolean }

const navItems: NavItem[] = [
  { to: '/tiempos', label: 'Tiempos', short: 'Tiempos', icon: 'reloj' },
  { to: '/calendario', label: 'Calendario', short: 'Agenda', icon: 'calendario' },
  { to: '/avisos', label: 'Avisos', short: 'Avisos', icon: 'avisos' },
  { to: '/horas', label: 'Horas del equipo', short: 'Horas', icon: 'barras', admin: true },
  { to: '/admin', label: 'Administración', short: 'Admin', icon: 'admin', admin: true },
]

const visibleNav = computed(() =>
  navItems.filter((item) => !item.admin || role.value === 'admin'),
)

const displayName = computed(
  () => profile.value?.full_name || session.value?.user.email || '',
)
const displayInitials = computed(() => initials(displayName.value))
const subtitle = computed(() =>
  profile.value?.puesto || (role.value === 'admin' ? 'Administración' : 'Equipo'),
)

const themeLabel = computed(() =>
  theme.value === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
)
</script>

<template>
  <!-- Sin sesión (pantalla de acceso): sin marco, a pantalla completa. -->
  <RouterView v-if="!session" />

  <div v-else class="shell">
    <!-- ---------- Barra lateral (ordenador) ---------- -->
    <aside class="sidebar">
      <RouterLink to="/tiempos" class="brand">
        <BrandLogo :width="204" />
        <span class="brand-sub">HostelinApp</span>
      </RouterLink>

      <nav class="side-nav" aria-label="Secciones">
        <RouterLink
          v-for="item in visibleNav"
          :key="item.to"
          :to="item.to"
          class="side-link"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="side-foot">
        <RouterLink to="/cambiar-contrasena" class="user-card">
          <span class="avatar">{{ displayInitials }}</span>
          <span class="user-text">
            <strong>{{ displayName }}</strong>
            <span class="user-sub">{{ subtitle }}</span>
          </span>
        </RouterLink>

        <div class="side-actions">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :title="themeLabel"
            :aria-label="themeLabel"
            @click="toggleTheme()"
          >
            <AppIcon :name="theme === 'dark' ? 'sol' : 'luna'" :size="16" />
          </button>
          <RouterLink to="/cambiar-contrasena" class="btn btn-ghost btn-sm">
            <AppIcon name="llave" :size="16" />
            Contraseña
          </RouterLink>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost btn-sm" @click="signOut()">
            <AppIcon name="salir" :size="16" />
            Salir
          </button>
        </div>
      </div>
    </aside>

    <div class="shell-main">
      <!-- ---------- Barra superior (móvil) ---------- -->
      <header class="topbar">
        <RouterLink to="/tiempos" class="brand brand-compact">
          <BrandLogo :width="148" />
        </RouterLink>
        <span class="spacer"></span>
        <button
          type="button"
          class="btn btn-ghost btn-icon"
          :title="themeLabel"
          :aria-label="themeLabel"
          @click="toggleTheme()"
        >
          <AppIcon :name="theme === 'dark' ? 'sol' : 'luna'" :size="18" />
        </button>
        <RouterLink
          to="/cambiar-contrasena"
          class="avatar avatar-link"
          :title="displayName"
        >
          {{ displayInitials }}
        </RouterLink>
        <button
          type="button"
          class="btn btn-ghost btn-icon"
          title="Salir"
          aria-label="Salir"
          @click="signOut()"
        >
          <AppIcon name="salir" :size="18" />
        </button>
      </header>

      <main class="content">
        <!-- El <div> envuelve la vista para que <Transition> tenga siempre un
             único nodo raíz: las vistas devuelven varios elementos sueltos. -->
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <div :key="route.path">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>

      <!-- ---------- Pestañas inferiores (móvil) ---------- -->
      <nav class="tabbar" aria-label="Secciones">
        <RouterLink
          v-for="item in visibleNav"
          :key="item.to"
          :to="item.to"
          class="tab-link"
        >
          <AppIcon :name="item.icon" :size="20" />
          <span>{{ item.short }}</span>
        </RouterLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
}

.shell-main {
  min-height: 100dvh;
}

/* ---------------- Marca ---------------- */
.brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  text-decoration: none;
  color: var(--text);
  min-width: 0;
}

.brand-compact {
  flex-direction: row;
  align-items: center;
  gap: 0;
}

/* El nombre de la app, debajo del logo de la empresa */
.brand-sub {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding-left: 2px;
}

/* ---------------- Barra lateral ---------------- */
.sidebar {
  display: none;
}

@media (min-width: 900px) {
  .shell {
    display: grid;
    grid-template-columns: 260px 1fr;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    position: sticky;
    top: 0;
    height: 100dvh;
    padding: 1.25rem 1rem;
    background-color: var(--surface);
    background-image: linear-gradient(180deg, var(--sheen) 0, transparent 120px);
    border-right: 1px solid var(--border);
  }

  .sidebar > .brand {
    padding: 0.25rem 0.5rem 0;
  }
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.side-link {
  display: flex;
  align-items: center;
  gap: 0.6875rem;
  padding: 0.5625rem 0.6875rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  transition: background-color var(--fast), color var(--fast),
    border-color var(--fast);
}

.side-link:hover {
  color: var(--text);
  background: var(--surface-inset);
}

.side-link.router-link-active {
  position: relative;
  color: var(--text);
  font-weight: 600;
  background: var(--surface-inset);
  border-color: var(--border);
  box-shadow: var(--shadow-xs);
}

/* La marca de acento del elemento activo */
.side-link.router-link-active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: var(--r-pill);
  background: var(--accent);
}

.side-link.router-link-active svg {
  color: var(--accent);
}

.side-foot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--border-soft);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem;
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  transition: background-color var(--fast), border-color var(--fast);
  min-width: 0;
}

.user-card:hover {
  background: var(--surface-inset);
  border-color: var(--border);
}

.user-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  min-width: 0;
}

.user-text strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-sub {
  font-size: 0.75rem;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.side-actions .btn {
  text-decoration: none;
}

/* ---------------- Avatar ---------------- */
.avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-invert);
  background: linear-gradient(160deg, var(--steel-600), var(--steel-800));
  border-radius: var(--r-md);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), var(--shadow-xs);
  text-decoration: none;
}

.avatar-link {
  transition: transform var(--fast);
}

.avatar-link:hover {
  transform: translateY(-1px);
}

/* ---------------- Barra superior (móvil) ---------------- */
.topbar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 0.625rem 0.875rem;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

@media (min-width: 900px) {
  .topbar {
    display: none;
  }
}

/* ---------------- Contenido ---------------- */
.content {
  max-width: 1080px;
  margin: 0 auto;
  padding: 1.25rem 1rem 5.5rem;
}

@media (min-width: 900px) {
  .content {
    padding: 2rem 2rem 3rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 160ms var(--ease), transform 160ms var(--ease);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-leave-to {
  opacity: 0;
}

/* ---------------- Pestañas inferiores (móvil) ---------------- */
.tabbar {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 0.375rem 0.375rem calc(0.375rem + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
}

@media (min-width: 900px) {
  .tabbar {
    display: none;
  }
}

.tab-link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0.4375rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-dim);
  text-decoration: none;
  border-radius: var(--r-md);
  transition: color var(--fast), background-color var(--fast);
}

.tab-link:hover {
  color: var(--text-muted);
}

.tab-link.router-link-active {
  color: var(--accent-text);
  background: var(--accent-soft);
}
</style>
