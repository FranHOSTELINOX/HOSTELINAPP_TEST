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

1. Regístrate en la app (con email o con Google) para que se cree tu fila en
   `profiles`.
2. En Supabase, **SQL Editor**, ejecuta (cambia el email):

   ```sql
   update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
   ```

## 3. Cómo crear usuarios (tú, como admin)

El pedido era "sin registro abierto complicado": lo normal es que **tú**
crees las cuentas de tus usuarios, no que cualquiera se registre solo.

1. En Supabase: **Authentication** → **Users** → **Add user** (puedes crear
   el usuario con email + contraseña provisional, o invitarlo por email).
2. En cuanto exista en `auth.users`, el trigger crea su fila en `profiles`
   automáticamente con `role = 'user'`.
3. Si quieres cerrar el registro público (que nadie pueda darse de alta
   solo desde el formulario de la app): **Authentication** → **Providers** →
   **Email** → desactiva "Allow new users to sign up". El login con
   email/contraseña seguirá funcionando para las cuentas que tú crees.

## 4. Login con Google

Esto no se puede automatizar desde código porque requiere credenciales de
Google Cloud. Pasos:

1. En [Google Cloud Console](https://console.cloud.google.com/), crea (o
   reutiliza) un proyecto → **APIs & Services** → **Credentials** → **Create
   credentials** → **OAuth client ID** → tipo **Web application**.
2. En **Authorized redirect URIs** añade la URL de callback que te muestra
   Supabase en el siguiente paso (algo como
   `https://zpacoqndlcirbsxguxvi.supabase.co/auth/v1/callback`).
3. Copia el **Client ID** y el **Client secret**.
4. En Supabase: **Authentication** → **Providers** → **Google** → actívalo y
   pega esas dos credenciales.
5. En **Authentication** → **URL Configuration**, añade la URL pública de tu
   GitHub Pages a **Redirect URLs**, por ejemplo:
   `https://<tu-usuario-de-github>.github.io/HOSTELINAPP_TEST/`
   (con la barra final, y en modo hash el propio código añade `#/` después).

## 5. El anon key es público a propósito

`VITE_SUPABASE_ANON_KEY` viaja dentro del JavaScript que se descarga
cualquiera que visite la web. Eso es normal en Supabase: el anon key solo
identifica al proyecto, no da permisos por sí mismo — los permisos reales los
deciden las políticas RLS de `supabase/migrations/0001_init.sql`. Por eso no
hace falta tratarlo como un secreto ultra sensible, aunque tampoco hay que
publicar el **service role key** (ese sí es sensible y esta app no lo usa en
ningún sitio).

## 6. `SUPABASE_DB_URL` (para el workflow de migraciones)

1. En Supabase: **Project Settings** → **Database** → **Connection string**
   → modo **URI**, con el campo "Use connection pooling" desactivado si te
   da opción (para migraciones va mejor la conexión directa).
2. Sustituye `[YOUR-PASSWORD]` por la contraseña de tu base de datos (la que
   pusiste al crear el proyecto, o la que generes de nuevo en **Database** →
   **Database password** → **Reset database password**).
3. Guarda esa URL completa como secret `SUPABASE_DB_URL` en GitHub (ver
   `docs/deploy.md`).
