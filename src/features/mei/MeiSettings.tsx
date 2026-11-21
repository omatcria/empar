import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Button, Surface } from '@/components/ui/primitives'
import { Field, MoneyInput, TextInput } from '@/components/ui/form'
import { useActiveRole, useActiveWorkspace, useWorkspace } from '@/store/workspace'
import { formatBRL, type Cents } from '@/lib/money'
import { meiLimit } from '@/engine/mei'

export function MeiSettings(): ReactElement | null {
  const ws = useActiveWorkspace()
  const role = useActiveRole()
  const updateWorkspace = useWorkspace((s) => s.updateWorkspace)
  const isOwner = role === 'owner'

  const [ativo, setAtivo] = useState(false)
  const [limite, setLimite] = useState<Cents>(8_100_000)
  const [abertura, setAbertura] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const wsId = ws?.id
  const wsAtivo = ws?.mei_ativo
  const wsLimite = ws?.mei_limite_anual_centavos
  const wsAbertura = ws?.mei_abertura
  useEffect(() => {
    if (wsId === undefined) return
    setAtivo(!!wsAtivo)
    setLimite(wsLimite ?? 8_100_000)
    setAbertura(wsAbertura ?? '')
  }, [wsId, wsAtivo, wsLimite, wsAbertura])

  if (!ws) return null

  const limiteInvalido = limite <= 0
  const anoAbertura = abertura ? Number(abertura.slice(0, 4)) : null
  const proporcional =
    anoAbertura !== null && anoAbertura === new Date().getFullYear()
      ? meiLimit(limite, abertura, anoAbertura)
      : null

  const salvar = async () => {
    if (limiteInvalido) return
    setSaving(true)
    setErro(null)
    setOk(false)
    try {
      await updateWorkspace(ws.id, {
        mei_ativo: ativo,
        mei_limite_anual_centavos: limite,
        mei_abertura: abertura || null,
      })
      setOk(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar as configurações do MEI.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Surface className="p-5">
      <h3 className="text-base font-semibold text-app-fg">Limite do MEI</h3>
      <p className="mt-1 text-sm text-app-muted">
        Acompanhe o faturamento empresarial contra o teto anual do MEI e receba alertas.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm text-app-fg">
        <input
          type="checkbox"
          checked={ativo}
          disabled={!isOwner}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        Monitorar limite do MEI neste espaço
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Limite anual"
          htmlFor="mei-limite"
          error={limiteInvalido ? 'Informe um limite maior que zero' : undefined}
        >
          <MoneyInput id="mei-limite" cents={limite} onChangeCents={setLimite} disabled={!isOwner} />
        </Field>
        <Field label="Data de abertura do CNPJ" htmlFor="mei-abertura">
          <TextInput
            id="mei-abertura"
            type="date"
            value={abertura}
            disabled={!isOwner}
            onChange={(e) => setAbertura(e.target.value)}
          />
        </Field>
      </div>

      <p className="mt-3 text-xs text-app-muted">
        No ano de abertura o limite é proporcional: {formatBRL(Math.round(limite / 12))} por mês de atividade (o mês de
        abertura conta inteiro).
        {proporcional !== null && <> Limite deste ano: {formatBRL(proporcional)}.</>}
      </p>

      {erro && <p className="mt-3 text-sm text-expense">{erro}</p>}
      {ok && <p className="mt-3 text-sm text-income">Configurações salvas.</p>}

      {isOwner ? (
        <Button className="mt-4" onClick={salvar} loading={saving} disabled={limiteInvalido || saving}>
          Salvar
        </Button>
      ) : (
        <p className="mt-4 text-xs text-app-muted">Só o dono do espaço pode alterar estas opções.</p>
      )}
    </Surface>
  )
}
