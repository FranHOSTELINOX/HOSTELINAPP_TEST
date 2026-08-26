-- ---------------------------------------------------------------------
-- Recorta a 8 h los días de baja o permiso apuntados antes del tope
-- ---------------------------------------------------------------------
-- Cuando se estrenaron las bajas y los permisos, un "día completo" se
-- medía con el horario del taller: un martes salían 10 h 30 min. Después
-- se cambió al convenio (8 h al día, 40 a la semana) y llegó el trigger
-- `time_entries_tope_ausencia`, pero ese trigger solo mira lo que se
-- guarda de nuevo: los días que ya estaban apuntados se quedaron con las
-- horas antiguas.
--
-- Esto los deja bien de una vez. Va día a día y persona a persona: suma
-- las ausencias por orden de hora y, en cuanto la suma pasa de 8 h,
-- recorta el rato que se está pasando hasta dejar el día justo en 8 h.
--
-- No borra nada. Si un día tuviera tantos ratos que alguno se quedara
-- entero fuera del tope, ese se deja como está en vez de dejarlo a cero:
-- es preferible que se vea y se decida a mano.
--
-- Se puede volver a ejecutar sin miedo: la segunda vez ya no encuentra
-- nada que recortar.
--
-- El trigger del tope se apaga mientras dura el recorte y se vuelve a
-- encender al acabar. Si no, al arreglar el primer rato de un día podría
-- quejarse de los ratos de ese mismo día a los que aún no les ha llegado
-- el turno, y la migración entera se caería.
--
-- Nota sobre la semana: aquí solo se arregla el tope diario. Si alguna
-- semana suma más de 40 h después del recorte, quitar un día entero es
-- una decisión de personas, no de una migración.

do $$
declare
  zona     constant text := 'Europe/Madrid';
  tope_dia constant interval := interval '8 hours';
  tocados  integer := 0;
begin
  alter table public.time_entries disable trigger time_entries_tope_ausencia;

  with acumulado as (
    select
      te.id,
      te.started_at,
      te.ended_at - te.started_at as dura,
      sum(te.ended_at - te.started_at) over (
        partition by te.user_id, (te.started_at at time zone zona)::date
        order by te.started_at, te.id
        rows between unbounded preceding and current row
      ) as hasta_aqui
    from public.time_entries te
    where te.tipo <> 'trabajo'
      and te.ended_at is not null
  ),
  recortes as (
    select
      a.id,
      -- Lo que le queda de tope a este rato: 8 h menos lo que ya ocupaban
      -- los ratos anteriores del mismo día.
      tope_dia - (a.hasta_aqui - a.dura) as permitido
    from acumulado a
    where a.hasta_aqui > tope_dia
  )
  update public.time_entries te
     set ended_at = te.started_at + r.permitido
    from recortes r
   where te.id = r.id
     -- Solo si de verdad hay hueco: nada de dejar un rato a cero o del revés.
     and r.permitido > interval '0'
     and te.ended_at > te.started_at + r.permitido;

  get diagnostics tocados = row_count;

  alter table public.time_entries enable trigger time_entries_tope_ausencia;

  raise notice 'Ausencias recortadas a 8 h: %', tocados;
end;
$$;
