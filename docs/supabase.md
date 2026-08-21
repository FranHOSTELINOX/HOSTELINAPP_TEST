# Supabase: configuración y tareas manuales

## 1. Ejecutar la migración inicial

1. Entra en tu proyecto de Supabase → menú lateral **SQL Editor**.
2. **New query**.
3. Pega el contenido completo de `supabase/migrations/0001_init.sql`.
4. **Run**.

Si más adelante configuras el secret `SUPABASE_DB_URL` (ver
`docs/deploy.md`), las migraciones futuras se aplicarán solas en cada push
que toque `supabase/migrations/`. Aun así, sigue siendo buena idea revisar el
SQL de una migración nueva antes de fiarte del todo del workflow, sobre todo
al principio.

## 2. Convertirte en administrador

Nadie es `admin` por defecto, ni siquiera quien se registra primero — es una
protección a propósito. Para dártelo a ti mismo la primera vez:

1. Regístrate en la app (email y contraseña) para que se cree tu fila en
   `profiles`.
2. En Supabase, **SQL Editor**, ejecuta (cambia el email):

   ```sql
   update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
   ```

## 3. Cómo crear usuarios (tú, como admin)

El pedido era "sin registro abierto complicado": lo normal es que **tú**
crees las cuentas de tus usuarios, no que cualquiera se registre solo.

**Forma normal, desde la app**: entra como admin → menú **Administración** →
"Nuevo usuario" → rellena nombre, email, contraseña y puesto → "Crear
usuario". Por debajo llama a la Edge Function `admin-create-user`, que crea
la cuenta ya confirmada (la persona puede entrar directamente, sin
confirmar ningún email) y rellena su perfil. Necesita que el secret
`SUPABASE_ACCESS_TOKEN` esté configurado (sección 6) y la función desplegada;
si no, el botón dará error.

**Alternativa manual, sin pasar por la app**: en Supabase: **Authentication**
→ **Users** → **Add user** (marca "Auto confirm user"). En cuanto exista en
`auth.users`, el trigger crea su fila en `profiles` automáticamente con
`role = 'user'`; el `puesto` se quedará vacío hasta que alguien lo edite a
mano en la tabla.

**Cerrar el registro público** (que nadie pueda darse de alta solo desde el
formulario de la app, aunque la app actual no ofrece ese formulario):
**Authentication** → **Providers** → **Email** → desactiva "Allow new users
to sign up". El login con email/contraseña seguirá funcionando para las
cuentas que tú crees.

## 4. El anon key es público a propósito

`VITE_SUPABASE_ANON_KEY` viaja dentro del JavaScript que se descarga
cualquiera que visite la web. Eso es normal en Supabase: el anon key solo
identifica al proyecto, no da permisos por sí mismo — los permisos reales los
deciden las políticas RLS de `supabase/migrations/0001_init.sql`. Por eso no
hace falta tratarlo como un secreto ultra sensible, aunque tampoco hay que
publicar el **service role key** (ese sí es sensible). La única pieza que lo
usa es la Edge Function `admin-create-user` — y ahí es Supabase quien se lo
inyecta solo al ejecutarla; nunca pasa por el repositorio, por GitHub ni por
el navegador.

## 5. `SUPABASE_DB_URL` (para el workflow de migraciones)

1. En Supabase: **Project Settings** → **Database** → **Connection string**
   → modo **URI**, con el campo "Use connection pooling" desactivado si te
   da opción (para migraciones va mejor la conexión directa).
2. Sustituye `[YOUR-PASSWORD]` por la contraseña de tu base de datos (la que
   pusiste al crear el proyecto, o la que generes de nuevo en **Database** →
   **Database password** → **Reset database password**).
3. Guarda esa URL completa como secret `SUPABASE_DB_URL` en GitHub (ver
   `docs/deploy.md`).

## 6. `SUPABASE_ACCESS_TOKEN` (para desplegar las Edge Functions)

Este token es de tu cuenta de Supabase (no de un proyecto concreto), y es lo
que necesita el workflow `deploy-functions.yml` para poder subir la función
`admin-create-user` — la que usa el botón "Nuevo usuario" del panel de
administración.

1. Entra en [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
2. **Generate new token** → ponle un nombre (p. ej. "GitHub Actions
   HostelinApp") → **Generate token**.
3. Cópialo (solo se muestra una vez) y guárdalo como secret
   `SUPABASE_ACCESS_TOKEN` en GitHub (ver `docs/deploy.md`).

Con esto configurado, cada vez que cambie algo en `supabase/functions/` se
desplegará solo. Mientras no lo configures, el botón "Nuevo usuario" de la
app dará un error de conexión (la función no estará publicada todavía).
