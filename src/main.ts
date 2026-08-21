import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initAuth } from './stores/auth'
import { initTheme } from './stores/theme'
import './style.css'

initTheme()
initAuth()

createApp(App).use(router).mount('#app')
