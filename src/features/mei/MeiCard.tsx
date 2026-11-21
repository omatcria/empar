import type { ReactElement } from 'react'
import { Surface } from '@/components/ui/primitives'
import { AlertTriangle, Info, ShieldAlert } from '@/components/icons'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/cn'
import { useMei } from './useMei'
import { NIVEL_BAR, NIVEL_LABEL, NIVEL_TEXT } from './meiUi'

const MARCAS = [70, 90, 100]
// Escala da barra: até 120% (tolerância) para mostrar o excesso.
const ESCALA = 120

export function MeiCard(): ReactElement | null {
  const { ativo, year, limite, realizado, previsto, status, projecao, mensagem } = useMei()
  if (!ativo) return null

  const Icon = status.nivel === 'ok' ? Info : status.nivel === 'atencao' ? AlertTriangle : ShieldAlert
  const fill = Math.min(ESCALA, status.pct)

  return (
    <Surface className="col-span-full p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-empresarial">
            Limite do MEI · {year}
          </p>
          <p className="mt-1 text-2xl font-semibold text-app-fg">
            {formatBRL(realizado)}{' '}
            <span className="text-sm font-normal text-app-muted">de {formatBRL(limite)}</span>
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-app-surface-2 px-2.5 py-0.5 text-xs font-medium',
            NIVEL_TEXT[status.nivel],
          )}
        >
          <Icon className="size-3.5" />
          {NIVEL_LABEL[status.nivel]} · {status.pct.toFixed(1).replace('.', ',')}%
        </span>
      </div>

      <div className="relative mt-4 h-2.5 w-full rounded-full bg-app-surface-2">
        <div
          className={cn('h-full rounded-full transition-all', NIVEL_BAR[status.nivel])}
          style={{ width: `${(fill / ESCALA) * 100}%` }}
        />
        {MARCAS.map((m) => (
          <span
            key={m}
            className="absolute top-[-3px] h-4 w-px bg-app-muted/60"
            style={{ left: `${(m / ESCALA) * 100}%` }}
            title={`${m}%`}
          />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-app-muted">
        {MARCAS.map((m) => (
          <span
            key={m}
            className="absolute -translate-x-1/2"
            style={{ left: `${(m / ESCALA) * 100}%` }}
          >
            {m}%
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <Stat label="Restante até o teto" value={formatBRL(status.restante)} />
        <Stat label="Previsto no ano" value={formatBRL(previsto)} />
        <Stat
          label="Ritmo anual projetado"
          value={formatBRL(projecao.ritmoAnual)}
          hint={
            projecao.mesesRestantes > 0
              ? `${formatBRL(projecao.mediaMensalDisponivel)}/mês disponíveis`
              : undefined
          }
        />
      </div>

      <div className="mt-4 rounded-xl bg-empresarial-soft p-3">
        <p className={cn('text-sm font-semibold', NIVEL_TEXT[status.nivel])}>{mensagem.titulo}</p>
        <p className="mt-1 text-sm text-app-fg2">{mensagem.texto}</p>
        <p className="mt-1 text-sm text-app-fg2">
          <span className="font-medium">O que fazer:</span> {mensagem.acao}
        </p>
      </div>
    </Surface>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-app-muted">{label}</p>
      <p className="font-medium text-app-fg">{value}</p>
      {hint && <p className="text-xs text-app-muted">{hint}</p>}
    </div>
  )
}
