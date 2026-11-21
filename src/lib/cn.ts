/** Concatena classes condicionais (helper mínimo tipo clsx). */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(' ')
}

/** Gera um UUID v4 (browser/node). */
export function uid(): string {
  return crypto.randomUUID()
}

/** Data de hoje em 'YYYY-MM-DD' (local). */
export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
