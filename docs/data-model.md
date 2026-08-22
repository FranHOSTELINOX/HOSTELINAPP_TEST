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

**Quién ve qué**: cada usuario ve solo sus propias entradas; el admin las ve
todas. De eso vive la pantalla "Horas del equipo" (`/horas`, solo admin): no
necesita permisos especiales ni vistas nuevas, porque la política de select ya
se los da.

**Lo apuntado no se borra: solo el admin puede** (migración
`0005_solo_admin_toca_horas_imputadas.sql`). Cualquiera con sesión apunta sus
horas (insert), pero borrar y actualizar son solo de administrador. El update
se cerró junto con el delete a propósito: si un usuario pudiera actualizar su
propio registro, le bastaría con mover la hora de fin encima de la de inicio
para dejarlo en cero, que es borrarlo por otra puerta. La interfaz nunca ha
dejado editar un registro, así que no se pierde nada.

Si alguien se equivoca, se lo dice al administrador, y él lo borra desde su
sesión. La pantalla de Tiempos se lo explica al usuario para que no lo busque.

**El producto es obligatorio para el equipo, no para el admin**: la interfaz
no deja fichar a un usuario normal sin elegir proyecto y producto. A nivel de
base de datos la columna es opcional, para no romper los registros que ya
existían antes de esta pantalla.

**Las horas se apuntan a mano, no con cronómetro.** Hubo un botón de empezar
y parar; se quitó a propósito. Los registros que quedaran abiertos de
entonces (`ended_at` a null) no cuentan para los totales y la pantalla los
saca aparte para poder borrarlos.

**El horario del taller** (lunes a viernes 07:00–15:00 y 16:00–18:00; sábados
06:30–11:30) vive en `src/lib/horario.ts`, con sus tests. Si algún día cambia
el convenio, se cambia solo la tabla `TRAMOS` de ese archivo y se reajustan
solos los desplegables, los avisos y las horas previstas.

De ahí salen los desplegables de "desde" y "hasta": `franjasDelDia()` parte el
horario en huecos de 15 minutos agrupados por tramo (mañana y tarde), así que
solo se pueden elegir horas de la jornada. El de "hasta" además descarta las
anteriores a la de inicio.

Aun así queda un hueco por el que colarse —elegir de 14:00 a 16:00 cruza el
rato de la comida—, y para eso está `avisoDeHorario()`, que lo advierte. **Avisa
pero no bloquea**: a veces se echa una hora de más y hay que poder apuntarla.

## `calendar_events`

Eventos de calendario, los crea el admin.

| columna     | qué es                                             |
|-------------|-------------------------------------------------------|
| assigned_to | usuario concreto, o `null` = visible para todos       |

**Quién ve/edita qué**: a nivel de base de datos, todos ven los eventos con
`assigned_to = null` más los suyos propios; el admin ve y gestiona todos. Solo
el admin crea/edita/borra.

**Pero en la app el calendario es solo para el admin**: la pestaña se quitó
del menú del equipo y la ruta `/calendario` pide `requiresAdmin`. Las
políticas RLS se dejaron como estaban, así que si algún día se decide que el
equipo vuelva a consultarlo, basta con quitar ese `requiresAdmin` y volver a
poner la pestaña; no hace falta migración.

**Cuidado con la hora**: `start_at` y `end_at` son `timestamptz`. Un
`<input type="datetime-local">` da la hora local sin zona (`2026-09-10T08:00`);
si se manda así tal cual, Postgres la interpreta en UTC y el evento aparece dos
horas más tarde en verano. Hay que convertir con `new Date(local).toISOString()`
al guardar y volver a hora local al rellenar el formulario (ver `aInputLocal` y
`aISO` en `src/views/AdminView.vue`).

## `notices`

Avisos/textos que publica el admin. Misma forma y mismas reglas que
`calendar_events`, incluido lo de la pestaña: la ruta `/avisos` también es
solo de administrador desde que se quitó del menú del equipo.

## Función auxiliar: `is_admin()`

Todas las políticas RLS usan `public.is_admin()`, que comprueba si
`auth.uid()` tiene `role = 'admin'` en `profiles`. Está marcada
`security definer` para poder leer `profiles` sin entrar en un bucle de RLS
contra sí misma.
