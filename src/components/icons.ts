// Juego de iconos propio, dibujado a mano en SVG, para no añadir ninguna
// librería extra al proyecto. Todos comparten la misma rejilla de 24x24 y el
// mismo grosor de trazo, así que combinan bien entre ellos.
export const iconPaths = {
  tareas: 'M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  reloj: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  calendario:
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  avisos:
    'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  admin: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4',
  usuario: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  usuarios:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  llave: 'M7 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM10.5 12.5 21 2M18 5l3 3M15 8l2.5 2.5',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  mas: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  aviso: 'M12 8v5M12 16.5v.5M12 3l9 16H3l9-16Z',
  error: 'M12 8v5M12 16v.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  exito: 'm8.5 12.5 2.5 2.5 4.5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  play: 'M7 4.5v15l13-7.5-13-7.5Z',
  stop: 'M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  sol: 'M12 4V2M12 22v-2M6 6 4.5 4.5M19.5 19.5 18 18M4 12H2M22 12h-2M6 18l-1.5 1.5M19.5 4.5 18 6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  luna: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  bandeja: 'M3 12h5l2 3h4l2-3h5M5 5h14l2 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-7Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  cerrar: 'M6 6l12 12M18 6 6 18',
  nota: 'M9 3h6l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v5h5M9 13h6M9 17h4',
  puesto: 'M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8ZM8 8V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M3 13h18',
  correo: 'M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  escudo: 'M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6l8-3ZM9 12l2 2 4-4',
  flecha: 'm9 6 6 6-6 6',
  abajo: 'm6 9 6 6 6-6',
  barras: 'M3 21h18M7 21V11M12 21V4M17 21v-6',
  // Un ojo: "así se ve esto desde fuera"
  ojo: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  editar: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
  borrar:
    'M3 6h18M8 6V4.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 4.5V6M18.5 6l-.9 13.1a1.5 1.5 0 0 1-1.5 1.4H7.9a1.5 1.5 0 0 1-1.5-1.4L5.5 6M10 11v5M14 11v5',
} as const

export type IconName = keyof typeof iconPaths
