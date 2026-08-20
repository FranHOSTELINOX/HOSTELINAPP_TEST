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

**Quién ve/edita qué**: cada persona ve y edita su propia fila; el admin ve y
edita todas. Un trigger (`prevent_role_escalation`) impide que alguien que no
sea admin se cambie su propio `role`.

**Importante**: nadie es `admin` por defecto, ni siquiera el primer usuario.
Hay que ponerlo a mano la primera vez (ver `docs/supabase.md`).

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

## `notices`

Avisos/textos que el admin publica para que los usuarios "consulten".
Misma forma y mismas reglas que `calendar_events`, pero con `title` + `body`
en vez de fechas.

## Función auxiliar: `is_admin()`

Todas las políticas RLS usan `public.is_admin()`, que comprueba si
`auth.uid()` tiene `role = 'admin'` en `profiles`. Está marcada
`security definer` para poder leer `profiles` sin entrar en un bucle de RLS
contra sí misma.
