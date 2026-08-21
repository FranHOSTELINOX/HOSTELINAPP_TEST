# Modelo de datos

Definido en `supabase/migrations/0001_init.sql`. Cinco tablas, todas con RLS
activado.

## `profiles`

Una fila por persona registrada. Se crea sola con un trigger cuando alguien
se registra en Supabase Auth (`handle_new_user`).

| columna    | qué es                                   |
|------------|-------------------------------------------|
| id         | igual al id de `auth.users`               |
| email      | copiado de auth al registrarse            |
| full_name  | opcional                                  |
| role       | `admin` o `user` (por defecto `user`)     |
| puesto     | texto libre, p. ej. "Recepción" (opcional)|

**Quién ve/edita qué**: cada persona ve y edita su propia fila; el admin ve y
edita todas. Un trigger (`prevent_role_escalation`) impide que alguien
autenticado que no sea admin se cambie su propio `role` (una conexión
directa a la base de datos, como la que usan las migraciones, no cuenta como
"alguien autenticado" y no la bloquea).

**Importante**: nadie es `admin` por defecto, ni siquiera el primer usuario.
Hay que ponerlo a mano la primera vez (ver `docs/supabase.md`).

**Cómo se crean los usuarios**: el admin los da de alta desde la propia app
(pantalla Administración → "Nuevo usuario"), que llama a la Edge Function
`admin-create-user` (`supabase/functions/admin-create-user/`). Esa función es
la única pieza de la app con permisos de administrador sobre Supabase Auth
(la service role key), y Supabase se la inyecta sola — nunca viaja al
navegador. Comprueba primero que quien llama ya es admin, crea la cuenta,
confirma su email y rellena `full_name`/`puesto`. Ver `docs/deploy.md` para
cómo se despliega esa función.

## `tasks`

Tareas que crea el admin y asigna a un usuario.

| columna     | qué es                                              |
|-------------|------------------------------------------------------|
| status      | `pending` / `in_progress` / `done`                   |
| assigned_to | usuario que la tiene asignada (puede ser null)       |
| created_by  | quién la creó (siempre el admin en la práctica)      |
| due_date    | fecha límite opcional                                |

**Quién ve/edita qué**: el usuario asignado y el admin ven la tarea. Solo el
admin puede crear o borrar tareas; el usuario asignado puede actualizarla
(en la práctica, para marcar el `status` — la interfaz solo expone eso, pero
a nivel de base de datos la política permite actualizar cualquier campo de
una tarea propia; si eso llega a ser un problema, hay que separar la política
de update en dos, una para admin y otra restringida a `status` con una
función).

## `time_entries`

Registro de tiempo trabajado, opcionalmente ligado a una tarea.

| columna    | qué es                                     |
|------------|----------------------------------------------|
| task_id    | tarea relacionada (opcional)                 |
| user_id    | quién registró el tiempo                     |
| started_at | inicio                                       |
| ended_at   | fin (null = todavía en marcha)               |

**Quién ve/edita qué**: cada usuario ve y gestiona solo sus propias entradas;
el admin ve y gestiona todas.

## `calendar_events`

Eventos de calendario, los crea el admin.

| columna     | qué es                                             |
|-------------|-------------------------------------------------------|
| assigned_to | usuario concreto, o `null` = visible para todos       |

**Quién ve/edita qué**: todos ven los eventos con `assigned_to = null` más los
suyos propios; el admin ve y gestiona todos. Solo el admin crea/edita/borra.

**Cuidado con la hora**: `start_at` y `end_at` son `timestamptz`. Un
`<input type="datetime-local">` da la hora local sin zona (`2026-09-10T08:00`);
si se manda así tal cual, Postgres la interpreta en UTC y el evento aparece dos
horas más tarde en verano. Hay que convertir con `new Date(local).toISOString()`
al guardar y volver a hora local al rellenar el formulario (ver `aInputLocal` y
`aISO` en `src/views/AdminView.vue`).

## `notices`

Avisos/textos que el admin publica para que los usuarios "consulten".
Misma forma y mismas reglas que `calendar_events`, pero con `title` + `body`
en vez de fechas.

## Función auxiliar: `is_admin()`

Todas las políticas RLS usan `public.is_admin()`, que comprueba si
`auth.uid()` tiene `role = 'admin'` en `profiles`. Está marcada
`security definer` para poder leer `profiles` sin entrar en un bucle de RLS
contra sí misma.
