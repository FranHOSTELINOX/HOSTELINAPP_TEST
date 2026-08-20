-- 0002_fix_role_escalation_trigger.sql
-- prevent_role_escalation() bloqueaba CUALQUIER cambio de role, incluidas
-- las conexiones directas de administracion (por ejemplo, migraciones via
-- SUPABASE_DB_URL), porque auth.uid() es null fuera de una sesion
-- autenticada por PostgREST. Esas conexiones directas ya tienen acceso
-- completo (no pasan por RLS), asi que el trigger solo debe frenar a un
-- usuario autenticado intentando auto-ascenderse a admin.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol';
  end if;
  return new;
end;
$$;
