import { createRouter, createWebHashHistory } from 'vue-router'
import { authReady, session } from '../stores/auth'
import { esAdmin } from '../stores/vista'

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
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/avisos',
      name: 'avisos',
      component: () => import('../views/NoticesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Todo el mundo entra aquí. Lo que cambia es el alcance: el
      // administrador ve las horas de todos y cada uno las suyas.
      path: '/horas',
      name: 'horas',
      component: () => import('../views/TeamHoursView.vue'),
      meta: { requiresAuth: true },
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
  // esAdmin, no role: cuando el administrador está mirando la app "como
  // usuario", las pantallas de administración también se le cierran, que es
  // justo lo que quiere comprobar.
  if (to.meta.requiresAdmin && !esAdmin.value) {
    return { name: 'tiempos' }
  }
  if (to.name === 'login' && session.value) {
    return { name: 'tiempos' }
  }
  return true
})

export default router
