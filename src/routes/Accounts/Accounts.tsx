import { useMemo, useState } from 'react'
import {
  Archive,
  Landmark,
  Pencil,
  Plus,
  Scale,
  Wallet,
  Search,
} from '@/components/icons'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { useCanWrite } from '@/store/workspace'
import { accountBalance } from '@/engine'
import type { Account, AccountType, Category, Context, TxType } from '@/domain/types'
import { ACCOUNT_TYPE_LABEL, CONTEXT_LABEL } from '@/domain/enums'
import { Button, Surface } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { PALETTE } from '@/domain/palette'
import { BankBadge, BankPicker } from '@/domain/banks'
import { formatBRL, type Cents } from '@/lib/money'
import { todayISO } from '@/lib/cn'

export function Accounts() {
  const { accounts, cards, invoices, transactions } = useData()
  const { viewMode } = useUI()
  const canWrite = useCanWrite()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [adjusting, setAdjusting] = useState<Account | null>(null)
  const [search, setSearch] = useState('')

  const visiveis = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.arquivada &&
          (viewMode === 'CONSOLIDADO' || a.contexto === viewMode) &&
          a.nome.toLowerCase().includes(search.toLowerCase()),
      ),
    [accounts, viewMode, search],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-fg">Contas</h1>
          <p className="text-sm text-app-muted">
            Corrente, digital, poupança, PJ e dinheiro — tudo num só lugar.
          </p>
        </div>
        {canWrite && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            <span className="hidden sm:inline">Nova conta</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-app-muted" />
          <TextInput
            type="search"
            placeholder="Buscar conta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <Surface className="p-10 text-center">
          <Wallet className="mx-auto mb-3 size-8 text-app-muted" />
          <p className="text-sm text-app-muted">
            Nenhuma conta ainda. Crie sua primeira conta para começar.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visiveis.map((a) => (
            <Surface key={a.id} className="flex items-center gap-3 p-4">
              {a.banco ? (
                <BankBadge id={a.banco} className="size-10 text-sm" />
              ) : (
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: `${a.cor}22`, color: a.cor }}
                >
                  <Landmark className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-app-fg">{a.nome}</p>
                  <ContextBadge contexto={a.contexto} iconOnly />
                </div>
                <p className="text-xs text-app-muted">
                  {ACCOUNT_TYPE_LABEL[a.tipo]}
                  {a.instituicao ? ` · ${a.instituicao}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Money
                  cents={accountBalance(a, transactions, { cards, invoices })}
                  signed
                  className="text-base font-semibold"
                />
                {canWrite && (
                  <div className="flex gap-1">
                    <IconBtn
                      label="Ajustar saldo"
                      onClick={() => setAdjusting(a)}
                      icon={<Scale className="size-4" />}
                    />
                    <IconBtn
                      label="Editar conta"
                      onClick={() => setEditing(a)}
                      icon={<Pencil className="size-4" />}
                    />
                  </div>
                )}
              </div>
            </Surface>
          ))}
        </div>
      )}

      <AccountFormModal open={creating} onClose={() => setCreating(false)} />
      <AccountFormModal
        open={!!editing}
        account={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
      {adjusting && (
        <AdjustBalanceModal
          open={!!adjusting}
          account={adjusting}
          onClose={() => setAdjusting(null)}
        />
      )}
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  icon,
}: {
  label: string
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-app-muted hover:bg-app-surface-2 hover:text-app-fg cursor-pointer"
    >
      {icon}
    </button>
  )
}

/* ============================================================
   Modal criar / editar conta
   (no modo edição o contexto fica travado — não misturar PJ×Pessoal)
   ============================================================ */
function AccountFormModal({
  open,
  onClose,
  account,
}: {
  open: boolean
  onClose: () => void
  account?: Account
}) {
  const { addAccount, updateAccount, archiveAccount } = useData()
  const { viewMode } = useUI()
  const isEdit = !!account

  const initialCtx: Context =
    account?.contexto ?? (viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL')

  const [nome, setNome] = useState(account?.nome ?? '')
  const [contexto, setContexto] = useState<Context>(initialCtx)
  const [tipo, setTipo] = useState<AccountType>(account?.tipo ?? 'conta_corrente')
  const [instituicao, setInstituicao] = useState(account?.instituicao ?? '')
  const [saldo, setSaldo] = useState(account?.saldo_inicial_centavos ?? 0)
  const [cor, setCor] = useState<string>(account?.cor ?? PALETTE[0])
  const [banco, setBanco] = useState<string | null>(account?.banco ?? null)
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!nome.trim()) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateAccount(account.id, {
          nome: nome.trim(),
          tipo,
          instituicao: instituicao.trim() || null,
          cor,
          banco,
        })
      } else {
        await addAccount({
          nome: nome.trim(),
          contexto,
          tipo,
          saldo_inicial_centavos: saldo,
          instituicao: instituicao.trim() || null,
          cor,
          banco,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function arquivar() {
    if (!account) return
    setSaving(true)
    try {
      await archiveAccount(account.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar conta' : 'Nova conta'}
      footer={
        <>
          {isEdit && (
            <Button
              variant="ghost"
              className="mr-auto text-expense"
              icon={<Archive className="size-4" />}
              onClick={arquivar}
            >
              Arquivar
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
        <Field label="Nome" htmlFor="acc-nome" required>
          <TextInput
            id="acc-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Nubank, Conta PJ, Carteira"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Contexto"
            htmlFor="acc-ctx"
            required
            hint={isEdit ? 'Não pode mudar após criada' : undefined}
          >
            <Select
              id="acc-ctx"
              value={contexto}
              disabled={isEdit}
              onChange={(e) => setContexto(e.target.value as Context)}
            >
              <option value="PESSOAL">{CONTEXT_LABEL.PESSOAL}</option>
              <option value="EMPRESARIAL">{CONTEXT_LABEL.EMPRESARIAL}</option>
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="acc-tipo" required>
            <Select
              id="acc-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as AccountType)}
            >
              {Object.entries(ACCOUNT_TYPE_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <Field label="Saldo inicial" htmlFor="acc-saldo">
              <MoneyInput id="acc-saldo" cents={saldo} onChangeCents={setSaldo} />
            </Field>
          )}
          <Field label="Instituição" htmlFor="acc-inst" className={isEdit ? 'col-span-2' : ''}>
            <TextInput
              id="acc-inst"
              value={instituicao}
              onChange={(e) => setInstituicao(e.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </div>

        <Field label="Banco">
          <BankPicker value={banco} onChange={setBanco} />
        </Field>

        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className={
                  'size-8 rounded-lg transition-transform ' +
                  (cor === c
                    ? 'ring-2 ring-app-fg ring-offset-2 ring-offset-app-surface scale-110'
                    : '')
                }
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>

        {isEdit && (
          <p className="text-xs text-app-muted">
            Para mudar o valor da conta, use{' '}
            <span className="text-app-fg2">Ajustar saldo</span> na lista.
          </p>
        )}
      </div>
    </Modal>
  )
}

/* ============================================================
   Modal ajustar saldo (conciliação)
   ============================================================ */
function pickAdjustCategory(
  cats: Category[],
  contexto: Context,
  tipo: TxType,
): string {
  const pool = cats.filter(
    (c) => c.contexto === contexto && c.tipo === tipo && !c.sistema,
  )
  const pref = pool.find((c) => /ajuste|taxa|outro/i.test(c.nome))
  return (pref ?? pool[0])?.id ?? ''
}

function AdjustBalanceModal({
  open,
  onClose,
  account,
}: {
  open: boolean
  onClose: () => void
  account: Account
}) {
  const { cards, invoices, transactions, categories, addTransaction, updateAccount } =
    useData()

  const saldoAtual = useMemo(
    () => accountBalance(account, transactions, { cards, invoices }),
    [account, transactions, cards, invoices],
  )

  const [novoSaldo, setNovoSaldo] = useState<Cents>(saldoAtual)
  const [modo, setModo] = useState<'lancar' | 'apenas'>('lancar')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  const delta = novoSaldo - saldoAtual
  const tipoAjuste: TxType = delta < 0 ? 'DESPESA' : 'RECEITA'

  const categoriasAjuste = useMemo(
    () =>
      categories.filter(
        (c) => c.contexto === account.contexto && c.tipo === tipoAjuste && !c.sistema,
      ),
    [categories, account.contexto, tipoAjuste],
  )
  const [categoriaId, setCategoriaId] = useState('')
  const catEfetiva =
    categoriaId && categoriasAjuste.some((c) => c.id === categoriaId)
      ? categoriaId
      : pickAdjustCategory(categories, account.contexto, tipoAjuste)

  async function aplicar() {
    if (delta === 0) return
    setSaving(true)
    try {
      if (modo === 'apenas') {
        await updateAccount(account.id, {
          saldo_inicial_centavos: account.saldo_inicial_centavos + delta,
        })
      } else {
        await addTransaction({
          contexto: account.contexto,
          tipo: tipoAjuste,
          account_id: account.id,
          category_id: catEfetiva,
          valor_centavos: Math.abs(delta),
          data: todayISO(),
          descricao: descricao.trim() || 'Ajuste de saldo',
          pago: true,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ajustar saldo · ${account.nome}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={aplicar}
            loading={saving}
            disabled={delta === 0 || (modo === 'lancar' && !catEfetiva)}
          >
            Aplicar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl bg-app-surface-2 px-4 py-3">
          <span className="text-sm text-app-muted">Saldo atual</span>
          <Money cents={saldoAtual} className="font-semibold text-app-fg" />
        </div>

        <Field label="Novo saldo" htmlFor="adj-saldo" required>
          <MoneyInput
            id="adj-saldo"
            cents={novoSaldo}
            onChangeCents={setNovoSaldo}
            autoFocus
          />
        </Field>

        {/* Diferença */}
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-app-muted">Diferença</span>
          <Money cents={delta} signed showSign className="font-semibold" />
        </div>

        {delta !== 0 && (
          <>
            {/* Escolha do modo */}
            <div className="flex flex-col gap-2">
              <RadioOption
                selected={modo === 'lancar'}
                onClick={() => setModo('lancar')}
                title={`Lançar diferença como ${tipoAjuste === 'DESPESA' ? 'gasto' : 'receita'}`}
                desc="Mantém o histórico (a diferença vira um lançamento rastreável)."
              />
              <RadioOption
                selected={modo === 'apenas'}
                onClick={() => setModo('apenas')}
                title="Apenas atualizar o saldo"
                desc="Sem lançamento — só corrige a linha de base."
              />
            </div>

            {modo === 'lancar' && (
              <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface-2/50 p-3">
                <Field label="Categoria" htmlFor="adj-cat" required>
                  <Select
                    id="adj-cat"
                    value={catEfetiva}
                    onChange={(e) => setCategoriaId(e.target.value)}
                  >
                    {categoriasAjuste.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Descrição" htmlFor="adj-desc">
                  <TextInput
                    id="adj-desc"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder={
                      tipoAjuste === 'DESPESA'
                        ? 'Ex.: Taxas / tarifas'
                        : 'Ex.: Rendimento / correção'
                    }
                  />
                </Field>
                <p className="text-xs text-app-muted">
                  Vai criar {tipoAjuste === 'DESPESA' ? 'uma despesa' : 'uma receita'} de{' '}
                  <span className="text-app-fg">{formatBRL(Math.abs(delta))}</span> hoje.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function RadioOption({
  selected,
  onClick,
  title,
  desc,
}: {
  selected: boolean
  onClick: () => void
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ' +
        (selected
          ? 'border-pessoal bg-pessoal-soft/40'
          : 'border-app-border bg-app-surface-2 hover:border-app-muted/40')
      }
    >
      <span
        className={
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ' +
          (selected ? 'border-pessoal' : 'border-app-muted')
        }
      >
        {selected && <span className="size-2 rounded-full bg-pessoal" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-app-fg">{title}</span>
        <span className="block text-xs text-app-muted">{desc}</span>
      </span>
    </button>
  )
}
