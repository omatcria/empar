import type { ReactElement } from 'react'
import type { Context, TxType } from '@/domain/types'
import type { Cents } from '@/lib/money'
import { AlertTriangle, Info, ShieldAlert } from '@/components/icons'
import { cn } from '@/lib/cn'
import { meiImpact } from '@/engine/mei'
import { useMei } from './useMei'
import { NIVEL_LABEL, NIVEL_TEXT } from './meiUi'

export interface MeiImpactAlertProps {
  contexto: Context
  tipo: TxType
  valorCentavos: Cents
  data: string
  editingValorCentavos?: Cents
}

export function MeiImpactAlert({
  contexto,
  tipo,
  valorCentavos,
  data,
  editingValorCentavos,
}: MeiImpactAlertProps): ReactElement | null {
  const { ativo, year, limite, realizado } = useMei()
  if (!ativo || contexto !== 'EMPRESARIAL' || tipo !== 'RECEITA' || valorCentavos <= 0) return null
  // Só conta se o lançamento cai no ano-calendário monitorado.
  if (!data.startsWith(`${year}-`)) return null

  const { depois, subiuNivel } = meiImpact(realizado, limite, valorCentavos, editingValorCentavos ?? 0)
  if (depois.pct < 70 && !subiuNivel) return null

  const Icon = depois.nivel === 'atencao' ? AlertTriangle : depois.nivel === 'ok' ? Info : ShieldAlert
  const pct = depois.pct.toFixed(1).replace('.', ',')
  const acima = depois.nivel === 'excedido' || depois.nivel === 'desenquadrado'
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-xl border border-app-border bg-app-surface-2 p-3 text-xs',
        NIVEL_TEXT[depois.nivel],
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="text-app-fg2">
        <span className="font-semibold">{NIVEL_LABEL[depois.nivel]} no MEI.</span> Com este
        lançamento o faturamento de {year} chega a {pct}% do limite
        {acima ? ', acima do teto anual.' : '.'}
      </p>
    </div>
  )
}
