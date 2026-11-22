import { Building2, User } from '@/components/icons'
import { Surface } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import type { Cents } from '@/lib/money'

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function ForecastCard({
  valor,
  horizonte,
  pessoal,
  empresarial,
}: {
  valor: Cents
  horizonte: string
  pessoal?: Cents
  empresarial?: Cents
}) {
  return (
    <Surface className="p-6">
      <p className="text-sm text-app-muted">Saldo previsto</p>
      <Money cents={valor} signed className="mt-1 block text-3xl font-bold text-app-fg" />
      <p className="mt-1 text-xs text-app-muted">
        Até {ddmm(horizonte)} · inclui a receber, a pagar e faturas
      </p>
      {pessoal != null && empresarial != null && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <User className="size-4 text-pessoal-strong" />
            <span className="text-app-muted">Pessoal</span>
            <Money cents={pessoal} signed className="font-semibold text-app-fg" />
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="size-4 text-empresarial-strong" />
            <span className="text-app-muted">Empresarial</span>
            <Money cents={empresarial} signed className="font-semibold text-app-fg" />
          </span>
        </div>
      )}
    </Surface>
  )
}
