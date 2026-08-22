-- ---------------------------------------------------------------------
-- El cliente pasa a ser el dato obligatorio; el proyecto, el opcional
-- ---------------------------------------------------------------------
-- Hasta ahora un "proyecto" se daba de alta con el nombre del proyecto
-- (obligatorio) y, si acaso, el cliente (opcional). En el taller se
-- trabaja al revés: lo que siempre se sabe es para quién es el trabajo,
-- y el nombre del proyecto a veces ni existe.
--
-- Así que se invierten los papeles. Los datos NO se mueven de sitio: el
-- nombre del cliente ya estaba en `client` y el del proyecto en `name`.
-- Lo que cambia es cuál de los dos es obligatorio, y de paso las
-- columnas pasan a llamarse como lo que guardan, que `name` a secas ya
-- no decía nada.

-- 1. El nombre del proyecto deja de ser obligatorio.
alter table public.projects alter column name drop not null;

-- 2. Antes de exigir el cliente hay que rellenar los que no lo tengan.
--    Se pone un texto que canta, para que el administrador lo corrija;
--    no se inventa un cliente copiando el nombre del proyecto, que
--    sería peor: parecería un dato bueno sin serlo.
update public.projects
set client = 'Sin cliente'
where client is null or btrim(client) = '';

-- 3. El cliente pasa a ser obligatorio.
alter table public.projects alter column client set not null;

-- 4. Nombres que se explican solos.
alter table public.projects rename column name to project_name;
alter table public.projects rename column client to client_name;
