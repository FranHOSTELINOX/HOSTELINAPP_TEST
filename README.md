# HOSTELINAPP_TEST

Aplicación para la gestión de tiempos de la producción.

App web personal (Vue 3 + TypeScript + Vite, backend en Supabase) donde un
administrador crea usuarios, les asigna tareas, y ellos marcan su estado,
registran tiempos y consultan el calendario y los avisos publicados.

- **Documentación del proyecto**: ver `CLAUDE.md` y la carpeta `docs/`
  (modelo de datos, despliegue, configuración de Supabase).
- **Demo publicada**: GitHub Pages, rama `gh-pages` (ver `docs/deploy.md`).

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellena tus claves si usas otro proyecto
npm run dev
```

## Comprobaciones antes de subir cambios

```bash
npm run lint    # comprueba tipos (vue-tsc)
npm run test    # tests (vitest)
npm run build   # build de producción real
```
