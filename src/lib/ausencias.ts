import type { TipoRato } from './database.types'
import type { IconName } from '../components/icons'

// ---------------------------------------------------------------------
// Cuánto vale una ausencia
// ---------------------------------------------------------------------
// Una baja o un permiso no se miden con el horario del taller, sino con la
// jornada de convenio: 8 horas al día y 40 a la semana. Por eso un día de
// baja son 8 h y no las 10 h 30 que se está en el taller de lunes a viernes.
//
// 5 días × 8 h dan las 40 h justas, así que la semana de ausencia va de
// lunes a viernes: un sábado no genera horas de baja ni de permiso.

/** Horas de una jornada de ausencia. */
export const HORAS_AUSENCIA_DIA = 8
/** Tope de horas de ausencia por semana (lunes a domingo). */
export const HORAS_AUSENCIA_SEMANA = 40

/** Minuto de entrada de la jornada de ausencia (06:30, como el taller). */
const ENTRADA = 6 * 60 + 30

/**
 * El rato que ocupa un día completo de ausencia, o null si ese día no cuenta
 * (sábados, domingos). Son 8 horas seguidas desde la hora de entrada, así que
 * caben enteras en el tramo de mañana y no pisan el rato de la comida.
 */
export function jornadaDeAusencia(dia: Date): { desde: Date; hasta: Date } | null {
  const finde = dia.getDay() === 0 || dia.getDay() === 6
  if (finde) return null
  const desde = new Date(dia)
  desde.setHours(0, ENTRADA, 0, 0)
  const hasta = new Date(desde)
  hasta.setHours(hasta.getHours() + HORAS_AUSENCIA_DIA)
  return { desde, hasta }
}

/** El lunes de la semana de esa fecha, a medianoche. */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/**
 * Lo que cambia de una ausencia a otra: solo los textos y el icono. El
 * comportamiento es idéntico, así que las dos pantallas son el mismo
 * componente con una de estas fichas.
 */
export interface Ausencia {
  tipo: Exclude<TipoRato, 'trabajo'>
  ruta: string
  /** Cómo se llama en el menú y en la cabecera. */
  titulo: string
  /** Versión corta, para las pestañas de abajo del móvil. */
  corto: string
  icono: IconName
  eyebrow: string
  subtitulo: string
  /** "No has apuntado ninguna baja todavía." */
  vacio: string
  ejemploNota: string
}

export const AUSENCIAS: Ausencia[] = [
  {
    tipo: 'baja',
    ruta: '/baja',
    titulo: 'Baja laboral',
    corto: 'Baja',
    icono: 'botiquin',
    eyebrow: 'Mi jornada',
    subtitulo: 'Apunta los días o las horas que has estado de baja.',
    vacio: 'No has apuntado ninguna baja todavía',
    ejemploNota: 'Ej. gripe, parte del médico…',
  },
  {
    tipo: 'permiso',
    ruta: '/permiso',
    titulo: 'Permiso retribuido',
    corto: 'Permiso',
    icono: 'permiso',
    eyebrow: 'Mi jornada',
    subtitulo: 'Apunta los días o las horas de permiso retribuido.',
    vacio: 'No has apuntado ningún permiso todavía',
    ejemploNota: 'Ej. cita médica, mudanza, examen…',
  },
]

export function ausenciaDe(tipo: string): Ausencia | undefined {
  return AUSENCIAS.find((a) => a.tipo === tipo)
}

/** "Baja laboral" / "Permiso retribuido" / "Trabajo", para los informes. */
export function nombreTipo(tipo: TipoRato): string {
  return ausenciaDe(tipo)?.titulo ?? 'Trabajo'
}
