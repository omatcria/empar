import { useCallback, useEffect, useRef, useState } from 'react'
import { Surface, Button } from '@/components/ui/primitives'
import { supabase } from '@/lib/supabase'
import { useWorkspace } from '@/store/workspace'

const links = [['Nova despesa', 'despesa'], ['Nova receita', 'receita'], ['Compra no cartão', 'cartao']] as const
const endpoint = 'https://gkzstunjcftvqoljgvce.supabase.co/functions/v1/lancamento-rapido'
type Token = { id: string; nome: string; prefixo: string; created_at: string; last_used_at: string | null }
const date = (s: string) => new Date(s).toLocaleDateString('pt-BR')

export function ShortcutsSettings() {
  const workspace = useWorkspace((s) => s.activeWorkspaceId)
  const activeWorkspace = useRef(workspace)
  activeWorkspace.current = workspace
  const [tokens, setTokens] = useState<Token[]>([])
  const [name, setName] = useState('Meu celular')
  const [secret, setSecret] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    if (!workspace) return
    const { data, error } = await supabase.from('api_tokens').select('id,nome,prefixo,created_at,last_used_at').eq('workspace_id', workspace).is('revoked_at', null).order('created_at', { ascending: false })
    if (activeWorkspace.current !== workspace) return
    if (error) setError(error.message)
    else setTokens(data ?? [])
  }, [workspace])
  useEffect(() => { setSecret(''); setTokens([]); setError(''); void load() }, [load])
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage('Copiado.'); setError('') }
    catch { setError('Não foi possível copiar. Selecione e copie o texto.') }
  }
  async function generate() {
    if (!workspace || busy) return
    setBusy(true); setError(''); setSecret('')
    try {
      const { data, error } = await supabase.rpc('create_quick_token', { _workspace: workspace, _nome: name.trim() })
      if (activeWorkspace.current !== workspace) return
      if (error) throw error
      setSecret(data); await load()
    } catch (e) { if (activeWorkspace.current === workspace) setError(e instanceof Error ? e.message : (e as {message?: string}).message ?? 'Não foi possível gerar a chave.') }
    finally { setBusy(false) }
  }
  async function revoke(token: Token) {
    if (!window.confirm(`Revogar a chave ${token.nome}?`)) return
    setBusy(true); setError('')
    try {
      const { error } = await supabase.rpc('revoke_quick_token', { _id: token.id })
      if (error) throw error
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : (e as {message?: string}).message ?? 'Não foi possível revogar a chave.') }
    finally { setBusy(false) }
  }
  return (
    <Surface className="space-y-5 p-5">
      <h2 className="text-sm font-semibold text-app-fg">Atalhos</h2>
      <section>
        <h3 className="text-sm font-medium text-app-fg">Abrir o pop-up</h3>
        <div className="mt-2 space-y-2">{links.map(([label, value]) => {
          const url = `https://empar-pink.vercel.app/?novo=${value}`
          return <div key={value} className="flex flex-wrap items-center gap-2 text-sm"><span>{label}:</span> <code className="break-all">{url}</code> <button type="button" className="text-primary underline" onClick={() => copy(url)} aria-label={`Copiar ${label}`}>Copiar</button></div>
        })}</div>
        <p className="mt-3 text-sm text-app-muted">No Android, segure o ícone do Empar para ver estes atalhos.</p>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-app-fg">Chaves pessoais</h3>
        {tokens.map((t) => <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{t.nome} · {t.prefixo}… · criada em {date(t.created_at)} · último uso: {t.last_used_at ? date(t.last_used_at) : 'nunca'}</span><button type="button" aria-label={`Revogar ${t.nome}`} onClick={() => revoke(t)} disabled={busy} className="text-expense underline">Revogar</button></div>)}
        <label className="block text-sm">Nome da chave <input className="ml-2 rounded border border-app-border bg-app-surface-2 px-2 py-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
        <Button size="sm" onClick={generate} disabled={busy || !name.trim() || !workspace}>Gerar chave</Button>
        {secret && <div className="space-y-2"><p className="text-sm">Guarde agora: ela não será mostrada de novo.</p><input aria-label="Chave gerada" readOnly value={secret} className="w-full rounded border border-app-border bg-app-surface-2 p-2" /><div className="flex gap-2"><Button size="sm" onClick={() => copy(secret)}>Copiar chave</Button><Button size="sm" variant="secondary" onClick={() => setSecret('')}>Fechar chave</Button></div></div>}
        <p className="text-sm text-app-muted">Quem tiver a chave consegue lançar no seu espaço. Revogue se perder o celular.</p>
      </section>
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      <section className="space-y-2 text-sm">
        <h3 className="font-medium">Passo a passo iPhone (app Atalhos)</h3>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Atalhos › + › Adicionar Ação.</li>
          <li>Adicione Escolher do Menu com “Despesa” e “Receita”; em cada opção, use Texto com <code>despesa</code> ou <code>receita</code> e salve como variável <b>tipo</b>.</li>
          <li>Use Obter Conteúdo do URL: <code className="break-all">{endpoint}?tipo=[tipo]</code>, com cabeçalho <code>Authorization: Bearer [sua chave]</code>.</li>
          <li>Obtenha o valor do dicionário <code>meios</code>, use Escolher da Lista e obtenha o valor correspondente à escolha; salve como <b>meio</b>.</li>
          <li>Repita Obter Conteúdo do URL com <code className="break-all">{endpoint}?tipo=[tipo]&amp;meio=[meio]</code> e o mesmo cabeçalho. Obtenha <code>categorias</code>, escolha da lista e salve o valor como <b>categoria</b>.</li>
          <li>Use Pedir Entrada (Número) para “Valor” e Pedir Entrada (Texto) para “Descrição”.</li>
          <li>Use Obter Conteúdo do URL em <code className="break-all">{endpoint}</code>, método POST, mesmo cabeçalho e corpo JSON com <code>tipo</code>, <code>valor</code>, <code>descricao</code>, <code>meio</code> e <code>categoria</code>.</li>
          <li>Obtenha do dicionário a chave <code>mensagem</code> e use Falar Texto ou Mostrar Resultado.</li>
          <li>Nomeie “Lançar no Empar”. Use Siri, Toque Traseiro (Ajustes › Acessibilidade › Toque › Toque Traseiro), botão de Ação ou widget.</li>
        </ol>
        <p>No iPhone, links abertos pelo app Atalhos usam o Safari, que pode exigir login separado do app instalado.</p>
      </section>
      <section className="space-y-2 text-sm"><h3 className="font-medium">Android</h3><p>Para lançar sem abrir o app, use HTTP Shortcuts ou Tasker com o cabeçalho <code>Authorization: Bearer [sua chave]</code>: GET <code className="break-all">{endpoint}?tipo=despesa</code>, GET <code className="break-all">{endpoint}?tipo=despesa&amp;meio=[meio]</code> e POST em <code className="break-all">{endpoint}</code>.</p><pre className="overflow-x-auto whitespace-pre-wrap break-all">{'{"tipo":"despesa","valor":"45,90","descricao":"Mercado","meio":"conta:UUID","categoria":"UUID"}'}</pre></section>
    </Surface>
  )
}
