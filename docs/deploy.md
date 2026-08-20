# Despliegue y GitHub Actions

Hay tres workflows en `.github/workflows/`.

## `deploy.yml` — test + build + publicar en GitHub Pages

Se dispara en cada push a `main` (y también a mano desde la pestaña
**Actions** → **Run workflow**). Hace, en orden: instala dependencias,
comprueba tipos (`vue-tsc`), corre los tests (`vitest`), construye el sitio
(`vite build`) y publica el contenido de `dist/` en la rama `gh-pages` con la
acción `peaceiris/actions-gh-pages`.

Usa dos secrets opcionales para inyectar la configuración de Supabase en el
build: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Si no los defines, el
workflow usa los valores del proyecto que diste al crear la app (el anon key
es público a propósito, ver `docs/supabase.md`). Defínelos igualmente si en
algún momento cambias de proyecto de Supabase.

**Configuración manual pendiente en GitHub** (una sola vez):

1. **Settings** → **Pages** → en "Build and deployment", **Source**:
   "Deploy from a branch" → rama `gh-pages`, carpeta `/ (root)`. La rama
   `gh-pages` no existe todavía: aparecerá sola la primera vez que este
   workflow corra con éxito, así que si no la ves en el desplegable, corre el
   workflow primero (push a `main`, o "Run workflow" manual) y vuelve
   después a esta pantalla.
2. **Settings** → **Actions** → **General** → en "Workflow permissions",
   asegúrate de que está en "Read and write permissions" (lo necesita
   `peaceiris/actions-gh-pages` para poder empujar a `gh-pages` con el
   `GITHUB_TOKEN` automático).

## `migrations.yml` — aplicar SQL nuevo automáticamente

Se dispara cuando un push a `main` toca algo dentro de
`supabase/migrations/`. Usa la Supabase CLI (`supabase db push`) contra el
secret `SUPABASE_DB_URL`. Si ese secret no existe todavía, el workflow **no
falla**: escribe un aviso (`::warning::`, visible en la pestaña Actions) y
no hace nada más.

**Configuración manual pendiente**: crear el secret `SUPABASE_DB_URL` en
**Settings** → **Secrets and variables** → **Actions** → **New repository
secret**. Cómo obtener ese valor está en `docs/supabase.md` (sección 6).

**Si ya ejecutaste una migración a mano en el SQL Editor** (como la
`0001_init.sql` inicial) antes de tener este workflow funcionando, Supabase
CLI no lo sabe y al hacer `supabase db push` intentará aplicarla de nuevo,
fallando con "relation ... already exists". Para esos casos, lanza el
workflow a mano: **Actions** → **Aplicar migraciones de Supabase** → **Run
workflow** → rellena `repair_version` con el número de la migración (por
ejemplo `0001`) → **Run workflow**. Eso marca esa versión como aplicada en
el historial de Supabase sin volver a ejecutar su SQL. Déjalo vacío las
próximas veces: así se comporta como siempre (aplica lo pendiente).

## `keepalive.yml` — evitar que Supabase pause el proyecto

El plan gratuito de Supabase pausa proyectos tras 7 días sin actividad. Este
workflow hace una petición trivial a la API cada 3 días
(`cron: "0 6 */3 * *"`, hora UTC) para que eso no pase. También se puede
lanzar a mano desde **Actions** → **Run workflow**.

Usa los mismos secrets opcionales que `deploy.yml`
(`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`), con el mismo valor por
defecto si no los defines. No requiere configuración manual aparte de que el
repositorio tenga Actions habilitado (lo está por defecto).

Nota sobre el cron: `*/3` en el campo de día-del-mes no da exactamente "cada
3 días" de forma perfecta en los cambios de mes (por ejemplo puede correr el
día 31 y otra vez al día siguiente, el día 1). Para este uso (evitar 7 días
de inactividad) sobra margen de sobra; no hace falta nada más preciso.

## Resumen de secrets que puedes/debes configurar

| Secret                     | Obligatorio | Para qué                                      |
|-----------------------------|:-----------:|------------------------------------------------|
| `SUPABASE_DB_URL`           | Sí, para que `migrations.yml` haga algo | aplicar migraciones SQL automáticamente |
| `VITE_SUPABASE_URL`         | No (tiene valor por defecto) | build del frontend y keepalive |
| `VITE_SUPABASE_ANON_KEY`    | No (tiene valor por defecto) | build del frontend y keepalive |
