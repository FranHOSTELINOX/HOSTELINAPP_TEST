/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages sirve el sitio en https://<usuario>.github.io/HOSTELINAPP_TEST/
// así que la app tiene que conocer esa ruta base para que los assets carguen bien.
export default defineConfig({
  base: '/HOSTELINAPP_TEST/',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
  },
})
