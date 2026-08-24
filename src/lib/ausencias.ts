import type { TipoRato } from './database.types'
import type { IconName } from '../components/icons'

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
