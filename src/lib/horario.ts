// Horario de trabajo del taller.
//
//   Lunes a viernes: 07:00–15:00 y 16:00–18:00   (10 h)
//   Sábados:         06:30–11:30                 (5 h)
//   Domingos:        no se trabaja
//
// Todo se maneja en hora local (la del móvil o el ordenador de quien lo usa),
// que es la que ve el trabajador en el reloj de la pared.
//
// Si algún día cambia el convenio, se cambia SOLO la tabla TRAMOS de aquí
// abajo y el resto de la app se reajusta sola.

/** Un tramo de trabajo, en minutos desde medianoche. */
export interface Tramo {
  desde: number
  hasta: number
}

const h = (horas: number, minutos = 0) => horas * 60 + minutos

/** Tramos por día de la semana, con la numeración de JavaScript (0 = domingo). */
const TRAMOS: Record<number, Tramo[]> = {
  0: [], // domingo
  1: [{ desde: h(7), hasta: h(15) }, { desde: h(16), hasta: h(18) }],
  2: [{ desde: h(7), hasta: h(15) }, { desde: h(16), hasta: h(18) }],
  3: [{ desde: h(7), hasta: h(15) }, { desde: h(16), hasta: h(18) }],
  4: [{ desde: h(7), hasta: h(15) }, { desde: h(16), hasta: h(18) }],
  5: [{ desde: h(7), hasta: h(15) }, { desde: h(16), hasta: h(18) }],
  6: [{ desde: h(6, 30), hasta: h(11, 30) }], // sábado
}

/** Los tramos que se trabajan ese día. Array vacío = no se trabaja. */
export function tramosDelDia(fecha: Date): Tramo[] {
  return TRAMOS[fecha.getDay()] ?? []
}

/** "07:00" a partir de minutos desde medianoche. */
export function minutosAHora(minutos: number): string {
  const hh = Math.floor(minutos / 60)
  const mm = minutos % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** "07:00–15:00 y 16:00–18:00", o "no se trabaja". */
export function describeHorario(fecha: Date): string {
  const tramos = tramosDelDia(fecha)
  if (tramos.length === 0) return 'no se trabaja'
  return tramos
    .map((t) => `${minutosAHora(t.desde)}–${minutosAHora(t.hasta)}`)
    .join(' y ')
}

/** Minutos desde medianoche de un instante concreto. */
function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes() + fecha.getSeconds() / 60
}

/** ¿Ese instante cae dentro del horario de trabajo? */
export function dentroDeHorario(fecha: Date): boolean {
  const m = minutosDelDia(fecha)
  return tramosDelDia(fecha).some((t) => m >= t.desde && m < t.hasta)
}

/** Un tramo con sus horas ya troceadas, listas para un desplegable. */
export interface Franja {
  etiqueta: string
  horas: string[]
}

/**
 * El horario del día partido en intervalos (15 min por defecto), agrupado por
 * tramo, para ofrecerlo en los desplegables de "desde" y "hasta".
 *
 * Incluye la hora de cierre de cada tramo, que hace falta para poder decir
 * "hasta las 15:00".
 */
export function franjasDelDia(fecha: Date, pasoMinutos = 15): Franja[] {
  return tramosDelDia(fecha).map((tramo) => {
    const horas: string[] = []
    for (let m = tramo.desde; m <= tramo.hasta; m += pasoMinutos) {
      horas.push(minutosAHora(m))
    }
    return { etiqueta: tramo.desde < 14 * 60 ? 'Mañana' : 'Tarde', horas }
  })
}

/** Todas las horas del día en una sola lista, sin agrupar por tramo. */
export function horasDelDia(fecha: Date, pasoMinutos = 15): string[] {
  return franjasDelDia(fecha, pasoMinutos).flatMap((f) => f.horas)
}

/** Minutos de trabajo previstos ese día (600 de lunes a viernes, 300 el sábado). */
export function minutosPrevistos(fecha: Date): number {
  return tramosDelDia(fecha).reduce((suma, t) => suma + (t.hasta - t.desde), 0)
}

/** Medianoche del día de esa fecha. */
function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * De todo el rato entre `inicio` y `fin`, cuántos milisegundos caen dentro
 * del horario de trabajo. Recorre día a día, así que aguanta bien un registro
 * que se deja abierto y cruza la medianoche.
 */
export function msDentroDeHorario(inicio: Date, fin: Date): number {
  if (fin <= inicio) return 0

  let total = 0
  const dia = inicioDelDia(inicio)
  const limite = inicioDelDia(fin)

  // Tope de seguridad: si alguien deja un registro abierto meses, no nos
  // ponemos a iterar sin fin.
  for (let i = 0; dia <= limite && i < 400; i++) {
    for (const tramo of tramosDelDia(dia)) {
      const tramoInicio = new Date(dia)
      tramoInicio.setHours(0, tramo.desde, 0, 0)
      const tramoFin = new Date(dia)
      tramoFin.setHours(0, tramo.hasta, 0, 0)

      const desde = Math.max(inicio.getTime(), tramoInicio.getTime())
      const hasta = Math.min(fin.getTime(), tramoFin.getTime())
      if (hasta > desde) total += hasta - desde
    }
    dia.setDate(dia.getDate() + 1)
  }

  return total
}

/**
 * Revisa un rato imputado y avisa si algo no cuadra con el horario.
 * Devuelve null si está todo bien, o el motivo en lenguaje llano.
 *
 * Avisa, no bloquea: a veces se echa una hora de más y hay que poder
 * apuntarla igual.
 */
export function avisoDeHorario(inicio: Date, fin: Date): string | null {
  if (fin <= inicio) return 'La hora de fin tiene que ser posterior a la de inicio.'

  if (tramosDelDia(inicio).length === 0) {
    return 'Ese día no se trabaja según el horario del taller.'
  }

  const dentro = msDentroDeHorario(inicio, fin)
  if (dentro === 0) {
    return `Ese rato queda entero fuera del horario (${describeHorario(inicio)}).`
  }

  const total = fin.getTime() - inicio.getTime()
  const fuera = total - dentro
  // Menos de un minuto fuera es redondeo, no merece aviso.
  if (fuera > 60_000) {
    const minutos = Math.round(fuera / 60_000)
    return `${minutos} min quedan fuera del horario (${describeHorario(inicio)}).`
  }

  return null
}
