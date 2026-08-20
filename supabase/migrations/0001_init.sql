-- 0001_init.sql
-- Esquema inicial de HOSTELINAPP: perfiles, tareas, registro de tiempos,
-- calendario y avisos. Row Level Security (RLS) activado en todas las
-- tablas: cada usuario solo ve/toca sus propias filas; el administrador
-- (profiles.role = 'admin') ve y gestiona todo.

-- ---------------------------------------------------------------------
-- Extensión para generar UUIDs
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "moddatetime" schema extensions;

-- ---------------------------------------------------------------------
-- profiles: una fila por usuario de auth.users, con su rol
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Función auxiliar: ¿el usuario autenticado es admin?
-- security definer para poder leer profiles sin chocar con sus propias
-- políticas RLS (si no, habría recursión infinita).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Crea automáticamente el perfil cuando alguien se registra en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impide que un usuario normal se auto-ascienda a admin editando su perfil
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- No hay policy de insert: las filas las crea el trigger handle_new_user
-- (corre como security definer, así que no necesita permiso RLS explícito).

-- ---------------------------------------------------------------------
-- tasks: tareas creadas por el admin y asignadas a un usuario
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_select_own_or_admin"
  on public.tasks for select
  using (assigned_to = auth.uid() or created_by = auth.uid() or public.is_admin());

create policy "tasks_insert_admin_only"
  on public.tasks for insert
  with check (public.is_admin());

-- El usuario asignado puede actualizar su tarea (para marcarla), el admin puede todo
create policy "tasks_update_own_or_admin"
  on public.tasks for update
  using (assigned_to = auth.uid() or public.is_admin());

create policy "tasks_delete_admin_only"
  on public.tasks for delete
  using (public.is_admin());

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------
-- time_entries: registro de tiempo del propio usuario (opcionalmente
-- ligado a una tarea)
-- ---------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.time_entries enable row level security;

create policy "time_entries_select_own_or_admin"
  on public.time_entries for select
  using (user_id = auth.uid() or public.is_admin());

create policy "time_entries_insert_own"
  on public.time_entries for insert
  with check (user_id = auth.uid() or public.is_admin());

create policy "time_entries_update_own_or_admin"
  on public.time_entries for update
  using (user_id = auth.uid() or public.is_admin());

create policy "time_entries_delete_own_or_admin"
  on public.time_entries for delete
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- calendar_events: calendario que genera el admin. assigned_to = null
-- significa "visible para todos los usuarios"
-- ---------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  assigned_to uuid references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

create policy "calendar_events_select_visible"
  on public.calendar_events for select
  using (assigned_to is null or assigned_to = auth.uid() or public.is_admin());

create policy "calendar_events_write_admin_only"
  on public.calendar_events for insert
  with check (public.is_admin());

create policy "calendar_events_update_admin_only"
  on public.calendar_events for update
  using (public.is_admin());

create policy "calendar_events_delete_admin_only"
  on public.calendar_events for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- notices: avisos/consultas que el admin publica para uno o todos
-- ---------------------------------------------------------------------
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  assigned_to uuid references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.notices enable row level security;

create policy "notices_select_visible"
  on public.notices for select
  using (assigned_to is null or assigned_to = auth.uid() or public.is_admin());

create policy "notices_write_admin_only"
  on public.notices for insert
  with check (public.is_admin());

create policy "notices_update_admin_only"
  on public.notices for update
  using (public.is_admin());

create policy "notices_delete_admin_only"
  on public.notices for delete
  using (public.is_admin());
