/** Utilidades de período. `MesRef` é sempre 'YYYY-MM'. */
export type MesRef = string

/** Extrai o mês de referência de uma data ISO ('YYYY-MM-DD' -> 'YYYY-MM'). */
export function mesRefOf(dateISO: string): MesRef {
  return dateISO.slice(0, 7)
}

/** Uma data ISO pertence ao mês? (comparação por string, sem fuso). */
export function isInMonth(dateISO: string, mes: MesRef): boolean {
  return dateISO.slice(0, 7) === mes
}

/** Mês de referência atual. */
export function currentMesRef(d: Date = new Date()): MesRef {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Rótulo amigável de um mês ('2026-07' -> 'jul/2026'). */
export function mesRefLabel(mes: MesRef): string {
  const [y, m] = mes.split('-').map(Number)
  const meses = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
  ]
  return `${meses[(m ?? 1) - 1]}/${y}`
}
