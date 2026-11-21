import { beforeEach, describe, expect, it, vi } from 'vitest'

const {rpc, from} = vi.hoisted(() => ({rpc:vi.fn(), from:vi.fn()}))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }))
vi.mock('../owner', () => ({ ownerCols: () => ({ user_id: 'u', workspace_id: 'w' }) }))
import { useDebts } from '../debts'
import type { Debt, DebtInstallment } from '@/domain/types'

const debt = { id: 'd', workspace_id: 'w', valor_acordo_centavos: 10000 } as Debt
const old = { id: 'old', debt_id: 'd', numero: 1, valor_centavos: 10000, pago: false } as DebtInstallment

beforeEach(() => {
  rpc.mockReset()
  useDebts.setState({ debts: [debt], installments: [old] })
})

describe('regenerateUnpaid', () => {
  it('mantém as parcelas quando a operação transacional falha', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('falha') })
    await expect(useDebts.getState().regenerateUnpaid('d', 2, '2026-01-31')).rejects.toThrow('falha')
    expect(useDebts.getState().installments).toEqual([old])
  })
  it('substitui o estado pelas parcelas retornadas pelo banco', async () => {
    const replacement = { ...old, id: 'new' }
    rpc.mockResolvedValue({ data: [replacement], error: null })
    await useDebts.getState().regenerateUnpaid('d', 2, '2026-01-31')
    expect(useDebts.getState().installments).toEqual([replacement])
  })
})

it('avisa quando não é possível desfazer dívida criada sem parcelas', async () => {
  from.mockReset()
  from.mockReturnValueOnce({insert:()=>({select:()=>({single:async()=>({data:debt,error:null})})})})
  from.mockReturnValueOnce({insert:()=>({select:async()=>({data:null,error:new Error('falha parcelas')})})})
  from.mockReturnValueOnce({delete:()=>({eq:async()=>({error:new Error('falha exclusão')})})})
  await expect(useDebts.getState().addDebt({credor:'Teste',valor_acordo_centavos:10000,parcelas:2,primeiro_vencimento:'2026-01-01'})).rejects.toThrow(/criada.*parcelas/i)
})

it('ignora respostas antigas ao trocar de espaço', async () => {
  const pending: Array<(v: unknown)=>void> = []
  from.mockReset().mockImplementation(() => ({select:()=>({eq:()=>new Promise(resolve=>pending.push(resolve))})}))
  const first=useDebts.getState().load('antigo')
  const second=useDebts.getState().load('novo')
  pending[2]({data:[{...debt,id:'novo'}],error:null});pending[3]({data:[],error:null}); await second
  pending[0]({data:[{...debt,id:'antigo'}],error:null});pending[1]({data:[],error:null}); await first
  expect(useDebts.getState().debts.map(d=>d.id)).toEqual(['novo'])
})
