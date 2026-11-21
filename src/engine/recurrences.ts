import { addDays, addMonths, addYears, getDaysInMonth, parseISO, format } from 'date-fns'
import type { RecurrenceFreq } from '@/domain/types'

/** Molde de transação guardado em `recurrences.template` (jsonb). */
export interface RecurrenceTemplate {
  tipo: 'RECEITA' | 'DESPESA'
  account_id: string
  category_id: string
  valor_centavos: number
  descricao: string
  pago?: boolean
}

function withDay(base: Date, day: number): Date {
  const dd = Math.min(day, getDaysInMonth(base))
  return new Date(base.getFullYear(), base.getMonth(), dd)
}

/** Próxima data de uma recorrência a partir de uma data. */
export function advanceDate(
  dateISO: string,
  freq: RecurrenceFreq,
  dia: number,
): string {
  const d = parseISO(dateISO)
  if (freq === 'semanal') return format(addDays(d, 7), 'yyyy-MM-dd')
  if (freq === 'anual') return format(addYears(d, 1), 'yyyy-MM-dd')
  // mensal: mesmo dia do mês (com clamp para meses curtos)
  return format(withDay(addMonths(d, 1), dia), 'yyyy-MM-dd')
}

export interface DueResult {
  /** Datas que deveriam ter sido geradas (inclui atrasadas) até hoje. */
  dates: string[]
  /** Nova próxima data (a primeira ainda no futuro). */
  novaProxima: string
}

/** Ocorrências devidas de uma recorrência entre `proximaData` e hoje. */
export function dueOccurrences(
  proximaData: string,
  freq: RecurrenceFreq,
  dia: number,
  todayISO: string,
): DueResult {
  const dates: string[] = []
  let cur = proximaData
  let guard = 0
  while (cur <= todayISO && guard < 500) {
    dates.push(cur)
    cur = advanceDate(cur, freq, dia)
    guard++
  }
  return { dates, novaProxima: cur }
}
