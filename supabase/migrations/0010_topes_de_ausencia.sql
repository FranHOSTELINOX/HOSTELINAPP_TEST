-- ---------------------------------------------------------------------
-- Una ausencia no puede pasar de 8 h al día ni de 40 a la semana
-- ---------------------------------------------------------------------
-- Las bajas y los permisos no se miden con el horario del taller sino con
-- la jornada de convenio: 8 horas al día, 40 a la semana. Un día de baja
-- son 8 h, no las 10 h 30 que se está en el taller de lunes a viernes.
--
-- El tope es CONJUNTO, no uno por tipo: una persona no puede estar ausente
-- más de lo que dura su jornada, dé igual que sea media mañana de baja y
-- media tarde de permiso.
--
-- Las horas de taller no entran en esta cuenta: si alguien echa una hora de
-- más en el taller es asunto del parte de horas, no de este tope.

create or replace function public.time_entries_tope_ausencia()
returns trigger
language plpgsql
-- security definer para que la suma vea TODAS las ausencias de esa persona,
-- sin depender de lo que RLS le deje ver a quien esté guardando.
security definer
set search_path = public
as $$
declare
  zona    constant text := 'Europe/Madrid';
  tope_dia   constant interval := interval '8 hours';
  tope_semana constant interval := interval '40 hours';
  dia_local  date;
  del_dia    interval;
  de_semana  interval;
begin
  -- El trabajo no tiene tope aquí, y un rato sin cerrar no ocupa nada.
  if new.tipo = 'trabajo' or new.ended_at is null then
    return new;
  end if;

  dia_local := (new.started_at at time zone zona)::date;

  -- Lo que ya hay ese día, más lo que se está guardando.
  select coalesce(sum(te.ended_at - te.started_at), interval '0')
    into del_dia
  from public.time_entries te
  where te.user_id = new.user_id
    and te.tipo <> 'trabajo'
    and te.ended_at is not null
    and te.id <> new.id
    and (te.started_at at time zone zona)::date = dia_local;

  if del_dia + (new.ended_at - new.started_at) > tope_dia then
    raise exception
      'Un día no puede tener más de 8 h entre bajas y permisos. Ese día ya llevas %.',
      to_char(del_dia, 'HH24:MI');
  end if;

  -- Y lo mismo con la semana, de lunes a domingo.
  select coalesce(sum(te.ended_at - te.started_at), interval '0')
    into de_semana
  from public.time_entries te
  where te.user_id = new.user_id
    and te.tipo <> 'trabajo'
    and te.ended_at is not null
    and te.id <> new.id
    and date_trunc('week', (te.started_at at time zone zona))
        = date_trunc('week', (new.started_at at time zone zona));

  if de_semana + (new.ended_at - new.started_at) > tope_semana then
    raise exception
      'Una semana no puede tener más de 40 h entre bajas y permisos. Esa semana ya llevas %.',
      to_char(de_semana, 'HH24:MI');
  end if;

  return new;
end;
$$;

drop trigger if exists time_entries_tope_ausencia on public.time_entries;

create trigger time_entries_tope_ausencia
  before insert or update on public.time_entries
  for each row execute function public.time_entries_tope_ausencia();
