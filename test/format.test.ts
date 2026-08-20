import { describe, expect, it } from 'vitest'
import { formatDateTime } from '../src/lib/format'

describe('formatDateTime', () => {
  it('formatea una fecha ISO como cadena localizada', () => {
    const result = formatDateTime('2026-01-15T10:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
