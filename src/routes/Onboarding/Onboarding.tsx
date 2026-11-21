import { useState } from 'react'
import { Check, Landmark, Plus, Wallet } from '@/components/icons'
import { useData } from '@/store/data'
import type { AccountType, Context } from '@/domain/types'
import { ACCOUNT_TYPE_LABEL, CONTEXT_LABEL } from '@/domain/enums'
import { Button, Surface } from '@/components/ui/primitives'
import { Money } from '@/components/ui/Money'
import { ContextBadge } from '@/components/ui/ContextBadge'
import { Field, Select, TextInput, MoneyInput } from '@/components/ui/form'
import { PALETTE } from '@/domain/palette'
import { cn } from '@/lib/cn'
import type { Cents } from '@/lib/money'

export function Onboarding() {
  const { accounts, addAccount, updateProfile, completeOnboarding } = useData()
  const [step, setStep] = useState(0)
  const [prolabore, setProlabore] = useState<Cents>(0)
  const [finishing, setFinishing] = useState(false)

  async function finalizar() {
    setFinishing(true)
    try {
      if (prolabore > 0) await updateProfile({ prolabore_padrao_centavos: prolabore })
      await completeOnboarding()
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="min-h-dvh overflow-y-auto py-10">
      <div className="mx-auto w-full max-w-lg px-4">
        {/* Cabeçalho */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pessoal to-empresarial text-xl font-bold text-white">
            $
          </div>
          <h1 className="text-2xl font-bold text-app-fg">Bem-vindo!</h1>
          <p className="mt-1 text-sm text-app-muted">
            Vamos organizar suas finanças PJ e Pessoal em 2 passos.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {['Contas', 'Pró-labore'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                  i <= step
                    ? 'bg-gradient-to-br from-pessoal to-empresarial text-white'
                    : 'bg-app-surface-2 text-app-muted',
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn('text-sm', i === step ? 'text-app-fg' : 'text-app-muted')}>
                {label}
              </span>
              {i === 0 && <span className="mx-1 h-px w-6 bg-app-border" />}
            </div>
          ))}
        </div>

        {step === 0 ? (
          <StepContas accounts={accounts} onAdd={addAccount} onNext={() => setStep(1)} />
        ) : (
          <Surface className="p-6">
            <h2 className="text-base font-semibold text-app-fg">Pró-labore padrão</h2>
            <p className="mb-4 mt-1 text-sm text-app-muted">
              Quanto você costuma retirar da empresa por mês? (pode mudar depois)
            </p>
            <Field label="Valor mensal" htmlFor="ob-pl">
              <MoneyInput id="ob-pl" cents={prolabore} onChangeCents={setProlabore} autoFocus />
            </Field>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button onClick={finalizar} loading={finishing}>
                Concluir
              </Button>
            </div>
          </Surface>
        )}

        <button
          onClick={finalizar}
          className="mx-auto mt-4 block text-xs text-app-muted hover:text-app-fg2 cursor-pointer"
        >
          Pular por agora
        </button>
      </div>
    </div>
  )
}

function StepContas({
  accounts,
  onAdd,
  onNext,
}: {
  accounts: ReturnType<typeof useData.getState>['accounts']
  onAdd: ReturnType<typeof useData.getState>['addAccount']
  onNext: () => void
}) {
  const [nome, setNome] = useState('')
  const [contexto, setContexto] = useState<Context>('PESSOAL')
  const [tipo, setTipo] = useState<AccountType>('conta_corrente')
  const [saldo, setSaldo] = useState<Cents>(0)
  const [adding, setAdding] = useState(false)

  async function adicionar() {
    if (!nome.trim()) return
    setAdding(true)
    try {
      await onAdd({
        nome: nome.trim(),
        contexto,
        tipo,
        saldo_inicial_centavos: saldo,
        cor: contexto === 'PESSOAL' ? PALETTE[0] : PALETTE[1],
      })
      setNome('')
      setSaldo(0)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Surface className="p-6">
      <h2 className="text-base font-semibold text-app-fg">Suas contas</h2>
      <p className="mb-4 mt-1 text-sm text-app-muted">
        Adicione ao menos uma conta pessoal e, se tiver, a conta PJ.
      </p>

      {/* Lista */}
      {accounts.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg bg-app-surface-2 px-3 py-2"
            >
              <Landmark className="size-4" style={{ color: a.cor }} />
              <span className="flex-1 truncate text-sm text-app-fg">{a.nome}</span>
              <ContextBadge contexto={a.contexto} iconOnly />
              <Money cents={a.saldo_inicial_centavos} className="text-sm text-app-fg2" />
            </div>
          ))}
        </div>
      )}

      {/* Mini form */}
      <div className="space-y-3 rounded-xl border border-app-border bg-app-surface-2/40 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-app-surface-2 p-1">
          {(['PESSOAL', 'EMPRESARIAL'] as Context[]).map((c) => (
            <button
              key={c}
              onClick={() => setContexto(c)}
              className={cn(
                'h-8 rounded-md text-sm font-medium cursor-pointer',
                contexto === c
                  ? c === 'PESSOAL'
                    ? 'bg-pessoal-soft text-pessoal-strong'
                    : 'bg-empresarial-soft text-empresarial-strong'
                  : 'text-app-muted',
              )}
            >
              {CONTEXT_LABEL[c]}
            </button>
          ))}
        </div>
        <TextInput
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da conta (ex.: Nubank)"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
          <MoneyInput cents={saldo} onChangeCents={setSaldo} placeholder="Saldo inicial" />
        </div>
        <Button
          variant="secondary"
          className="w-full"
          icon={<Plus className="size-4" />}
          onClick={adicionar}
          loading={adding}
          disabled={!nome.trim()}
        >
          Adicionar conta
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-app-muted">
          <Wallet className="size-4" /> {accounts.length} conta(s)
        </span>
        <Button onClick={onNext} disabled={accounts.length === 0}>
          Continuar
        </Button>
      </div>
    </Surface>
  )
}
