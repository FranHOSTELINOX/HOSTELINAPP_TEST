-- 0003_add_puesto.sql
-- Añade el puesto de trabajo (texto libre, p. ej. "Recepción", "Limpieza")
-- al perfil de cada usuario. Lo rellena el admin al crear la cuenta.

alter table public.profiles
  add column puesto text;
