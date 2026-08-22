-- ---------------------------------------------------------------------
-- Nadie puede estar en dos sitios a la vez
-- ---------------------------------------------------------------------
-- Una persona no puede trabajar en dos productos al mismo tiempo, así que
-- dos ratos suyos no pueden pisarse. Sin esto, apuntar dos veces el mismo
-- rato (por error o por costumbre) inflaba las horas del proyecto y las
-- del taller sin que nadie lo viera.
--
-- Se hace con un trigger y no con una restricción de exclusión a propósito:
-- la restricción se aplica también a lo que ya hay guardado, así que si
-- existiera algún solape antiguo la migración fallaría entera y no entraría
-- nada. El trigger solo mira lo que se guarda de aquí en adelante, y además
-- deja poner un mensaje en español que el trabajador entienda.
--
-- La contrapartida: entre la comprobación y el guardado hay un instante en
-- el que dos guardados a la vez podrían colarse. Con un taller de unas
-- pocas personas apuntando sus horas a mano, eso no pasa.

create or replace function public.time_entries_sin_solape()
returns trigger
language plpgsql
-- security definer para que la comprobación vea TODOS los ratos de esa
-- persona, sin depender de lo que RLS le deje ver a quien esté guardando.
security definer
set search_path = public
as $$
declare
  choque record;
begin
  -- Un registro sin cerrar no ocupa un rato concreto: no puede chocar.
  if new.ended_at is null then
    return new;
  end if;

  select te.started_at, te.ended_at
    into choque
  from public.time_entries te
  where te.user_id = new.user_id
    and te.id <> new.id
    and te.ended_at is not null
    -- Dos ratos se pisan si cada uno empieza antes de que acabe el otro.
    and te.started_at < new.ended_at
    and new.started_at < te.ended_at
  limit 1;

  if found then
    raise exception
      'Ya tienes horas apuntadas de % a % ese día. No se puede estar en dos productos a la vez.',
      to_char(choque.started_at at time zone 'Europe/Madrid', 'HH24:MI'),
      to_char(choque.ended_at at time zone 'Europe/Madrid', 'HH24:MI');
  end if;

  return new;
end;
$$;

drop trigger if exists time_entries_sin_solape on public.time_entries;

create trigger time_entries_sin_solape
  before insert or update on public.time_entries
  for each row execute function public.time_entries_sin_solape();
