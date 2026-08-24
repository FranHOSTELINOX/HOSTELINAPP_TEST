-- ---------------------------------------------------------------------
-- Bajas laborales y permisos retribuidos
-- ---------------------------------------------------------------------
-- Una baja o un permiso son horas de la jornada igual que las de taller:
-- ocupan el mismo calendario y compiten por el mismo rato. Por eso no van
-- en una tabla aparte, sino en time_entries con una etiqueta que dice qué
-- son. Así, gratis:
--
--   · el trigger de solapes impide estar de baja y trabajando a la vez;
--   · las horas del equipo se pueden repartir entre trabajo, baja y
--     permiso sin cruzar dos tablas;
--   · las políticas RLS que ya existen valen tal cual (cada uno ve y
--     apunta lo suyo, el administrador lo ve todo y es el único que borra).
--
-- Una ausencia no se imputa a ningún producto: no se está fabricando nada.
-- Eso lo garantiza la restricción de abajo, no solo la interfaz.

alter table public.time_entries
  add column tipo text not null default 'trabajo'
  check (tipo in ('trabajo', 'baja', 'permiso'));

comment on column public.time_entries.tipo is
  'trabajo = horas de taller imputadas a un producto; baja = baja laboral; permiso = permiso retribuido.';

-- Un rato de trabajo puede llevar producto; una ausencia, nunca.
alter table public.time_entries
  add constraint time_entries_ausencia_sin_producto
  check (tipo = 'trabajo' or product_id is null);

-- Las tres pantallas piden "lo mío, de este tipo, por fecha".
create index if not exists time_entries_user_tipo_idx
  on public.time_entries (user_id, tipo, started_at desc);
