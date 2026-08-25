import { describe, expect, it } from 'vitest'
import {
  HORAS_AUSENCIA_DIA,
  HORAS_AUSENCIA_SEMANA,
  jornadaDeAusencia,
  lunesDe,
  nombreTipo,
} from '../src/lib/ausencias'

// Semana del lunes 17 al domingo 23 de agosto de 2026.
const dia = (n: number) => new Date(2026, 7, 17 + n, 9, 0, 0)
const HORA = 60 * 60 * 1000

describe('jornadaDeAusencia', () => {
  it('un día entre semana son ocho horas', () => {
    const j = jornadaDeAusencia(dia(0))!
    expect(j.hasta.getTime() - j.desde.getTime()).toBe(HORAS_AUSENCIA_DIA * HORA)
  })

  it('empieza a la hora de entrada del taller', () => {
    const j = jornadaDeAusencia(dia(0))!
    expect(`${j.desde.getHours()}:${String(j.desde.getMinutes()).padStart(2, '0')}`).toBe('6:30')
  })

  it('y acaba antes del descanso, sin pisarlo', () => {
    const j = jornadaDeAusencia(dia(0))!
    expect(`${j.hasta.getHours()}:${String(j.hasta.getMinutes()).padStart(2, '0')}`).toBe('14:30')
  })

  it('el sábado también son ocho, aunque en el taller sea media jornada', () => {
    const j = jornadaDeAusencia(dia(5))!
    expect(j.hasta.getTime() - j.desde.getTime()).toBe(HORAS_AUSENCIA_DIA * HORA)
  })

  it('el domingo no cuenta: no hay jornada de la que faltar', () => {
    expect(jornadaDeAusencia(dia(6))).toBeNull()
  })

  it('de lunes a viernes salen las cuarenta horas del tope semanal', () => {
    let total = 0
    for (let n = 0; n < 5; n += 1) {
      const j = jornadaDeAusencia(dia(n))!
      total += j.hasta.getTime() - j.desde.getTime()
    }
    expect(total).toBe(HORAS_AUSENCIA_SEMANA * HORA)
  })

  it('y de lunes a sábado se pasan del tope, que es lo que la app rechaza', () => {
    let total = 0
    for (let n = 0; n < 6; n += 1) {
      const j = jornadaDeAusencia(dia(n))!
      total += j.hasta.getTime() - j.desde.getTime()
    }
    expect(total).toBe(48 * HORA)
    expect(total).toBeGreaterThan(HORAS_AUSENCIA_SEMANA * HORA)
  })
})

describe('lunesDe', () => {
  it('desde un miércoles da el lunes de esa semana', () => {
    expect(lunesDe(dia(2)).getDate()).toBe(17)
  })

  it('desde el propio lunes, se queda', () => {
    expect(lunesDe(dia(0)).getDate()).toBe(17)
  })

  it('desde el domingo da el lunes anterior, no el siguiente', () => {
    expect(lunesDe(dia(6)).getDate()).toBe(17)
  })

  it('deja la hora a medianoche', () => {
    expect(lunesDe(dia(3)).getHours()).toBe(0)
  })
})

describe('nombreTipo', () => {
  it('nombra los tres tipos', () => {
    expect(nombreTipo('baja')).toBe('Baja laboral')
    expect(nombreTipo('permiso')).toBe('Permiso retribuido')
    expect(nombreTipo('trabajo')).toBe('Trabajo')
  })
})
