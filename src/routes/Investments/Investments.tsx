import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Pencil, PiggyBank, Plus, Trash2, TrendingUp } from '@/components/icons'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import { investedPrincipal, investmentValue, investmentReturn } from '@/engine'
import type {
  Account,
  Context,
  Investment,
  InvestmentForma,
  InvestmentTipo,
  MovimentoTipo,
} from '@/domain/types'
import { CONTEXT_LABEL } from '@/domain/enums'
import { Button, Surface } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { BankBadge, BankPicker, bankById, colorChoices } from '@/domain/banks'
import { PALETTE } from '@/domain/palette'
import { formatBRL } from '@/lib/money'
import { todayISO } from '@/lib/cn'

const TIPO_LABEL: Record<InvestmentTipo, string> = {
  CDB: 'CDB',
  TESOURO: 'Tesouro Direto',
  LCI_LCA: 'LCI / LCA',
  ACOES: 'Ações',
  FUNDO: 'Fundo',
  CRIPTO: 'Cripto',
  POUPANCA: 'Poupança',
  OUTRO: 'Outro',
}

const FORMA_LABEL: Record<InvestmentForma, string> = {
  CDI_PERCENT: '% do CDI',
  PREFIXADO: 'Prefixado (% a.a.)',
  CDI_SPREAD: 'CDI + spread (% a.a.)',
  NENHUM: 'Sem rendimento automático',
}

function rendimentoDesc(forma: string, taxa: number): string {
  switch (forma) {
    case 'CDI_PERCENT':
      return `${taxa}% do CDI`
    case 'PREFIXADO':
      return `${taxa}% a.a.`
    case 'CDI_SPREAD':
      return `CDI + ${taxa}% a.a.`
    default:
      return 'Valor manual'
  }
}

export function Investments() {
  const { investments, investmentMovements, profile } = useData()
  const { viewMode } = useUI()
  const canWrite = useCanWrite()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [movendo, setMovendo] = useState<{ inv: Investment; tipo: MovimentoTipo } | null>(null)

  const cdi = profile?.cdi_anual ?? 10.5
  const hoje = todayISO()

  const visiveis = useMemo(
    () =>
      investments.filter(
        (i) => !i.arquivado && (viewMode === 'CONSOLIDADO' || i.contexto === viewMode),
      ),
    [investments, viewMode],
  )

  const movsByInv = useMemo(() => {
    const map = new Map<string, typeof investmentMovements>()
    for (const m of investmentMovements) {
      const arr = map.get(m.investment_id) ?? []
      arr.push(m)
      map.set(m.investment_id, arr)
    }
    return map
  }, [investmentMovements])

  const totais = useMemo(() => {
    let aplicado = 0
    let patrimonio = 0
    for (const inv of visiveis) {
      const movs = movsByInv.get(inv.id) ?? []
      aplicado += investedPrincipal(movs)
      patrimonio += investmentValue(inv, movs, cdi, hoje)
    }
    return { aplicado, patrimonio, rendimento: patrimonio - aplicado }
  }, [visiveis, movsByInv, cdi, hoje])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Investimentos</h1>
          <p className="text-sm text-app-muted">
            Onde seu dinheiro está rendendo · CDI {cdi}% a.a.
          </p>
        </div>
        {canWrite && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            <span className="hidden sm:inline">Novo investimento</span>
          </Button>
        )}
      </div>

      {/* Totais */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Surface className="p-4">
          <p className="text-xs text-app-muted">Total aplicado</p>
          <Money cents={totais.aplicado} className="text-lg font-bold text-app-fg" />
        </Surface>
        <Surface className="p-4">
          <p className="text-xs text-app-muted">Rendimento estimado</p>
          <Money cents={totais.rendimento} className="text-lg font-bold text-income" showSign />
        </Surface>
        <Surface className="p-4">
          <p className="text-xs text-app-muted">Patrimônio</p>
          <Money cents={totais.patrimonio} className="text-lg font-bold text-app-fg" />
        </Surface>
      </div>

      {visiveis.length === 0 ? (
        <Surface className="p-10 text-center">
          <TrendingUp className="mx-auto mb-3 size-8 text-app-muted" />
          <p className="text-sm text-app-muted">
            Nenhum investimento ainda. Cadastre onde você aplica seu dinheiro.
          </p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {visiveis.map((inv) => {
            const movs = movsByInv.get(inv.id) ?? []
            const principal = investedPrincipal(movs)
            const valor = investmentValue(inv, movs, cdi, hoje)
            const rend = investmentReturn(inv, movs, cdi, hoje)
            const pct = principal > 0 ? (rend / principal) * 100 : 0
            const isOpen = expanded === inv.id
            return (
              <Surface key={inv.id} className="overflow-hidden p-0">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return
                    setExpanded((v) => (v === inv.id ? null : inv.id))
                  }}
                >
                  {inv.banco ? (
                    <BankBadge id={inv.banco} className="size-9 text-xs" />
                  ) : (
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${inv.cor ?? '#8a8aa3'}22`, color: inv.cor ?? '#8a8aa3' }}
                    >
                      <PiggyBank className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-app-fg">{inv.nome}</p>
                      {viewMode === 'CONSOLIDADO' && <ContextBadge contexto={inv.contexto} iconOnly />}
                    </div>
                    <p className="truncate text-xs text-app-muted">
                      {TIPO_LABEL[inv.tipo as InvestmentTipo] ?? inv.tipo} · {rendimentoDesc(inv.forma_rendimento, inv.taxa)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money cents={valor} className="text-sm font-semibold text-app-fg" />
                    <p className={'text-xs ' + (rend >= 0 ? 'text-income' : 'text-expense')}>
                      {rend >= 0 ? '+' : ''}
                      {formatBRL(rend)} ({pct >= 0 ? '+' : ''}
                      {pct.toFixed(1)}%)
                    </p>
                  </div>
                  <button className="grid size-8 place-items-center rounded-lg text-app-muted hover:text-app-fg cursor-pointer">
                    {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-app-border bg-app-surface-2/40 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-app-muted">
                      <span>
                        Aplicado {formatBRL(principal)}
                        {inv.vencimento ? ` · vence ${format(parseISO(inv.vencimento), 'dd/MM/yyyy')}` : ''}
                      </span>
                      {canWrite && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" icon={<ArrowUpRight className="size-3.5" />} onClick={() => setMovendo({ inv, tipo: 'aporte' })}>
                            Aportar
                          </Button>
                          <Button size="sm" variant="secondary" icon={<ArrowDownLeft className="size-3.5" />} onClick={() => setMovendo({ inv, tipo: 'resgate' })}>
                            Resgatar
                          </Button>
                          <button
                            aria-label="Editar investimento"
                            onClick={() => setEditing(inv)}
                            className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-app-surface hover:text-app-fg cursor-pointer"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <MovementsList investmentId={inv.id} canWrite={canWrite} />
                  </div>
                )}
              </Surface>
            )
          })}
        </div>
      )}

      <p className="text-xs text-app-muted">
        O valor estimado usa a taxa CDI de Configurações e capitaliza cada aporte/resgate.
        É uma estimativa — não substitui o extrato da corretora.
      </p>

      <InvestmentFormModal open={creating} onClose={() => setCreating(false)} />
      <InvestmentFormModal open={!!editing} investment={editing ?? undefined} onClose={() => setEditing(null)} />
      {movendo && (
        <MovementModal
          investment={movendo.inv}
          tipo={movendo.tipo}
          onClose={() => setMovendo(null)}
        />
      )}
    </div>
  )
}

/* ---------------- Lista de movimentos ---------------- */
function MovementsList({ investmentId, canWrite }: { investmentId: string; canWrite: boolean }) {
  const { investmentMovements, accounts, deleteMovement } = useData()
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const movs = investmentMovements
    .filter((m) => m.investment_id === investmentId)
    .sort((a, b) => b.data.localeCompare(a.data))

  if (movs.length === 0) {
    return <p className="text-xs text-app-muted">Nenhum aporte ainda. Use “Aportar”.</p>
  }

  return (
    <div className="divide-y divide-app-border rounded-xl border border-app-border bg-app-surface">
      {movs.map((m) => {
        const aporte = m.tipo === 'aporte'
        const conta = m.account_id ? accById.get(m.account_id) : undefined
        return (
          <div key={m.id} className="flex items-center gap-3 px-3 py-2">
            <span
              className={
                'grid size-7 shrink-0 place-items-center rounded-lg ' +
                (aporte ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense')
              }
            >
              {aporte ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-app-fg">{aporte ? 'Aporte' : 'Resgate'}</p>
              <p className="text-xs text-app-muted">
                {format(parseISO(m.data), "dd 'de' MMM yyyy", { locale: ptBR })}
                {conta ? ` · ${conta.nome}` : ''}
              </p>
            </div>
            <Money cents={m.valor_centavos} tipo={aporte ? 'RECEITA' : 'DESPESA'} className="text-sm font-medium" showSign />
            {canWrite && (
              <button
                aria-label="Excluir movimento"
                onClick={() => deleteMovement(m.id)}
                className="grid size-7 place-items-center rounded-lg text-app-muted hover:bg-expense/10 hover:text-expense cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Modal criar/editar investimento ---------------- */
function InvestmentFormModal({
  open,
  onClose,
  investment,
}: {
  open: boolean
  onClose: () => void
  investment?: Investment
}) {
  const { addInvestment, updateInvestment, deleteInvestment } = useData()
  const { viewMode } = useUI()
  const isEdit = !!investment
  const ctxInicial: Context =
    investment?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL')

  const [nome, setNome] = useState('')
  const [contexto, setContexto] = useState<Context>(ctxInicial)
  const [tipo, setTipo] = useState<InvestmentTipo>('CDB')
  const [forma, setForma] = useState<InvestmentForma>('CDI_PERCENT')
  const [taxa, setTaxa] = useState(100)
  const [dataInicio, setDataInicio] = useState(todayISO())
  const [vencimento, setVencimento] = useState('')
  const [banco, setBanco] = useState<string | null>(null)
  const [cor, setCor] = useState<string>(PALETTE[2])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNome(investment?.nome ?? '')
    setContexto(investment?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL'))
    setTipo((investment?.tipo as InvestmentTipo) ?? 'CDB')
    setForma((investment?.forma_rendimento as InvestmentForma) ?? 'CDI_PERCENT')
    setTaxa(investment?.taxa ?? 100)
    setDataInicio(investment?.data_inicio ?? todayISO())
    setVencimento(investment?.vencimento ?? '')
    setBanco(investment?.banco ?? null)
    setCor(investment?.cor ?? PALETTE[2])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investment])

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        tipo,
        forma_rendimento: forma,
        taxa: forma === 'NENHUM' ? 0 : taxa,
        data_inicio: dataInicio,
        vencimento: vencimento || null,
        banco,
        cor,
      }
      if (isEdit) await updateInvestment(investment.id, payload)
      else await addInvestment({ ...payload, contexto })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar investimento' : 'Novo investimento'}
      footer={
        <>
          {isEdit && (
            <Button
              variant="ghost"
              className="mr-auto text-expense"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                setSaving(true)
                await deleteInvestment(investment.id)
                setSaving(false)
                onClose()
              }}
            >
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={!nome.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="inv-nome" required>
          <TextInput
            id="inv-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: CDB Inter 110% CDI"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contexto" htmlFor="inv-ctx" hint={isEdit ? 'Fixo' : undefined}>
            <Select id="inv-ctx" value={contexto} disabled={isEdit} onChange={(e) => setContexto(e.target.value as Context)}>
              <option value="PESSOAL">{CONTEXT_LABEL.PESSOAL}</option>
              <option value="EMPRESARIAL">{CONTEXT_LABEL.EMPRESARIAL}</option>
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="inv-tipo">
            <Select id="inv-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as InvestmentTipo)}>
              {(Object.keys(TIPO_LABEL) as InvestmentTipo[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rendimento" htmlFor="inv-forma">
            <Select id="inv-forma" value={forma} onChange={(e) => setForma(e.target.value as InvestmentForma)}>
              {(Object.keys(FORMA_LABEL) as InvestmentForma[]).map((f) => (
                <option key={f} value={f}>
                  {FORMA_LABEL[f]}
                </option>
              ))}
            </Select>
          </Field>
          {forma !== 'NENHUM' && (
            <Field label="Taxa (%)" htmlFor="inv-taxa" hint={rendimentoDesc(forma, taxa)}>
              <TextInput
                id="inv-taxa"
                type="number"
                step="0.1"
                min={0}
                value={taxa}
                onChange={(e) => setTaxa(Number(e.target.value))}
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de aplicação" htmlFor="inv-ini">
            <TextInput id="inv-ini" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </Field>
          <Field label="Vencimento (opcional)" htmlFor="inv-venc">
            <TextInput id="inv-venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </Field>
        </div>

        <Field label="Instituição">
          <BankPicker
            value={banco}
            onChange={(id) => {
              setBanco(id)
              setCor(bankById(id)?.cor ?? cor)
            }}
          />
        </Field>

        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {colorChoices(banco, PALETTE).map(({ cor: c, doBanco }) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                title={doBanco ? 'Cor do banco' : undefined}
                aria-label={doBanco ? 'Cor do banco' : `Cor ${c}`}
                className={
                  'size-8 rounded-lg transition-transform ' +
                  (cor === c ? 'ring-2 ring-app-fg ring-offset-2 ring-offset-app-surface scale-110' : '')
                }
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- Modal de aporte/resgate ---------------- */
function MovementModal({
  investment,
  tipo,
  onClose,
}: {
  investment: Investment
  tipo: MovimentoTipo
  onClose: () => void
}) {
  const { accounts, addMovement } = useData()
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(todayISO())
  const [contaId, setContaId] = useState('')
  const [saving, setSaving] = useState(false)

  const contas: Account[] = accounts.filter(
    (a) => !a.arquivada && a.contexto === investment.contexto,
  )
  const aporte = tipo === 'aporte'

  async function salvar() {
    if (valor <= 0) return
    setSaving(true)
    try {
      await addMovement({
        investment_id: investment.id,
        tipo,
        valor_centavos: valor,
        data,
        account_id: contaId || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${aporte ? 'Aportar em' : 'Resgatar de'} · ${investment.nome}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={valor <= 0}>
            {aporte ? 'Aportar' : 'Resgatar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Valor" htmlFor="mov-valor" required>
          <MoneyInput id="mov-valor" cents={valor} onChangeCents={setValor} autoFocus />
        </Field>
        <Field label="Data" htmlFor="mov-data">
          <TextInput id="mov-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Conta de origem/destino (opcional)" htmlFor="mov-conta" hint="Só registro — não movimenta o saldo da conta.">
          <Select id="mov-conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">— não informar —</option>
            {contas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
