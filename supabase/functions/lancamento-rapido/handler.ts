import { parseValorToCents, parseMeio, quickAddMessage, meioLabel, categoriaLabel } from '../_shared/quick-add.ts'
import { resolveInvoiceCycle } from '../_shared/invoice-cycle.ts'
import { buildMemberNotification } from '../_shared/member-notifications.ts'

type Db = { from: (table: string) => any; rpc: (name: string, args: unknown) => PromiseLike<{ data: any; error: any }> }
type Tipo = 'despesa' | 'receita'
type Meio = { kind: 'conta' | 'cartao'; id: string }
type Item = { id: string; nome: string; contexto: string; dia_fechamento?: number; dia_vencimento?: number }
type Category = { id: string; nome: string; categoria_pai_id: string | null; chave: string | null }
const invalidKey = 'Chave inválida ou revogada. Gere outra em Configurações › Atalhos.'
const forbidden = 'Sua conta não tem permissão para lançar neste espaço.'
const bad = (mensagem: string, status = 400) => Response.json({ok: false, mensagem}, {status})
const check = <T>(result: {data: T; error: any}): T => { if (result.error) throw result.error; return result.data }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function digest(token: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('')
}
async function findMeio(db: Db, ws: string, meio: Meio, tipo: Tipo): Promise<Item | null> {
  if (tipo === 'receita' && meio.kind === 'cartao') return null
  let query = db.from(meio.kind === 'conta' ? 'accounts' : 'cards').select('*').eq('workspace_id', ws).eq('id', meio.id)
  query = meio.kind === 'conta' ? query.eq('arquivada', false) : query.eq('arquivado', false).neq('tipo', 'debito')
  return check(await query.maybeSingle()) as Item | null
}
async function categories(db: Db, ws: string, ctx: string, tipo: Tipo): Promise<Category[]> {
  const data = check(await db.from('categories').select('id,nome,categoria_pai_id,chave').eq('workspace_id', ws).eq('contexto', ctx).eq('tipo', tipo.toUpperCase())) as Category[]
  return data.filter((c) => !/PRO_LABORE|DISTRIBUICAO/.test(c.chave ?? ''))
}
function dictionary(items: {label: string; value: string}[]) {
  const out: Record<string, string> = Object.create(null)
  items.sort((a,b) => a.label.localeCompare(b.label, 'pt-BR') || a.value.localeCompare(b.value))
  for (const item of items) {
    let label = item.label
    if (Object.hasOwn(out, label)) label = `${label} (${item.value})`
    out[label] = item.value
  }
  return out
}
export async function handleQuickAdd(req: Request, db: Db): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return bad('Método não permitido.', 405)
  const bearer = /^Bearer (emp_[0-9a-f]{48})$/i.exec(req.headers.get('authorization') ?? '')
  if (!bearer) return bad(invalidKey, 401)
  try {
    const hash = await digest(bearer[1])
    const token = check(await db.from('api_tokens').select('id,user_id,workspace_id').eq('token_hash', hash).is('revoked_at', null).maybeSingle()) as {id:string;user_id:string;workspace_id:string} | null
    if (!token) return bad(invalidKey, 401)
    const member = check(await db.from('workspace_members').select('role,nome').eq('workspace_id', token.workspace_id).eq('user_id', token.user_id).maybeSingle()) as {role:string;nome:string|null} | null
    if (!member || !['owner','editor'].includes(member.role)) return bad(forbidden, 403)
    const url = new URL(req.url)
    let body: any = null
    if (req.method === 'POST') {
      try { body = await req.json() } catch { return bad('JSON inválido.') }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('JSON inválido.')
    }
    const tipo = (req.method === 'GET' ? url.searchParams.get('tipo') : body.tipo) as Tipo
    if (tipo !== 'despesa' && tipo !== 'receita') return bad('Escolha despesa ou receita.')
    const rawMeio = req.method === 'GET' ? url.searchParams.get('meio') : body.meio
    if (req.method === 'GET' && rawMeio === null) {
      const accounts = check(await db.from('accounts').select('id,nome,contexto').eq('workspace_id', token.workspace_id).eq('arquivada', false)) as Item[]
      const cards = tipo === 'despesa' ? check(await db.from('cards').select('id,nome,contexto').eq('workspace_id', token.workspace_id).eq('arquivado', false).neq('tipo', 'debito')) as Item[] : []
      const items = [...accounts.map((a) => ({label:meioLabel('conta',a.nome,a.contexto),value:`conta:${a.id}`})), ...cards.map((c) => ({label:meioLabel('cartao',c.nome,c.contexto),value:`cartao:${c.id}`}))]
      check(await db.from('api_tokens').update({last_used_at:new Date().toISOString()}).eq('id',token.id).is('revoked_at',null))
      return Response.json({meios: dictionary(items)})
    }
    const meio = parseMeio(rawMeio)
    if (!meio) return bad('Escolha uma conta válida.')
    const selected = await findMeio(db, token.workspace_id, meio, tipo)
    if (!selected) return bad('Escolha uma conta válida.')
    const cats = await categories(db, token.workspace_id, selected.contexto, tipo)
    if (req.method === 'GET') {
      const names = new Map(cats.map((c) => [c.id,c.nome]))
      const items = cats.map((c) => ({label:categoriaLabel(c.nome,c.categoria_pai_id ? names.get(c.categoria_pai_id) : null),value:c.id}))
      check(await db.from('api_tokens').update({last_used_at:new Date().toISOString()}).eq('id',token.id).is('revoked_at',null))
      return Response.json({categorias:dictionary(items)})
    }
    const valor = parseValorToCents(body.valor)
    if (valor === null) return bad('Valor inválido. Use, por exemplo, 45,90.')
    if (typeof body.descricao !== 'string' || body.descricao.length > 120) return bad('Descrição deve ter até 120 caracteres.')
    if (typeof body.categoria !== 'string' || !uuid.test(body.categoria)) return bad('Categoria não combina com o tipo ou a conta.')
    const categoria = cats.find((c) => c.id === body.categoria)
    if (!categoria) return bad('Categoria não combina com o tipo ou a conta.')
    const descricao = body.descricao.trim() || categoria.nome
    const data = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const id = crypto.randomUUID()
    const notification = buildMemberNotification({kind:'lancamento',acao:'criou',entityId:id,descricao,tipo:tipo.toUpperCase() as 'RECEITA'|'DESPESA',valorCentavos:valor,data}, member.nome || 'Alguém')
    const cycle = meio.kind === 'cartao' ? resolveInvoiceCycle(selected.dia_fechamento!,selected.dia_vencimento!,data) : null
    const result = await db.rpc('insert_quick_transaction',{_hash:hash,_input:{id,kind:meio.kind,meio:meio.id,tipo:tipo.toUpperCase(),categoria:categoria.id,valor,data,descricao,cycle,notification}})
    if (result.error) {
      const error = String(result.error.message ?? '')
      if (error.includes('QUICK_UNAUTHORIZED')) return bad(invalidKey, 401)
      if (error.includes('QUICK_FORBIDDEN')) return bad(forbidden, 403)
      if (error.includes('QUICK_MEIO')) return bad('Escolha uma conta válida.')
      if (error.includes('QUICK_CATEGORIA')) return bad('Categoria não combina com o tipo ou a conta.')
      if (error.includes('QUICK_INVALID')) return bad('Dados inválidos. Tente novamente.')
      throw result.error
    }
    return Response.json({ok:true,mensagem:quickAddMessage(tipo,valor,descricao),id:result.data},{status:201})
  } catch (error) {
    console.error('Falha no lançamento rápido', error)
    return bad('Não foi possível concluir o lançamento. Tente novamente.', 500)
  }
}
