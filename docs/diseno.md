# El diseño de HostelinApp

Guía para que cualquier pantalla nueva se parezca a las que ya hay.

## La idea

Hostelinox lleva desde 1982 fabricando en **acero inoxidable**. La app coge
ese material como lenguaje visual, y los colores salen del propio logo:

- **Superficies de acero**: cada tarjeta es una chapa. Gris frío, un hilo de
  luz en el canto de arriba y un grano vertical finísimo, como el cepillado
  del inox. Es el mismo plateado del óvalo del logo.
- **Geometría de taller**: esquinas poco redondeadas, rejillas alineadas,
  nada de burbujas.
- **El azul marino de la "H"** (`#2a0e72`) es el color de acción: el botón
  principal, la sección en la que estás, el foco del teclado.
- **El rojo de "ostelinox"** (`#fd2015`) se reserva para lo que borra o
  falla, y para un par de destellos de marca en la pantalla de acceso.

**Por qué el azul manda y el rojo no**: si el botón principal fuera rojo,
sería idéntico al de "Sí, borrar". Cada color hace el trabajo que su tono
sugiere.

Regla práctica: si en una pantalla hay más de dos o tres cosas de color,
sobra alguna.

## Colores

Nunca escribas un color a pelo en un componente. Usa los *tokens* de
`src/style.css`, que ya cambian solos entre modo claro y oscuro:

| Token | Para qué |
| --- | --- |
| `--bg` | el fondo de la página |
| `--surface` | el fondo de una tarjeta o panel |
| `--surface-inset` | huecos hundidos: inputs, pastillas, fondos de pestañas |
| `--border` / `--border-strong` | líneas y bordes |
| `--text` / `--text-muted` / `--text-dim` | texto principal / secundario / apagado |
| `--accent` / `--accent-fg` | el azul de marca y el color que va encima de él |
| `--accent-soft` / `--accent-text` | versión suave, para fondos y textos en azul |
| `--ok-*`, `--warn-*`, `--danger-*` | verde, ámbar y rojo de estado |

Si algún día cambia la marca, se tocan **solo** las escalas `--azul-*` y
`--rojo-*` del principio de `src/style.css` y se reajusta la app entera.

## Tipografías

- **Archivo** — títulos, cifras grandes y rótulos. Es una grotesca de aire
  industrial, va bien con la marca.
- **Inter** — todo el texto de interfaz.
- **JetBrains Mono** — números que tienen que cuadrar en columna: el
  cronómetro, las horas, las duraciones. Clase `.mono`.

Se cargan desde Google Fonts en `index.html`.

## Las clases que ya existen

Antes de escribir CSS, mira si ya está hecho:

- **Contenedores**: `panel` (la chapa), `panel-pad`, `panel-head`, `panel-body`
- **Botones**: `btn`, y encima `btn-primary`, `btn-ghost`, `btn-danger`,
  `btn-lg`, `btn-sm`, `btn-block`, `btn-icon`
- **Formularios**: `field`, `field-label`, `field-hint`, `input`, `select`,
  `textarea`, `switch`, `form-grid` (+ `form-grid-2` y `span-2`), `form-actions`
- **Estados**: `pill` (+ `pill-ok`, `pill-warn`, `pill-danger`, `pill-accent`,
  `pill-plain`, `pill-live` para el punto que late)
- **Mensajes**: `alert` (+ `alert-error`, `alert-success`) — o mejor, el
  componente `AlertMessage.vue`
- **Vacíos y carga**: `empty`, `skeleton` — o los componentes `EmptyState.vue`
  y `LoadingList.vue`
- **Colocar cosas**: `stack`, `stack-sm`, `stack-lg`, `row`, `spacer`,
  `card-grid`
- **Texto**: `eyebrow` (el rótulo pequeño en mayúsculas), `muted`, `dim`,
  `small`, `mono`, `sr-only`

Lo que sea propio de una sola pantalla va en su `<style scoped>`.

## Componentes compartidos

En `src/components/`:

- `PageHeader.vue` — la cabecera de cada pantalla (rótulo, título, subtítulo
  y un hueco `#acciones` a la derecha). Úsala siempre, así todas las
  pantallas empiezan igual.
- `AppIcon.vue` — los iconos, dibujados a mano en `icons.ts`. No hay librería
  de iconos: si necesitas uno nuevo, añade su `path` ahí con la misma rejilla
  de 24×24.
- `BrandLogo.vue` — el logo de Hostelinox, **entero**: el óvalo completo y
  la razón social debajo. Nunca lo recortes; se pide así de una pieza.
  Como esa línea es negra y sobre fondo oscuro no se vería, hay una versión
  con ella aclarada. Cuál toca se decide con `modoOscuro` del store de tema,
  y se puede forzar con `fondo="oscuro"` para sitios que son oscuros siempre
  (la chapa del acceso), tenga el usuario el modo que tenga.
- `EmptyState.vue`, `AlertMessage.vue`, `LoadingList.vue` — para no repetir
  el "no hay nada", el error y el "cargando…" en cada vista.

## Cómo montar una pantalla nueva

```vue
<template>
  <PageHeader eyebrow="Sección" title="Título" subtitle="De qué va esto." />

  <AlertMessage v-if="error" kind="error">{{ error }}</AlertMessage>
  <LoadingList v-if="loading" />
  <EmptyState v-else-if="items.length === 0" title="No hay nada todavía" />

  <div v-else class="stack">
    <article v-for="item in items" :key="item.id" class="panel panel-pad">
      …
    </article>
  </div>
</template>
```

Ese orden — cabecera, error, carga, vacío, contenido — es el que siguen todas
las vistas. Respétalo y la pantalla nueva encajará sin pensar.

## Modo claro y oscuro

Los dos están cuidados, y **lo decide el sistema del usuario**: si tiene el
móvil en oscuro, la app sale en oscuro. No hay botón para forzarlo (lo hubo y
se quitó; su sitio en la barra lo ocupa ahora el de "Ver como usuario").

Todo el cambio de color lo hace el CSS con `@media (prefers-color-scheme:
dark)`. `src/stores/theme.ts` solo queda para lo único que el CSS no puede
decidir: cuál de las dos versiones del logo cargar.

Al añadir estilos, **no** definas un color solo dentro del `@media`: define el
token en claro y deja que el bloque oscuro lo reajuste.

## Ver la app como un usuario

El administrador tiene un botón en la barra lateral (y arriba, en el móvil)
que le enseña la app como la ve alguien del equipo: se le caen los menús de
Calendario, Avisos, Horas del equipo y Administración, y desaparecen los
botones de borrar. Sale un aviso en azul mientras dura, porque si no parece
que la app se ha roto.

Lo lleva `src/stores/vista.ts`. Para saber si hay que pintar algo de
administrador, **usa `esAdmin` de ese store, no `role` del de sesión**: `role`
es el rol de verdad y no cambia, `esAdmin` es el que manda en la interfaz.

Y ten claro qué es: **una vista, no un permiso**. Los permisos de verdad los
da RLS en la base de datos y siguen siendo los del administrador. No sirve
para comprobar si un usuario podría hacer algo prohibido; sirve para ver su
menú y sus pantallas.

## Móvil

La app se usa mucho desde el móvil, en el taller. Por eso:

- En pantalla ancha hay barra lateral; en el móvil, barra arriba y **pestañas
  abajo** (donde llega el pulgar).
- Los botones normales (`btn`) no bajan de 40 px de alto. Los controles
  compactos —filtros, pestañas, el selector de estado— no bajan de 34 px, y
  el selector de estado sube a 40 px en móvil, que es donde se toca con el
  dedo (a veces con guantes).
- Las listas largas (filtros, pestañas) se deslizan de lado en vez de
  amontonarse.
- Cuidado con las rejillas (`display: grid`): si un hijo no sabe encogerse
  —una fila con pastillas que no parten, por ejemplo— estira la columna
  entera y saca la página de la pantalla. Se cura con `min-width: 0` en los
  hijos y dejando que las pastillas bajen de línea (`flex-wrap: wrap`).

Cuando toques una pantalla, pruébala estrechando la ventana del navegador
hasta el tamaño de un móvil antes de darla por buena.
