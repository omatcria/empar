import { useMemo } from 'react'
import { useData } from '@/store/data'
import { useActiveWorkspace } from '@/store/workspace'
import { todayISO } from '@/lib/cn'
import type { Cents } from '@/lib/money'
import {
  meiLimit,
  meiMessage,
  meiProjection,
  meiRevenue,
  meiStatus,
  type MeiStatus,
} from '@/engine/mei'

export interface MeiInfo {
  ativo: boolean
  year: number
  limite: Cents
  realizado: Cents
  previsto: Cents
  status: MeiStatus
  projecao: ReturnType<typeof meiProjection>
  mensagem: ReturnType<typeof meiMessage>
}

export function useMei(): MeiInfo {
  const ws = useActiveWorkspace()
  const transactions = useData((s) => s.transactions)
  const categories = useData((s) => s.categories)
  const hoje = todayISO()
  const ativo = !!ws?.mei_ativo
  const anual = ws?.mei_limite_anual_centavos ?? 8_100_000
  const abertura = ws?.mei_abertura ?? null

  return useMemo(() => {
    const year = Number(hoje.slice(0, 4))
    const { realizado, previsto } = meiRevenue(transactions, categories, year)
    const limite = meiLimit(anual, abertura, year)
    const status = meiStatus(realizado, limite)
    return {
      ativo,
      year,
      limite,
      realizado,
      previsto,
      status,
      projecao: meiProjection(realizado, limite, hoje),
      mensagem: meiMessage(status, year),
    }
  }, [transactions, categories, hoje, anual, abertura, ativo])
}
