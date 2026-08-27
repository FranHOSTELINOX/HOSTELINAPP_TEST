// Los errores de sesión de Supabase vienen en inglés y de su servidor, así
// que no se pueden traducir allí. Aquí se cambian por una frase en español
// que diga qué ha pasado y, si se puede, qué hacer.
//
// Se mira primero el `code` (lo que Supabase promete que no cambia) y solo
// después el texto, por si el `code` no viene. Lo que no esté en la lista se
// devuelve tal cual, precedido de un aviso: es preferible un mensaje raro en
// inglés a tragarse el error y dejar a la persona sin saber nada.
//
// Se traduce en UN solo sitio, en stores/auth.ts, justo donde Supabase
// contesta. Las vistas ya reciben la frase en español y solo la enseñan; si
// además la pasaran por aquí, la traducción entraría por el caso de "no sé
// qué es esto" y saldría entre paréntesis detrás del texto por defecto.

interface ErrorDeAuth {
  code?: string
  message?: string
}

/** Los mensajes que manda Supabase, por su código de error. */
const POR_CODIGO: Record<string, string> = {
  same_password: 'La contraseña nueva tiene que ser distinta de la que usas ahora.',
  weak_password: 'Esa contraseña es fácil de adivinar. Prueba con otra más larga o con números y símbolos.',
  invalid_credentials: 'El correo o la contraseña no son correctos.',
  email_not_confirmed: 'Esa cuenta todavía no está confirmada. Díselo a un administrador.',
  user_not_found: 'No hay ninguna cuenta con ese correo.',
  session_not_found: 'Se ha cerrado la sesión. Vuelve a entrar y prueba otra vez.',
  over_request_rate_limit: 'Has probado muchas veces seguidas. Espera un momento y vuelve a intentarlo.',
  same_email: 'El correo nuevo tiene que ser distinto del que ya tienes.',
}

/** Y lo mismo por el texto, para cuando el error llega sin código. */
const POR_TEXTO: { busca: RegExp; dice: string }[] = [
  { busca: /different from the old password/i, dice: POR_CODIGO.same_password },
  { busca: /password.*(weak|easy to guess|pwned)/i, dice: POR_CODIGO.weak_password },
  {
    busca: /password should be at least (\d+)/i,
    dice: 'La contraseña es demasiado corta.',
  },
  { busca: /invalid login credentials/i, dice: POR_CODIGO.invalid_credentials },
  { busca: /email not confirmed/i, dice: POR_CODIGO.email_not_confirmed },
  { busca: /user not found/i, dice: POR_CODIGO.user_not_found },
  { busca: /auth session missing|session (not found|expired)/i, dice: POR_CODIGO.session_not_found },
  { busca: /for security purposes|rate limit|too many requests/i, dice: POR_CODIGO.over_request_rate_limit },
  { busca: /failed to fetch|network ?error/i, dice: 'No hay conexión. Comprueba internet y prueba otra vez.' },
]

/**
 * La frase en español que le toca a un error de sesión de Supabase.
 * `porDefecto` es lo que se dice cuando el error no trae ni código ni texto.
 */
export function mensajeDeAuth(err: unknown, porDefecto = 'No se pudo completar la operación.'): string {
  if (!err) return porDefecto

  const e = err as ErrorDeAuth
  if (e.code && POR_CODIGO[e.code]) return POR_CODIGO[e.code]

  const texto = typeof e.message === 'string' ? e.message.trim() : ''
  if (!texto) return porDefecto

  // "Password should be at least 8 characters" lleva el número dentro, así
  // que ese se arma aparte para poder decirlo.
  const corta = texto.match(/password should be at least (\d+)/i)
  if (corta) return `La contraseña tiene que tener al menos ${corta[1]} caracteres.`

  for (const { busca, dice } of POR_TEXTO) {
    if (busca.test(texto)) return dice
  }

  return `${porDefecto} (${texto})`
}
