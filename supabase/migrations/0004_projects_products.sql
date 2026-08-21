-- 0004_projects_products.sql
-- Proyectos y productos para imputar horas.
--
-- Un proyecto (por ejemplo "Hotel Giralda") agrupa varios productos
-- (por ejemplo "Campana mural 3000x1100"). El equipo imputa sus horas a un
-- producto concreto; el catalogo lo crea y lo mantiene solo el administrador.
--
-- Esta migracion es aditiva: crea dos tablas nuevas y anade una columna
-- opcional a time_entries. No borra ni modifica datos existentes.

-- ---------------------------------------------------------------------
-- projects: los trabajos que entran en el taller
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Cualquiera con sesion ve el catalogo: hace falta para poder imputar horas.
create policy "projects_select_authenticated"
  on public.projects for select
  using (auth.uid() is not null);

create policy "projects_insert_admin_only"
  on public.projects for insert
  with check (public.is_admin());

create policy "projects_update_admin_only"
  on public.projects for update
  using (public.is_admin());

create policy "projects_delete_admin_only"
  on public.projects for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- products: lo que se fabrica dentro de un proyecto
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index products_project_id_idx on public.products (project_id);

alter table public.products enable row level security;

create policy "products_select_authenticated"
  on public.products for select
  using (auth.uid() is not null);

create policy "products_insert_admin_only"
  on public.products for insert
  with check (public.is_admin());

create policy "products_update_admin_only"
  on public.products for update
  using (public.is_admin());

create policy "products_delete_admin_only"
  on public.products for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- time_entries: a que producto se imputan las horas
-- ---------------------------------------------------------------------
-- on delete restrict a proposito: un producto con horas imputadas no se
-- puede borrar, para no perder el historico. Para retirarlo del catalogo
-- se usa active = false.
alter table public.time_entries
  add column product_id uuid references public.products (id) on delete restrict;

create index time_entries_product_id_idx on public.time_entries (product_id);
