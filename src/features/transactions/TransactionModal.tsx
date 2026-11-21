import { useEffect, useMemo, useState } from 'react'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { suggestCategory } from '@/engine'
import type { Context, TxType, Transaction } from '@/domain/types'
import { CONTEXT_LABEL } from '@/domain/enums'
import { Button } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { MeiImpactAlert } from '@/features/mei/MeiImpactAlert'
import { CategoryCombobox } from '@/components/ui/CategoryCombobox'
import { cn, todayISO } from '@/lib/cn'
import { formatBRL, type Cents } from '@/lib/money'

type Meio = 'conta' | 'cartao'

export function TransactionModal({
  open,
  onClose,
  transaction,
}: {
  open: boolean
  onClose: () => void
  transaction?: Transaction
}) {
  const { accounts, cards, categories, transactions, addTransaction, addCardPurchase, updateTransaction, updateTransactionGroup } =
    useData()
  const { viewMode } = useUI()
  const [categoriaTocada, setCategoriaTocada] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmGroupEdit, setConfirmGroupEdit] = useState(false)

  const ctxInicial: Context = viewMode === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PESSOAL'

  const isEdit = !!transaction
  const [tipo, setTipo] = useState<TxType>(transaction?.tipo ?? 'DESPESA')
  const [contexto, setContexto] = useState<Context>(transaction?.contexto ?? ctxInicial)
  const [meio, setMeio] = useState<Meio>(transaction?.card_id ? 'cartao' : 'conta')
  const [accountId, setAccountId] = useState(transaction?.account_id ?? '')
  const [cardId, setCardId] = useState(transaction?.card_id ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '')
  const [valor, setValor] = useState<Cents>(transaction?.valor_centavos ?? 0)
  const [data, setData] = useState(transaction?.data ?? todayISO())
  const [descricao, setDescricao] = useState(transaction?.descricao ?? '')
  const [pago, setPago] = useState(transaction?.pago ?? true)
  const [parcelas, setParcelas] = useState(1)
  // Se o valor digitado é o total da compra ou o valor de cada parcela.
  const [valorTipo, setValorTipo] = useState<'total' | 'parcela'>('total')

  // Receita não vai em cartão de crédito
  const meioEfetivo: Meio = tipo === 'RECEITA' ? 'conta' : meio

  const contas = useMemo(
    () => accounts.filter((a) => !a.arquivada && a.contexto === contexto),
    [accounts, contexto],
  )
  const cartoes = useMemo(
    () =>
      cards.filter(
        (c) => !c.arquivado && c.contexto === contexto && c.tipo !== 'debito',
      ),
    [cards, contexto],
  )
  const cats = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.contexto === contexto &&
          c.tipo === tipo &&
          !(c.chave && /PRO_LABORE|DISTRIBUICAO/.test(c.chave)),
      ),
    [categories, contexto, tipo],
  )

  // Reset ao abrir
  useEffect(() => {
    if (!open) return
    if (transaction) {
      setTipo(transaction.tipo)
      setContexto(transaction.contexto)
      setMeio(transaction.card_id ? 'cartao' : 'conta')
      setAccountId(transaction.account_id ?? '')
      setCardId(transaction.card_id ?? '')
      setCategoryId(transaction.category_id)
      setValor(transaction.valor_centavos)
      setData(transaction.data)
      setDescricao(transaction.descricao ?? '')
      setPago(transaction.pago)
      setParcelas(1)
      setValorTipo('total')
      setCategoriaTocada(true)
    } else {
      setTipo('DESPESA')
      setContexto(ctxInicial)
      setMeio('conta')
      setAccountId('')
      setCardId('')
      setCategoryId('')
      setValor(0)
      setData(todayISO())
      setDescricao('')
      setPago(true)
      setParcelas(1)
      setValorTipo('total')
      setCategoriaTocada(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction])

  // Mantém as seleções válidas conforme os filtros mudam
  useEffect(() => {
    if (!contas.some((a) => a.id === accountId)) setAccountId(contas[0]?.id ?? '')
  }, [contas, accountId])
  useEffect(() => {
    if (!cartoes.some((c) => c.id === cardId)) setCardId(cartoes[0]?.id ?? '')
  }, [cartoes, cardId])
  // Categoria: sugere pelo histórico enquanto o usuário não escolher manualmente
  useEffect(() => {
    if (categoriaTocada) return
    const sug = suggestCategory(descricao, transactions, contexto, tipo)
    const pick = sug && cats.some((c) => c.id === sug) ? sug : cats[0]?.id ?? ''
    setCategoryId(pick)
  }, [cats, descricao, contexto, tipo, transactions, categoriaTocada])

  const podeSalvar =
    valor > 0 &&
    categoryId &&
    (meioEfetivo === 'conta' ? !!accountId : !!cardId)

  async function salvar() {
    if (!podeSalvar) return
    setSaving(true)
    try {
      if (isEdit) {
        if (transaction.parcela_group_id && !confirmGroupEdit) {
          setConfirmGroupEdit(true)
          setSaving(false)
          return
        }

        const patch = {
          contexto,
          tipo,
          account_id: meioEfetivo === 'conta' ? accountId : null,
          card_id: meioEfetivo === 'cartao' ? cardId : null,
          category_id: categoryId,
          valor_centavos: valor,
          data,
          descricao: descricao.trim() || undefined,
          pago: meioEfetivo === 'cartao' ? true : pago,
        }

        // Se passamos pelo confirmGroupEdit, ele chamará a função apropriada
        // A lógica do confirmGroupEdit será resolvida na UI, então aqui
        // deixamos apenas o updateTransaction simples caso não tenha grupo.
        if (!transaction.parcela_group_id) {
          await updateTransaction(transaction.id, patch)
        }
      } else {
        if (meioEfetivo === 'conta') {
          await addTransaction({
            contexto,
            tipo,
            account_id: accountId,
            category_id: categoryId,
            valor_centavos: valor,
            data,
            descricao: descricao.trim(),
            pago,
          })
        } else {
          // valor pode ser o total da compra ou o valor de cada parcela.
          const valorTotal = valorTipo === 'parcela' ? valor * parcelas : valor
          await addCardPurchase({
            cardId,
            contexto,
            category_id: categoryId,
            valor_centavos: valorTotal,
            data,
            descricao: descricao.trim() || 'Compra no cartão',
            tipo: 'DESPESA',
            parcelas,
          })
        }
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
      title={isEdit ? "Editar lançamento" : "Novo lançamento"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving} disabled={!podeSalvar}>
            Salvar
          </Button>
        </>
      }
    >
      {confirmGroupEdit && isEdit && transaction?.parcela_group_id ? (
        <div className="flex flex-col gap-4 py-4 text-center">
          <p className="text-sm text-app-muted">
            Você está editando uma transação parcelada (<strong>{transaction.parcela_n}/{transaction.parcela_total}</strong>).
            Como deseja aplicar esta alteração?
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              variant="secondary"
              onClick={async () => {
                setSaving(true)
                try {
                  await updateTransactionGroup(transaction.id, {
                    contexto, tipo, account_id: meioEfetivo === 'conta' ? accountId : null, card_id: meioEfetivo === 'cartao' ? cardId : null, category_id: categoryId, valor_centavos: valor, data, descricao: descricao.trim() || undefined, pago: meioEfetivo === 'cartao' ? true : pago
                  }, 'THIS')
                  setConfirmGroupEdit(false)
                  onClose()
                } finally { setSaving(false) }
              }}
            >
              Alterar somente esta parcela
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setSaving(true)
                try {
                  await updateTransactionGroup(transaction.id, {
                    contexto, tipo, account_id: meioEfetivo === 'conta' ? accountId : null, card_id: meioEfetivo === 'cartao' ? cardId : null, category_id: categoryId, valor_centavos: valor, data, descricao: descricao.trim() || undefined, pago: meioEfetivo === 'cartao' ? true : pago
                  }, 'THIS_AND_FUTURE')
                  setConfirmGroupEdit(false)
                  onClose()
                } finally { setSaving(false) }
              }}
            >
              Esta e as próximas parcelas
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                setSaving(true)
                try {
                  await updateTransactionGroup(transaction.id, {
                    contexto, tipo, account_id: meioEfetivo === 'conta' ? accountId : null, card_id: meioEfetivo === 'cartao' ? cardId : null, category_id: categoryId, valor_centavos: valor, data, descricao: descricao.trim() || undefined, pago: meioEfetivo === 'cartao' ? true : pago
                  }, 'ALL')
                  setConfirmGroupEdit(false)
                  onClose()
                } finally { setSaving(false) }
              }}
            >
              Alterar todas as parcelas
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Tipo */}
          <Segmented
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'DESPESA', label: 'Despesa', activeClass: 'bg-expense/15 text-expense' },
            { value: 'RECEITA', label: 'Receita', activeClass: 'bg-income/15 text-income' },
          ]}
        />

        {/* Valor em destaque */}
        <Field label="Valor" htmlFor="tx-valor" required>
          <MoneyInput id="tx-valor" cents={valor} onChangeCents={setValor} autoFocus />
        </Field>
        <MeiImpactAlert
          contexto={contexto}
          tipo={tipo}
          valorCentavos={valor}
          data={data}
          editingValorCentavos={transaction?.pago && transaction.contexto === 'EMPRESARIAL' && transaction.tipo === 'RECEITA' && transaction.data.startsWith(`${todayISO().slice(0, 4)}-`) && !transaction.transfer_id && !categories.find(c => c.id === transaction.category_id)?.sistema ? transaction.valor_centavos : 0}
        />

        {/* Contexto */}
        <Field label="Contexto">
          <Segmented
            value={contexto}
            onChange={setContexto}
            options={[
              {
                value: 'PESSOAL',
                label: CONTEXT_LABEL.PESSOAL,
                activeClass: 'bg-pessoal-soft text-pessoal-strong',
              },
              {
                value: 'EMPRESARIAL',
                label: CONTEXT_LABEL.EMPRESARIAL,
                activeClass: 'bg-empresarial-soft text-empresarial-strong',
              },
            ]}
          />
        </Field>

        {/* Meio: conta ou cartão (cartão só em despesa) */}
        {tipo === 'DESPESA' && (
          <Field label="Pagar com">
            <Segmented
              value={meio}
              onChange={setMeio}
              options={[
                { value: 'conta', label: 'Conta' },
                { value: 'cartao', label: 'Cartão de crédito' },
              ]}
            />
          </Field>
        )}

        {meioEfetivo === 'conta' ? (
          <Field label="Conta" htmlFor="tx-conta" required>
            <Select
              id="tx-conta"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {contas.length === 0 && <option value="">Nenhuma conta neste contexto</option>}
              {contas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Cartão" htmlFor="tx-card" required>
              <Select id="tx-card" value={cardId} disabled={isEdit} onChange={(e) => setCardId(e.target.value)}>
                {cartoes.length === 0 && <option value="">Nenhum cartão neste contexto</option>}
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            {!isEdit && (
              <Field label="Parcelas" htmlFor="tx-parc">
                <Select
                  id="tx-parc"
                  value={parcelas}
                  onChange={(e) => setParcelas(Number(e.target.value))}
                  className="w-20"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {/* O valor digitado é o total ou o de cada parcela? */}
          {!isEdit && parcelas > 1 && (
            <Field label="O valor informado é">
              <Segmented
                value={valorTipo}
                onChange={setValorTipo}
                options={[
                  { value: 'total', label: 'Total da compra' },
                  { value: 'parcela', label: 'De cada parcela' },
                ]}
              />
              {valor > 0 && (
                <p className="mt-1.5 text-xs text-app-muted">
                  {valorTipo === 'total'
                    ? `${parcelas}x de ${formatBRL(Math.round(valor / parcelas))} · total ${formatBRL(valor)}`
                    : `${parcelas}x de ${formatBRL(valor)} · total ${formatBRL(valor * parcelas)}`}
                </p>
              )}
            </Field>
          )}
          </>
        )}

        {/* Categoria */}
        <Field label="Categoria" htmlFor="tx-cat" required>
          <CategoryCombobox
            id="tx-cat"
            value={categoryId}
            onChange={(val) => {
              setCategoryId(val)
              setCategoriaTocada(true)
            }}
            categories={cats}
          />
        </Field>

        {/* Data + descrição */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" htmlFor="tx-data">
            <TextInput
              id="tx-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Field>
          {meioEfetivo === 'conta' && (
            <Field label="Situação">
              <Segmented
                value={pago ? 'pago' : 'pendente'}
                onChange={(v) => setPago(v === 'pago')}
                options={[
                  { value: 'pago', label: 'Pago' },
                  { value: 'pendente', label: 'Pendente' },
                ]}
              />
            </Field>
          )}
        </div>

        <Field label="Descrição" htmlFor="tx-desc">
          <TextInput
            id="tx-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Opcional"
          />
        </Field>
      </div>
      )}
    </Modal>
  )
}

/* ---------------- Segmented control genérico ---------------- */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; activeClass?: string }[]
}) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-app-surface-2 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 rounded-lg px-2 text-sm font-medium transition-colors cursor-pointer',
              active
                ? o.activeClass ?? 'bg-app-surface text-app-fg shadow'
                : 'text-app-muted hover:text-app-fg2',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
