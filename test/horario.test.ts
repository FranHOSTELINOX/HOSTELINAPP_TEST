import { describe, expect, it } from 'vitest'
import {
  avisoDeHorario,
  dentroDeHorario,
  describeHorario,
  minutosAHora,
  minutosPrevistos,
  msDentroDeHorario,
  tramosDelDia,
} from '../src/lib/horario'

// Referencias fijas (hora local): 2026-08-17 es lunes, 22 sábado, 23 domingo.
const lunes = (hh: number, mm = 0) => new Date(2026, 7, 17, hh, mm, 0, 0)
const sabado = (hh: number, mm = 0) => new Date(2026, 7, 22, hh, mm, 0, 0)
const domingo = (hh: number, mm = 0) => new Date(2026, 7, 23, hh, mm, 0, 0)

const HORA = 3_600_000

describe('tramosDelDia', () => {
  it('de lunes a viernes hay dos tramos', () => {
    expect(tramosDelDia(lunes(9))).toHaveLength(2)
  })

  it('el sábado hay uno solo', () => {
    expect(tramosDelDia(sabado(9))).toHaveLength(1)
  })

  it('el domingo no se trabaja', () => {
    expect(tramosDelDia(domingo(9))).toHaveLength(0)
  })
})

describe('minutosAHora', () => {
  it('formatea los minutos como hora', () => {
    expect(minutosAHora(7 * 60)).toBe('07:00')
    expect(minutosAHora(6 * 60 + 30)).toBe('06:30')
    expect(minutosAHora(18 * 60)).toBe('18:00')
  })
})

describe('describeHorario', () => {
  it('describe el horario de un día entre semana', () => {
    expect(describeHorario(lunes(9))).toBe('07:00–15:00 y 16:00–18:00')
  })

  it('describe el del sábado', () => {
    expect(describeHorario(sabado(9))).toBe('06:30–11:30')
  })

  it('y avisa cuando no se trabaja', () => {
    expect(describeHorario(domingo(9))).toBe('no se trabaja')
  })
})

describe('dentroDeHorario', () => {
  it('acepta las horas de la mañana entre semana', () => {
    expect(dentroDeHorario(lunes(7))).toBe(true)
    expect(dentroDeHorario(lunes(12))).toBe(true)
    expect(dentroDeHorario(lunes(14, 59))).toBe(true)
  })

  it('rechaza el rato de la comida', () => {
    expect(dentroDeHorario(lunes(15))).toBe(false)
    expect(dentroDeHorario(lunes(15, 30))).toBe(false)
  })

  it('acepta el tramo de la tarde', () => {
    expect(dentroDeHorario(lunes(16))).toBe(true)
    expect(dentroDeHorario(lunes(17, 59))).toBe(true)
  })

  it('rechaza antes de entrar y después de salir', () => {
    expect(dentroDeHorario(lunes(6, 59))).toBe(false)
    expect(dentroDeHorario(lunes(18))).toBe(false)
    expect(dentroDeHorario(lunes(22))).toBe(false)
  })

  it('el sábado tiene su propio horario', () => {
    expect(dentroDeHorario(sabado(6, 29))).toBe(false)
    expect(dentroDeHorario(sabado(6, 30))).toBe(true)
    expect(dentroDeHorario(sabado(11, 29))).toBe(true)
    expect(dentroDeHorario(sabado(11, 30))).toBe(false)
    expect(dentroDeHorario(sabado(13))).toBe(false)
  })

  it('el domingo nunca', () => {
    expect(dentroDeHorario(domingo(10))).toBe(false)
  })
})

describe('minutosPrevistos', () => {
  it('entre semana son diez horas', () => {
    expect(minutosPrevistos(lunes(9))).toBe(600)
  })

  it('el sábado, cinco', () => {
    expect(minutosPrevistos(sabado(9))).toBe(300)
  })

  it('el domingo, ninguna', () => {
    expect(minutosPrevistos(domingo(9))).toBe(0)
  })
})

describe('msDentroDeHorario', () => {
  it('cuenta entero un rato que cae dentro', () => {
    expect(msDentroDeHorario(lunes(8), lunes(12))).toBe(4 * HORA)
  })

  it('descuenta el rato de la comida', () => {
    // De 14:00 a 17:00 hay 3 h de reloj, pero 15:00–16:00 no se trabaja.
    expect(msDentroDeHorario(lunes(14), lunes(17))).toBe(2 * HORA)
  })

  it('recorta lo que se sale por delante y por detrás', () => {
    // De 06:00 a 19:00: solo cuentan 07:00–15:00 y 16:00–18:00 = 10 h.
    expect(msDentroDeHorario(lunes(6), lunes(19))).toBe(10 * HORA)
  })

  it('da cero si el rato queda entero fuera', () => {
    expect(msDentroDeHorario(lunes(15, 5), lunes(15, 50))).toBe(0)
    expect(msDentroDeHorario(domingo(9), domingo(14))).toBe(0)
  })

  it('da cero si el fin no es posterior al inicio', () => {
    expect(msDentroDeHorario(lunes(10), lunes(10))).toBe(0)
    expect(msDentroDeHorario(lunes(12), lunes(9))).toBe(0)
  })

  it('aguanta un registro que cruza la medianoche', () => {
    // Del sábado 10:00 al domingo 10:00: solo cuenta 10:00–11:30 del sábado.
    expect(msDentroDeHorario(sabado(10), domingo(10))).toBe(1.5 * HORA)
  })
})

describe('avisoDeHorario', () => {
  it('no dice nada cuando todo cuadra', () => {
    expect(avisoDeHorario(lunes(8), lunes(12))).toBeNull()
    expect(avisoDeHorario(sabado(7), sabado(11))).toBeNull()
  })

  it('protesta si el fin no es posterior al inicio', () => {
    expect(avisoDeHorario(lunes(12), lunes(9))).toMatch(/posterior/)
  })

  it('avisa en un día que no se trabaja', () => {
    expect(avisoDeHorario(domingo(9), domingo(13))).toMatch(/no se trabaja/)
  })

  it('avisa si el rato entero queda fuera', () => {
    expect(avisoDeHorario(lunes(19), lunes(21))).toMatch(/fuera del horario/)
  })

  it('avisa de los minutos sueltos que se salen', () => {
    // 14:00–16:00 son 2 h, pero 15:00–16:00 no se trabaja: 60 min fuera.
    expect(avisoDeHorario(lunes(14), lunes(16))).toMatch(/60 min/)
  })

  it('perdona un desvío de segundos', () => {
    const inicio = lunes(8)
    const fin = new Date(lunes(12).getTime() + 30_000)
    expect(avisoDeHorario(inicio, fin)).toBeNull()
  })
})
