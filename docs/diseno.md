# El diseño de HostelinApp

Guía para que cualquier pantalla nueva se parezca a las que ya hay.

## La idea

Hostelinox lleva desde 1982 fabricando en **acero inoxidable**. La app coge
ese material como lenguaje visual:

- **Superficies de acero**: cada tarjeta es una chapa. Gris frío, un hilo de
  luz en el canto de arriba y un grano vertical finísimo, como el cepillado
  del inox.
- **Geometría de taller**: esquinas poco redondeadas, rejillas alineadas,
  nada de burbujas.
- **El naranja de la fragua**: el único color cálido, y se usa con cuentagotas
  — solo para lo que está *vivo* o hay que *tocar*: el botón principal, la
  sección en la que estás, un registro de tiempo en marcha, un aviso nuevo.

Regla práctica: si en una pantalla hay más de dos o tres cosas naranjas,
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
| `--accent` / `--accent-fg` | el naranja y el color que va encima de él |
| `--accent-soft` / `--accent-text` | versión suave, para fondos y textos naranjas |
| `--ok-*`, `--warn-*`, `--danger-*` | verde, ámbar y rojo de estado |

Si algún día cambia el color de marca, se toca **solo** la escala `--ember-*`
del principio de `src/style.css` y se reajusta la app entera.

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
- `BrandMark.vue` — la placa de acero con la "H" y el travesaño al rojo.
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

Los dos están cuidados. El usuario lo cambia con el botón de la luna/sol de la
barra lateral (o de arriba, en el móvil) y se recuerda en el navegador
(`src/stores/theme.ts`). Por defecto va en "auto": lo que tenga puesto el
móvil o el ordenador.

Al añadir estilos, **no** definas un color solo dentro de un `@media
(prefers-color-scheme: dark)`: define el token en claro y deja que el sistema
haga el resto.

## Móvil

La app se usa mucho desde el móvil, en el taller. Por eso:

- En pantalla ancha hay barra lateral; en el móvil, barra arriba y **pestañas
  abajo** (donde llega el pulgar).
- Los botones y las zonas de tocar no bajan de 40 px de alto.
- Las listas largas (filtros, pestañas) se deslizan de lado en vez de
  amontonarse.

Cuando toques una pantalla, pruébala estrechando la ventana del navegador
hasta el tamaño de un móvil antes de darla por buena.
