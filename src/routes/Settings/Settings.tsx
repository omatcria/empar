import { useMemo, useState } from 'react'
import { Download, LogOut, RefreshCw, Sparkles } from '@/components/icons'
import { useData } from '@/store/data'
import { useAuth } from '@/store/auth'
import { useCanWrite } from '@/store/workspace'
import { useNotifications } from '@/store/notifications'
import { buildProLabore, provisaoPorEnvelope } from '@/engine'
import { currentMesRef } from '@/engine/period'
import { formatBRL } from '@/lib/money'
import type { Category, Context, TxType } from '@/domain/types'
import { Button, Surface } from '@/components/ui/primitives'
import { Field, TextInput, MoneyInput } from '@/components/ui/form'
import { MeiSettings } from '@/features/mei/MeiSettings'
import { InstallCard } from '@/features/pwa/InstallCard'
import { DangerZone } from '@/features/reset/DangerZone'
import { exportBackup } from '@/features/reset/backup'
import { Avatar } from '@/components/ui/Avatar'
import { PALETTE } from '@/domain/palette'
import type { Cents } from '@/lib/money'

export function Settings() {
  const store = useData()
  const { profile, provisions, updateProfile, updateProvision } = store
  const prefs = useNotifications((s) => s.prefs)
  const updatePrefs = useNotifications((s) => s.updatePrefs)
  const signOut = useAuth((s) => s.signOut)
  const canWrite = useCanWrite()

  const [nome, setNome] = useState(profile?.nome ?? '')
  const [prolabore, setProlabore] = useState<Cents>(
    profile?.prolabore_padrao_centavos ?? 0,
  )
  const [cdi, setCdi] = useState(profile?.cdi_anual ?? 10.5)
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_url ?? null)
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [backupError, setBackupError] = useState('')

  const reservadoPorEnvelope = useMemo(
    () =>
      new Map(
        provisaoPorEnvelope(store.transactions, provisions).map((e) => [
          e.id,
          e.devidoCentavos,
        ]),
      ),
    [store.transactions, provisions],
  )

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${profile?.id}-${Date.now()}.${ext}`
      
      const { supabase } = await import('@/lib/supabase')
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      setAvatarPath(fileName)
    } catch (err) {
      console.error(err)
      alert('Erro ao fazer upload da imagem.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function salvarPerfil() {
    setSavingPerfil(true)
    try {
      await updateProfile({
        nome: nome.trim() || null,
        prolabore_padrao_centavos: prolabore,
        cdi_anual: cdi,
        avatar_url: avatarPath,
      })
    } finally {
      setSavingPerfil(false)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-app-fg">Configurações</h1>

      {/* Perfil */}
      <Surface className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-app-fg">Perfil</h2>
        
        <div className="mb-6 flex items-center gap-4">
          <Avatar path={avatarPath} nome={nome || profile?.nome} className="size-16 text-xl" />
          <div>
            <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
              {uploadingAvatar ? 'Enviando...' : 'Alterar foto'}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarChange} 
                disabled={uploadingAvatar}
              />
            </label>
            <p className="mt-1 text-xs text-app-muted">JPG, PNG ou GIF. Máximo de 2MB.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="s-nome">
            <TextInput id="s-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Pró-labore padrão" htmlFor="s-pl">
            <MoneyInput id="s-pl" cents={prolabore} onChangeCents={setProlabore} />
          </Field>
          <Field label="Taxa CDI anual (%)" htmlFor="s-cdi" hint="Usada para estimar o rendimento dos investimentos.">
            <TextInput
              id="s-cdi"
              type="number"
              step="0.1"
              min={0}
              value={cdi}
              onChange={(e) => setCdi(Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={salvarPerfil} loading={savingPerfil}>
            Salvar perfil
          </Button>
        </div>
      </Surface>

      <InstallCard />

      {/* Provisões de imposto */}
      <Surface className="p-5">
        <h2 className="mb-1 text-sm font-semibold text-app-fg">
          Provisão de impostos (empresa)
        </h2>
        <p className="mb-4 text-xs text-app-muted">
          Ative os envelopes e ajuste o percentual reservado de cada receita PJ.
        </p>
        <div className="space-y-2">
          {provisions.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl bg-app-surface-2 px-3 py-2.5"
            >
              <button
                onClick={() => canWrite && updateProvision(p.id, { ativo: !p.ativo })}
                role="switch"
                aria-checked={p.ativo}
                aria-label={`Ativar ${p.nome}`}
                disabled={!canWrite}
                className={
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors ' +
                  (canWrite ? 'cursor-pointer ' : 'opacity-60 ') +
                  (p.ativo ? 'bg-income' : 'bg-app-border')
                }
              >
                <span
                  className={
                    'absolute top-0.5 size-5 rounded-full bg-white transition-all ' +
                    (p.ativo ? 'left-[22px]' : 'left-0.5')
                  }
                />
              </button>
              <div className="flex-1">
                <span className="text-sm font-medium text-app-fg">{p.nome}</span>
                {p.ativo && (
                  <span className="ml-2 text-xs text-income">
                    {formatBRL(reservadoPorEnvelope.get(p.id) ?? 0)} reservado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  defaultValue={p.percentual}
                  disabled={!canWrite}
                  onBlur={(e) =>
                    canWrite && updateProvision(p.id, { percentual: Number(e.target.value) })
                  }
                  className="tnum h-9 w-16 rounded-lg border border-app-border bg-app-surface px-2 text-right text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-pessoal disabled:opacity-60"
                />
                <span className="text-sm text-app-muted">%</span>
              </div>
            </div>
          ))}
        </div>
      </Surface>

      <MeiSettings />

      {/* Notificações */}
      {prefs && (
        <Surface className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-app-fg">Notificações</h2>
          <p className="mb-4 text-xs text-app-muted">Escolha o que deseja receber no sistema e por e-mail.</p>
          <div className="space-y-3">
            {[
              { id: 'venc_faturas', label: 'Vencimento de Faturas' },
              { id: 'venc_contas', label: 'Vencimento de Contas' },
              { id: 'orcamento_80', label: 'Alerta de 80% do Orçamento' },
              { id: 'mei_alertas', label: 'Alertas do limite MEI' },
              { id: 'wishlist_precos', label: 'Quedas de preço na lista de desejos' },
            ].map(pref => {
              const checked = prefs[pref.id as keyof typeof prefs] as boolean
              return (
                <div key={pref.id} className="flex items-center gap-3">
                  <button
                    onClick={() => updatePrefs({ [pref.id]: !checked })}
                    role="switch"
                    aria-checked={checked}
                    className={
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ' +
                      (checked ? 'bg-pessoal' : 'bg-app-border')
                    }
                  >
                    <span
                      className={
                        'absolute top-0.5 size-5 rounded-full bg-white transition-all ' +
                        (checked ? 'left-[22px]' : 'left-0.5')
                      }
                    />
                  </button>
                  <span className="text-sm font-medium text-app-fg">{pref.label}</span>
                </div>
              )
            })}
          </div>
        </Surface>
      )}

      {/* Backup + exemplo */}
      <Surface className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-app-fg">Dados</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() => { setBackupError(''); void exportBackup(store).catch((e: Error) => setBackupError(e.message)) }}
          >
            Exportar backup (JSON)
          </Button>
          {canWrite && <SeedExampleButton />}
          {canWrite && (
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              onClick={async () => {
                const btn = document.activeElement as HTMLButtonElement
                const originalText = btn.innerText
                btn.innerText = 'Sincronizando...'
                btn.disabled = true
                try {
                  await store.resyncInvoices()
                  alert('Faturas ressincronizadas com sucesso!')
                } catch (e) {
                  alert('Erro ao sincronizar faturas: ' + (e as Error).message)
                } finally {
                  btn.innerText = originalText
                  btn.disabled = false
                }
              }}
            >
              Re-sincronizar Faturas
            </Button>
          )}
        </div>
        {backupError && <p role="alert" className="mt-2 text-sm text-expense">{backupError}</p>}
      </Surface>

      <DangerZone />

      {/* Conta */}
      <Surface className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-app-fg">Conta</h2>
        <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={() => signOut()}>
          Sair
        </Button>
      </Surface>
    </div>
  )
}

/* ---------------- Dados de exemplo ---------------- */
function findCat(
  cats: Category[],
  contexto: Context,
  tipo: TxType,
  match: string,
): string {
  const rx = new RegExp(match, 'i')
  return (
    cats.find((c) => c.contexto === contexto && c.tipo === tipo && !c.sistema && rx.test(c.nome))
      ?.id ??
    cats.find((c) => c.contexto === contexto && c.tipo === tipo && !c.sistema)?.id ??
    ''
  )
}

function SeedExampleButton() {
  const {
    transactions,
    categories,
    addAccount,
    addCard,
    addTransaction,
    addCardPurchase,
    addTransactions,
  } = useData()
  const userId = useAuth((s) => s.user?.id)
  const [loading, setLoading] = useState(false)
  const jaTem = transactions.length > 0

  const dia = (n: number) => `${currentMesRef()}-${String(n).padStart(2, '0')}`

  async function seed() {
    if (!userId) return
    if (jaTem && !confirm('Isso vai adicionar contas e lançamentos de exemplo. Continuar?'))
      return
    setLoading(true)
    try {
      const pessoal = await addAccount({
        nome: 'Conta Nubank',
        contexto: 'PESSOAL',
        tipo: 'conta_digital',
        saldo_inicial_centavos: 250000,
        cor: PALETTE[0],
      })
      const pj = await addAccount({
        nome: 'Conta PJ Inter',
        contexto: 'EMPRESARIAL',
        tipo: 'conta_pj',
        saldo_inicial_centavos: 800000,
        cor: PALETTE[1],
      })
      const card = await addCard({
        nome: 'Nubank',
        contexto: 'PESSOAL',
        tipo: 'credito',
        limite_centavos: 500000,
        dia_fechamento: 20,
        dia_vencimento: 28,
        account_pagamento_id: pessoal.id,
        cor: PALETTE[0],
      })

      const cats = useData.getState().categories.length
        ? useData.getState().categories
        : categories

      await addTransaction({
        contexto: 'PESSOAL',
        tipo: 'RECEITA',
        account_id: pessoal.id,
        category_id: findCat(cats, 'PESSOAL', 'RECEITA', 'sal'),
        valor_centavos: 400000,
        data: dia(5),
        descricao: 'Salário CLT',
        pago: true,
      })
      await addTransaction({
        contexto: 'EMPRESARIAL',
        tipo: 'RECEITA',
        account_id: pj.id,
        category_id: findCat(cats, 'EMPRESARIAL', 'RECEITA', 'servi'),
        valor_centavos: 1200000,
        data: dia(3),
        descricao: 'Cliente — projeto',
        pago: true,
      })
      await addTransaction({
        contexto: 'PESSOAL',
        tipo: 'DESPESA',
        account_id: pessoal.id,
        category_id: findCat(cats, 'PESSOAL', 'DESPESA', 'morad'),
        valor_centavos: 150000,
        data: dia(6),
        descricao: 'Aluguel',
        pago: true,
      })
      await addTransaction({
        contexto: 'PESSOAL',
        tipo: 'DESPESA',
        account_id: pessoal.id,
        category_id: findCat(cats, 'PESSOAL', 'DESPESA', 'aliment'),
        valor_centavos: 60000,
        data: dia(8),
        descricao: 'Mercado',
        pago: true,
      })
      await addCardPurchase({
        cardId: card.id,
        contexto: 'PESSOAL',
        category_id: findCat(cats, 'PESSOAL', 'DESPESA', 'aliment'),
        valor_centavos: 45000,
        data: dia(10),
        descricao: 'Restaurante',
        parcelas: 3,
      })
      const par = buildProLabore({
        userId,
        valorCentavos: 300000,
        data: dia(5),
        accountEmpresarialId: pj.id,
        accountPessoalId: pessoal.id,
        categories: cats,
      })
      await addTransactions(par)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" icon={<Sparkles className="size-4" />} onClick={seed} loading={loading}>
      Carregar dados de exemplo
    </Button>
  )
}
