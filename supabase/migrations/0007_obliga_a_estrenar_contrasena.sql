-- ---------------------------------------------------------------------
-- Obligar a estrenar contraseña la primera vez
-- ---------------------------------------------------------------------
-- Cuando el administrador da de alta a alguien, le pone una contraseña y
-- se la pasa por WhatsApp. Esa contraseña la han visto dos personas y se
-- queda escrita en un móvil, así que no debería durar.
--
-- Esta marca dice "esta persona todavía usa la que le dieron". Mientras
-- esté puesta, la app no la deja ir a ninguna pantalla que no sea la de
-- cambiar la contraseña. Se quita sola en cuanto la cambia, y se vuelve a
-- poner si un administrador se la resetea porque la ha olvidado.
--
-- Ojo con lo que es: un cauce, no un cerrojo. La marca la puede quitar el
-- propio usuario (su política de update se lo permite, y hace falta que
-- así sea para que pueda quitársela al cambiarla). Sirve para que nadie se
-- quede usando la contraseña del alta por dejadez, no para defenderse de
-- alguien que quiera saltársela a propósito desde la API.

alter table public.profiles
  add column must_change_password boolean not null default true;

-- Los que ya estaban usando la app no tienen por qué estrenar nada: la
-- marca solo debe afectar a las altas de aquí en adelante.
update public.profiles set must_change_password = false;

comment on column public.profiles.must_change_password is
  'true = todavía usa la contraseña que le dio el administrador y la app le obliga a cambiarla antes de nada.';
