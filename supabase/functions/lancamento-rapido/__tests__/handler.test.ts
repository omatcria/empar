import { describe, expect, it } from 'vitest'
import { handleQuickAdd } from '../handler'
const token = 'emp_' + 'a'.repeat(48)
const account = '123e4567-e89b-12d3-a456-426614174000'
const category = '123e4567-e89b-12d3-a456-426614174001'
function fakeDb(overrides: Record<string, unknown[]> = {}) {
  const rows: Record<string, unknown[]> = {api_tokens:[{id:'token',user_id:'u',workspace_id:'w',revoked_at:null}], workspace_members:[{user_id:'u',role:'editor',nome:'Ana',workspace_id:'w'}], accounts:[{id:account,nome:'Banco',contexto:'PESSOAL',workspace_id:'w',arquivada:false}], cards:[], categories:[{id:category,nome:'Mercado',contexto:'PESSOAL',tipo:'DESPESA',chave:null,categoria_pai_id:null,workspace_id:'w'}], ...overrides}
  const calls: unknown[] = []
  return { calls, from(table: string) {
    let result = [...(rows[table] ?? [])] as Record<string, unknown>[]
    const q = {select(){return q}, update(){return q}, eq(k:string,v:unknown){result=result.filter(r=>r[k]===v || (table==='api_tokens' && k==='token_hash'));return q}, is(k:string,v:unknown){result=result.filter(r=>r[k]===v);return q}, neq(k:string,v:unknown){result=result.filter(r=>r[k]!==v);return q}, maybeSingle(){return Promise.resolve({data:result[0]??null,error:null})}, then(resolve:(v:unknown)=>unknown){return Promise.resolve({data:result,error:null}).then(resolve)}}
    return q
  }, rpc(name:string,args:unknown){calls.push({name,args});return Promise.resolve({data:'tx-1',error:null})} }
}
function req(path: string, options: RequestInit = {}) { return new Request('https://example.test/' + path, {...options, headers:{Authorization:`Bearer ${token}`,...(options.headers??{})}}) }
describe('função de lançamento rápido', () => {
  it('nega chave ausente ou revogada', async () => {
    expect((await handleQuickAdd(new Request('https://example.test/?tipo=despesa'),fakeDb())).status).toBe(401)
    expect((await handleQuickAdd(req('?tipo=despesa'),fakeDb({api_tokens:[]}))).status).toBe(401)
  })
  it('bloqueia usuário sem escrita', async () => expect((await handleQuickAdd(req('?tipo=despesa'),fakeDb({workspace_members:[{user_id:'u',workspace_id:'w',role:'viewer'}]}))).status).toBe(403))
  it('lista meios e categorias compatíveis', async () => {
    const db=fakeDb()
    expect((await (await handleQuickAdd(req('?tipo=despesa'),db)).json()).meios['Conta · Banco (Pessoal)']).toBe(`conta:${account}`)
    expect((await (await handleQuickAdd(req(`?tipo=despesa&meio=conta:${account}`),db)).json()).categorias.Mercado).toBe(category)
  })
  it('valida valores e usa a RPC transacional', async () => {
    const db=fakeDb(), body={tipo:'despesa',valor:'45,90',descricao:'',meio:`conta:${account}`,categoria:category}
    const res=await handleQuickAdd(req('',{method:'POST',body:JSON.stringify(body)}),db)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ok:true,mensagem:'Despesa de R$ 45,90 lançada: Mercado',id:'tx-1'})
    expect(db.calls[0]).toMatchObject({name:'insert_quick_transaction',args:{_input:{valor:4590,descricao:'Mercado',kind:'conta'}}})
    expect((await handleQuickAdd(req('',{method:'POST',body:JSON.stringify({...body,valor:'abc'})}),db)).status).toBe(400)
  })
  it('compra no cartão usa o ciclo e inclui o aviso para os outros membros', async () => {
    const card = '123e4567-e89b-12d3-a456-426614174002'
    const db = fakeDb({cards:[{id:card,nome:'Crédito',contexto:'PESSOAL',workspace_id:'w',arquivado:false,tipo:'credito',dia_fechamento:20,dia_vencimento:5}]})
    const response = await handleQuickAdd(req('',{method:'POST',body:JSON.stringify({tipo:'despesa',valor:'45,90',descricao:'Feira',meio:`cartao:${card}`,categoria:category})}),db)
    expect(response.status).toBe(201)
    expect(db.calls[0]).toMatchObject({name:'insert_quick_transaction',args:{_input:{kind:'cartao',meio:card,cycle:{mesReferencia:expect.stringMatching(/^\d{4}-\d{2}$/),dataFechamento:expect.any(String),dataVencimento:expect.any(String)},notification:{tipo:'membro_lancamento',titulo:'Ana lançou: Feira'}}}})
    const invalid = await handleQuickAdd(req(`?tipo=receita&meio=cartao:${card}`),db)
    expect(invalid.status).toBe(400)
  })
  it('rejeita uma categoria de outro contexto', async () => {
    const db = fakeDb({categories:[{id:category,nome:'Mercado',contexto:'EMPRESARIAL',tipo:'DESPESA',chave:null,categoria_pai_id:null,workspace_id:'w'}]})
    const response = await handleQuickAdd(req('',{method:'POST',body:JSON.stringify({tipo:'despesa',valor:45,descricao:'',meio:`conta:${account}`,categoria:category})}),db)
    expect(response.status).toBe(400)
    expect(db.calls).toHaveLength(0)
  })
})
