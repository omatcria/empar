import { describe, it, expect, vi } from 'vitest'
const lookup = vi.hoisted(() => vi.fn())
vi.mock('node:dns/promises', () => ({ lookup, default: { lookup } }))
import { fetchProduct } from '../../../supabase/functions/_shared/fetch-product'

describe('leitor de produtos: segurança de rede', () => {
  it('recusa DNS que aponte para a rede interna antes de conectar', async () => {
    lookup.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }])
    const result = await fetchProduct('https://loja.exemplo.com/item')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.motivo).toMatch(/não permitido/i)
  })
  it('recusa resolução DNS indisponível', async () => {
    lookup.mockRejectedValueOnce(new Error('DNS indisponível'))
    const result = await fetchProduct('https://loja.exemplo.com/item')
    expect(result.ok).toBe(false)
  })
})


it('conecta ao IP validado e interpreta resposta HTTP fragmentada', async () => {
  lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
  const bytes = new TextEncoder().encode('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nTransfer-Encoding: chunked\r\n\r\n2a\r\n<html><title>Produto seguro</title></html>\r\n0\r\n\r\n')
  let offset = 0
  const conn = { read: vi.fn(async (buffer: Uint8Array) => { if(offset >= bytes.length) return null; const part=bytes.subarray(offset, Math.min(offset+7,bytes.length)); buffer.set(part); offset+=part.length; return part.length }), write: vi.fn(async (b: Uint8Array)=>b.length), close: vi.fn() }
  const connect = vi.fn(async () => conn), startTls=vi.fn(async () => conn)
  vi.stubGlobal('Deno', { connect, startTls })
  try {
    const result=await fetchProduct('https://loja.exemplo.com/item')
    expect(connect).toHaveBeenCalledWith({hostname:'93.184.216.34',port:443})
    expect(startTls).toHaveBeenCalledWith(conn,{hostname:'loja.exemplo.com'})
    expect(result).toMatchObject({ok:true,product:{titulo:'Produto seguro'}})
  } finally { vi.unstubAllGlobals() }
})


it('informa quando a loja redireciona para verificação de conta', async () => {
  lookup.mockResolvedValueOnce([{ address:'93.184.216.34', family:4 }])
  const bytes=new TextEncoder().encode('HTTP/1.1 302 Found\r\nLocation: https://loja.exemplo.com/gz/account-verification\r\nContent-Length: 0\r\n\r\n')
  let offset=0
  const conn={read:vi.fn(async (b:Uint8Array)=>{if(offset>=bytes.length)return null; b.set(bytes);offset=bytes.length;return bytes.length}),write:vi.fn(async (b:Uint8Array)=>b.length),close:vi.fn()}
  vi.stubGlobal('Deno',{connect:vi.fn(async()=>conn),startTls:vi.fn(async()=>conn)})
  try { const result=await fetchProduct('https://loja.exemplo.com/item');expect(result.ok).toBe(false);if(!result.ok)expect(result.motivo).toMatch(/verificação/) } finally { vi.unstubAllGlobals() }
})
