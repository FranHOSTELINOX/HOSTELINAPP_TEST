import { describe, expect, it } from 'vitest'
import {
  daysFromToday,
  dueState,
  entryDuration,
  formatClock,
  formatDateTime,
  formatDayLabel,
  formatDuration,
  formatRelative,
  initials,
  monthKey,
} from '../src/lib/format'

describe('formatDateTime', () => {
  it('formatea una fecha ISO como cadena localizada', () => {
    const result = formatDateTime('2026-01-15T10:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatClock', () => {
  it('enseña minutos y segundos por debajo de una hora', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65_000)).toBe('01:05')
  })

  it('añade las horas cuando pasa de sesenta minutos', () => {
    expect(formatClock(3_600_000)).toBe('01:00:00')
    expect(formatClock(5_025_000)).toBe('01:23:45')
  })

  it('no se va a negativo', () => {
    expect(formatClock(-5000)).toBe('00:00')
  })
})

describe('formatDuration', () => {
  it('describe la duración en lenguaje llano', () => {
    expect(formatDuration(30_000)).toBe('menos de 1 min')
    expect(formatDuration(45 * 60_000)).toBe('45 min')
    expect(formatDuration(2 * 3_600_000)).toBe('2 h')
    expect(formatDuration(2 * 3_600_000 + 15 * 60_000)).toBe('2 h 15 min')
  })
})

describe('entryDuration', () => {
  it('mide lo que ha durado un registro cerrado', () => {
    const ms = entryDuration('2026-01-15T08:00:00.000Z', '2026-01-15T10:30:00.000Z')
    expect(ms).toBe(2.5 * 3_600_000)
    expect(formatDuration(ms)).toBe('2 h 30 min')
  })
})

describe('daysFromToday', () => {
  const hoy = new Date('2026-01-15T12:00:00.000Z')

  it('cuenta días naturales hacia delante y hacia atrás', () => {
    expect(daysFromToday('2026-01-15T23:00:00.000Z', hoy)).toBe(0)
    expect(daysFromToday('2026-01-16T01:00:00.000Z', hoy)).toBe(1)
    expect(daysFromToday('2026-01-10T01:00:00.000Z', hoy)).toBe(-5)
  })
})

describe('dueState', () => {
  const hoy = new Date('2026-01-15T12:00:00.000Z')

  it('clasifica la fecha límite para poder colorearla', () => {
    expect(dueState('2026-01-14', hoy)).toBe('vencida')
    expect(dueState('2026-01-15', hoy)).toBe('hoy')
    expect(dueState('2026-01-17', hoy)).toBe('pronto')
    expect(dueState('2026-02-01', hoy)).toBe('lejos')
  })
})

describe('formatDayLabel', () => {
  const hoy = new Date('2026-01-15T12:00:00.000Z')

  it('usa palabras para los días cercanos', () => {
    expect(formatDayLabel('2026-01-15T09:00:00.000Z', hoy)).toBe('Hoy')
    expect(formatDayLabel('2026-01-16T09:00:00.000Z', hoy)).toBe('Mañana')
    expect(formatDayLabel('2026-01-14T09:00:00.000Z', hoy)).toBe('Ayer')
  })

  it('para los lejanos da una fecha corta', () => {
    const label = formatDayLabel('2026-03-02T09:00:00.000Z', hoy)
    expect(label).not.toBe('Hoy')
    expect(label.length).toBeGreaterThan(0)
  })
})

describe('formatRelative', () => {
  const ahora = new Date('2026-01-15T12:00:00.000Z')

  it('describe hace cuánto pasó algo', () => {
    expect(formatRelative('2026-01-15T11:59:40.000Z', ahora)).toBe('ahora mismo')
    expect(formatRelative('2026-01-15T11:45:00.000Z', ahora)).toBe('hace 15 min')
    expect(formatRelative('2026-01-15T09:00:00.000Z', ahora)).toBe('hace 3 h')
    expect(formatRelative('2026-01-14T09:00:00.000Z', ahora)).toBe('ayer')
    expect(formatRelative('2026-01-10T12:00:00.000Z', ahora)).toBe('hace 5 días')
  })
})

describe('monthKey', () => {
  it('da una clave estable para agrupar por mes', () => {
    expect(monthKey('2026-01-15T10:00:00.000Z')).toMatch(/^\d{4}-\d{2}$/)
    expect(monthKey('2026-01-05T10:00:00.000Z')).toBe(
      monthKey('2026-01-28T10:00:00.000Z'),
    )
  })
})

describe('initials', () => {
  it('saca las iniciales de un nombre completo', () => {
    expect(initials('Fran Ruiz')).toBe('FR')
    expect(initials('maria del mar lopez')).toBe('MD')
  })

  it('se apaña con un email si no hay nombre', () => {
    expect(initials('ana@hostelinox.com')).toBe('AN')
    expect(initials('juan.perez@hostelinox.com')).toBe('JP')
  })

  it('no revienta si no hay nada', () => {
    expect(initials('')).toBe('?')
  })
})
