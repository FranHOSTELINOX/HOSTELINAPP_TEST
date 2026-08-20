// Utilidades de formato compartidas por las vistas.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES')
}
