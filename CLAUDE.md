# CLAUDE.md

Guía para cualquier sesión de Claude (o persona) que continúe este proyecto sin
contexto previo. Lee esto antes de tocar código.

## Qué es esto

HostelinApp: una app web personal donde un **administrador** (el dueño del
proyecto) crea usuarios, les asigna **tareas**, ellos **marcan** el estado de
esas tareas, **registran tiempos** trabajados, y consultan un **calendario** y
**avisos** que publica el administrador.

## Montaje técnico (no cambiar sin que te lo pidan)

- **Frontend**: Vue 3 + TypeScript + Vite, en la raíz del repo (no en una
  subcarpeta).
- **Router**: `vue-router` en modo **hash** (`createWebHashHistory`), porque
  GitHub Pages no puede redirigir rutas "bonitas" de vuelta a `index.html`.
- **Hosting**: GitHub Pages, publicado desde la rama `gh-pages` (no desde
  `main` directamente). `vite.config.ts` tiene `base: '/HOSTELINAPP_TEST/'` —
  si el repo cambia de nombre, este valor y el `index.html` deben
  actualizarse juntos.
- **Backend**: Supabase (Postgres + Auth + API REST autogenerada). No hay
  servidor propio: el frontend habla directo con Supabase usando
  `@supabase/supabase-js` y el anon key. La única excepción son las
  operaciones que necesitan permisos de administrador (hoy, crear usuarios
  nuevos): esas viven en Edge Functions de Supabase
  (`supabase/functions/`), la única pieza con acceso a la service role key,
  que Supabase inyecta sola y nunca sale de ahí.
- **Seguridad**: Row Level Security (RLS) activado en **todas** las tablas.
  El anon key es público a propósito (así funciona Supabase); la seguridad
  real la da RLS, no el secreto del key.

## Estructura del repo

```
src/
  style.css              sistema de diseño "Acero" (tokens + componentes CSS)
  components/            piezas compartidas de interfaz (AppIcon, BrandMark,
                           PageHeader, EmptyState, AlertMessage, LoadingList)
  lib/supabase.ts        cliente único de Supabase
  lib/database.types.ts  tipos TS a mano que reflejan el esquema SQL
  lib/format.ts           utilidades pequeñas (con test)
  stores/auth.ts          estado de sesión/rol/perfil, sin Pinia (app pequeña)
  stores/theme.ts         modo claro/oscuro, recordado en el navegador
  router/index.ts         rutas + guardas por sesión/rol
  views/                  una vista por pantalla (Login, Tasks, TimeEntries,
                           Calendar, Notices, Admin, ChangePassword)
supabase/migrations/      SQL versionado, en orden (0001_, 0002_, ...)
supabase/functions/       Edge Functions (una carpeta por función)
.github/workflows/        CI/CD (ver docs/deploy.md)
docs/                     documentación ampliada, léela si vas a tocar algo
test/                     tests de Vitest
```

## Convenciones

- **Migraciones SQL**: cada cambio de esquema es un archivo nuevo en
  `supabase/migrations/`, numerado (`0002_algo.sql`, `0003_otra_cosa.sql`...).
  Nunca edites una migración ya aplicada; añade una nueva. Cada tabla nueva
  necesita `enable row level security` + sus políticas en el mismo archivo.
- **Tipos de Supabase**: si cambias el esquema, actualiza a mano
  `src/lib/database.types.ts` (Row/Insert/Update/Relationships por tabla). Si
  algún día usas la Supabase CLI localmente, `supabase gen types typescript`
  lo genera solo.
- **Operaciones con permisos de administrador** (crear usuarios, y
  cualquier otra cosa que necesite la service role key): van en una Edge
  Function nueva dentro de `supabase/functions/`, nunca en el frontend.
  Cada función debe comprobar ella misma que quien la llama es admin antes
  de hacer nada (ver `supabase/functions/admin-create-user/index.ts` como
  ejemplo). Se despliegan solas con `.github/workflows/deploy-functions.yml`
  al hacer push si tocas esa carpeta.
- **Vistas nuevas**: añádelas en `src/views/`, regístralas en
  `src/router/index.ts` con `meta.requiresAuth` (y `meta.requiresAdmin` si
  solo las usa el administrador).
- **Textos de la interfaz**: en español, tono sencillo (el dueño del
  proyecto es principiante).
- **Estilos**: todo sale del sistema de diseño de `src/style.css`. Antes de
  escribir CSS nuevo, mira si ya existe la clase (`panel`, `btn`,
  `btn-primary`, `input`, `select`, `textarea`, `field`, `pill`, `alert`,
  `empty`, `stack`, `row`…). Nunca pongas colores a pelo: usa los tokens
  (`var(--surface)`, `var(--text-muted)`, `var(--accent)`…), que son los que
  cambian solos entre modo claro y oscuro. Los estilos propios de una
  pantalla van en su `<style scoped>`. Ver `docs/diseno.md`.
- **Sin Pinia ni frameworks extra**: mientras la app siga siendo pequeña,
  usa el patrón de `src/stores/auth.ts` (refs reactivos exportados). Si el
  estado compartido crece mucho, se puede reconsiderar.
- **Commits**: mensajes cortos en español, en presente ("Añade vista de
  calendario", no "Added calendar view").

## Antes de dar por terminado un cambio

```
npm run lint    # vue-tsc -b, comprueba tipos
npm run test    # vitest
npm run build   # build de producción real (falla si algo no compila)
```

## Dónde está cada cosa explicada con más detalle

- `docs/supabase.md` — cómo ejecutar migraciones a mano, cómo funciona RLS
  aquí, cómo crear usuarios como admin.
- `docs/deploy.md` — qué hace cada workflow de GitHub Actions y qué secrets
  necesita.
- `docs/data-model.md` — las 5 tablas, para qué sirve cada una y quién puede
  ver/tocar qué fila.
- `docs/diseno.md` — el sistema de diseño: colores, tipografías, las clases
  que ya existen y cómo montar una pantalla nueva que no desentone.

## Configuración pendiente que NO puede hacer una sesión de Claude

Cosas que requieren clicar en paneles web con la cuenta del dueño del
proyecto (GitHub, Supabase). Revisa `docs/deploy.md` y
`docs/supabase.md` para el checklist actualizado; no asumas que ya están
hechas solo porque el código las soporta.
