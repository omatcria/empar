import type { ReactElement } from 'react'
import type { Context, TxType } from '@/domain/types'
import type { Cents } from '@/lib/money'

export interface MeiImpactAlertProps {
  contexto: Context
  tipo: TxType
  valorCentavos: Cents
  data: string
  editingValorCentavos?: Cents
}

export function MeiImpactAlert(_props: MeiImpactAlertProps): ReactElement | null {
  return null
}
