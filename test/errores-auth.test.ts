import { describe, expect, it } from 'vitest'
import { mensajeDeAuth } from '../src/lib/errores-auth'

// Los textos son los que manda Supabase de verdad, copiados tal cual.

describe('mensajeDeAuth', () => {
  it('traduce la contraseña repetida, que es la que más se ve', () => {
    const err = { code: 'same_password', message: 'New password should be different from the old password.' }
    expect(mensajeDeAuth(err)).toBe('La contraseña nueva tiene que ser distinta de la que usas ahora.')
  })

  it('la traduce también cuando llega sin código', () => {
    const err = { message: 'New password should be different from the old password.' }
    expect(mensajeDeAuth(err)).toBe('La contraseña nueva tiene que ser distinta de la que usas ahora.')
  })

  it('traduce el correo o la contraseña equivocados al entrar', () => {
    expect(mensajeDeAuth({ message: 'Invalid login credentials' })).toBe(
      'El correo o la contraseña no son correctos.',
    )
  })

  it('dice cuántos caracteres pide cuando la contraseña es corta', () => {
    expect(mensajeDeAuth({ message: 'Password should be at least 6 characters.' })).toBe(
      'La contraseña tiene que tener al menos 6 caracteres.',
    )
  })

  it('avisa de la contraseña fácil de adivinar', () => {
    const err = { code: 'weak_password', message: 'Password is known to be weak and easy to guess, please choose a different one.' }
    expect(mensajeDeAuth(err)).toMatch(/fácil de adivinar/)
  })

  it('traduce la sesión perdida', () => {
    expect(mensajeDeAuth({ message: 'Auth session missing!' })).toMatch(/Vuelve a entrar/)
  })

  it('traduce el aviso de demasiados intentos', () => {
    expect(mensajeDeAuth({ message: 'For security purposes, you can only request this after 51 seconds.' })).toMatch(
      /Espera un momento/,
    )
  })

  it('traduce la falta de conexión', () => {
    expect(mensajeDeAuth(new TypeError('Failed to fetch'))).toMatch(/No hay conexión/)
  })

  it('ninguna traducción está en inglés', () => {
    const casos = [
      { code: 'same_password' },
      { message: 'Invalid login credentials' },
      { message: 'Email not confirmed' },
      { message: 'User not found' },
      { message: 'Password should be at least 8 characters.' },
    ]
    for (const c of casos) {
      expect(mensajeDeAuth(c)).not.toMatch(/password|should|invalid|credentials|email|user/i)
    }
  })

  it('lo que no sabe traducir lo enseña, pero avisando de qué iba', () => {
    const salida = mensajeDeAuth({ message: 'Something odd happened' }, 'No se pudo cambiar la contraseña.')
    expect(salida).toContain('No se pudo cambiar la contraseña.')
    expect(salida).toContain('Something odd happened')
  })

  it('sin error y sin texto, se queda con la frase de siempre', () => {
    expect(mensajeDeAuth(null, 'No se pudo entrar.')).toBe('No se pudo entrar.')
    expect(mensajeDeAuth({ message: '   ' }, 'No se pudo entrar.')).toBe('No se pudo entrar.')
  })
})
