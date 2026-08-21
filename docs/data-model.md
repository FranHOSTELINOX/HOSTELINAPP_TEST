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

## `projects` y `products`

El catálogo al que el equipo imputa sus horas. Un proyecto (por ejemplo
"Hotel Giralda") agrupa varios productos ("Campana mural 3000×1100"). Se
añadieron en la migración `0004_projects_products.sql`.

| `projects` | qué es                                          |
|------------|--------------------------------------------------|
| name       | nombre del proyecto                              |
| client     | cliente, opcional                                |
| active     | si sigue apareciendo al imputar horas            |

| `products` | qué es                                          |
|------------|--------------------------------------------------|
| project_id | proyecto al que pertenece (obligatorio)          |
| name       | nombre del producto                              |
| active     | si sigue apareciendo al imputar horas            |

**Quién ve/edita qué**: cualquiera con sesión ve el catálogo entero (hace
falta para poder imputar horas). Solo el admin crea, edita y borra.

**Retirar en vez de borrar**: `time_entries.product_id` tiene
`on delete restrict`, así que un producto con horas imputadas **no se puede
borrar** — Postgres lo rechaza y la interfaz lo explica. Para sacarlo del
catálogo sin perder el histórico se pone `active = false`.

## `tasks` (sin uso en la interfaz)

Las tareas se quitaron del menú de la app. La tabla **sigue existiendo** con
sus datos y sus políticas, pero ninguna pantalla la lee ni la escribe. Si
algún día se decide que no vuelve, habrá que borrarla con una migración
nueva (y, antes, `time_entries.task_id`).

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

Las horas que imputa cada trabajador.

| columna    | qué es                                     |
|------------|----------------------------------------------|
| product_id | producto al que se imputan las horas         |
| task_id    | resto de cuando había tareas; ya no se usa   |
| user_id    | quién registró el tiempo                     |
| started_at | inicio                                       |
| ended_at   | fin (null = todavía en marcha)               |

**Quién ve/edita qué**: cada usuario ve y gestiona solo sus propias entradas;
el admin ve y gestiona todas.

**El producto es obligatorio para el equipo, no para el admin**: la interfaz
no deja fichar a un usuario normal sin elegir proyecto y producto. A nivel de
base de datos la columna es opcional, para no romper los registros que ya
existían antes de esta pantalla.

**El horario del taller** (lunes a viernes 07:00–15:00 y 16:00–18:00; sábados
06:30–11:30) vive en `src/lib/horario.ts`, con sus tests. La app **avisa**
cuando un rato imputado se sale del horario, pero no lo impide: a veces se
echa una hora de más y hay que poder apuntarla. Si algún día cambia el
convenio, se cambia solo la tabla `TRAMOS` de ese archivo.

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
