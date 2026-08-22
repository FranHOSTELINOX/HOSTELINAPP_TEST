import { createRouter, createWebHashHistory } from 'vue-router'
import { authReady, role, session } from '../stores/auth'

const router = createRouter({
  // Modo hash (URLs tipo /#/tiempos) porque GitHub Pages no sabe redirigir
  // rutas "bonitas" de una SPA de vuelta a index.html.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/tiempos' },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    {
      path: '/tiempos',
      name: 'tiempos',
      component: () => import('../views/TimeEntriesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/calendario',
      name: 'calendario',
      component: () => import('../views/CalendarView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/avisos',
      name: 'avisos',
      component: () => import('../views/NoticesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/horas',
      name: 'horas',
      component: () => import('../views/TeamHoursView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/cambiar-contrasena',
      name: 'cambiar-contrasena',
      component: () => import('../views/ChangePasswordView.vue'),
      meta: { requiresAuth: true },
    },
    // Cualquier otra dirección (un enlace viejo, una guardada en favoritos
    // como /#/tareas) va a parar a Tiempos, en vez de dejar la página en
    // blanco porque ninguna ruta encaja.
    { path: '/:ruta(.*)*', redirect: '/tiempos' },
  ],
})

router.beforeEach(async (to) => {
  if (!authReady.value) {
    await new Promise<void>((resolve) => {
      const stop = setInterval(() => {
        if (authReady.value) {
          clearInterval(stop)
          resolve()
        }
      }, 20)
    })
  }

  if (to.meta.requiresAuth && !session.value) {
    return { name: 'login' }
  }
  if (to.meta.requiresAdmin && role.value !== 'admin') {
    return { name: 'tiempos' }
  }
  if (to.name === 'login' && session.value) {
    return { name: 'tiempos' }
  }
  return true
})

export default router
