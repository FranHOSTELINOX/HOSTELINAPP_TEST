-- ---------------------------------------------------------------------
-- Las horas imputadas solo las puede tocar un administrador
-- ---------------------------------------------------------------------
-- Hasta ahora cada persona podía borrar sus propios registros de tiempo.
-- Eso convertía el parte de horas en algo reversible: alguien podía
-- imputar un rato a un proyecto y borrarlo después, y el historial del
-- taller dejaba de ser fiable.
--
-- A partir de aquí cualquiera con sesión sigue pudiendo APUNTAR sus
-- horas (insert), pero solo el administrador puede borrarlas.
--
-- El update se cierra igual, y no por gusto: si un usuario pudiera
-- actualizar su propio registro, le bastaría con mover la hora de fin
-- encima de la de inicio para dejarlo en cero. Sería la misma puerta con
-- otro nombre. La interfaz nunca ha dejado editar un registro, así que
-- cerrarla no quita nada que se estuviera usando.
--
-- Si alguien se equivoca al apuntar, se lo dice al administrador, que
-- borra el registro desde su sesión.

drop policy if exists "time_entries_delete_own_or_admin" on public.time_entries;

create policy "time_entries_delete_admin"
  on public.time_entries for delete
  using (public.is_admin());

drop policy if exists "time_entries_update_own_or_admin" on public.time_entries;

create policy "time_entries_update_admin"
  on public.time_entries for update
  using (public.is_admin());
