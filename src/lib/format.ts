// Utilidades de formato compartidas por las vistas.
// Todo en español y con la forma en que se escriben las fechas en España.

const LOCALE = 'es-ES'

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE)
}

/** "15 ene 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "10:30" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "enero de 2026", para agrupar listas por mes. */
export function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

/** Clave estable "2026-01" para agrupar por mes sin depender del idioma. */
export function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Diferencia en días naturales entre una fecha y hoy (negativo = pasado). */
export function daysFromToday(iso: string, now: Date = new Date()): number {
  const target = new Date(iso)
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86_400_000)
}

/** "Hoy", "Mañana", "Ayer" o "lun, 15 ene" según lo cerca que quede. */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const diff = daysFromToday(iso, now)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  return new Date(iso).toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * En qué punto está una fecha límite, para poder pintarla de un color u otro:
 * vencida, hoy, pronto (dentro de 3 días) o más adelante.
 */
export type DueState = 'vencida' | 'hoy' | 'pronto' | 'lejos'

export function dueState(iso: string, now: Date = new Date()): DueState {
  const diff = daysFromToday(iso, now)
  if (diff < 0) return 'vencida'
  if (diff === 0) return 'hoy'
  if (diff <= 3) return 'pronto'
  return 'lejos'
}

/** Cronómetro "01:23:45" (o "12:03" si no llega a la hora). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Duración en lenguaje llano: "2 h 15 min", "45 min", "menos de 1 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return 'menos de 1 min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Milisegundos trabajados en un registro ya cerrado. */
export function entryDuration(startedAt: string, endedAt: string): number {
  return new Date(endedAt).getTime() - new Date(startedAt).getTime()
}

/** "hace 5 min", "hace 3 días", "ahora mismo". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(months / 12)
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`
}

/** Iniciales para el avatar: "Fran Ruiz" → "FR", "ana@x.com" → "AN". */
export function initials(nameOrEmail: string): string {
  const name = (nameOrEmail || '').trim()
  if (!name) return '?'
  const local = name.includes('@') ? name.split('@')[0] : name
  const parts = local.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
