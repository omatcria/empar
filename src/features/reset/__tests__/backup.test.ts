import { expect, it, vi } from 'vitest'
import { exportBackup } from '../backup'
import { useData } from '@/store/data'
import { useDebts } from '@/store/debts'
import { useWishlist } from '@/store/wishlist'
import { supabase } from '@/lib/supabase'

it('inclui recorrências e histórico completo no backup', async () => {
  const capture = vi.fn((_blob: Blob) => 'blob:test')
  vi.stubGlobal('URL', { createObjectURL: capture, revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const rows = Array.from({length:1000}, (_,i)=>({id:String(i)}))
  const range = vi.fn().mockResolvedValueOnce({data:rows,error:null}).mockResolvedValueOnce({data:[{id:'older'}],error:null})
  vi.spyOn(supabase,'from').mockReturnValue({select:()=>({eq:()=>({order:()=>({range})})})} as never)
  vi.spyOn(supabase.storage, 'from').mockReturnValue({download:async()=>({data:new Blob(['foto'],{type:'image/png'}),error:null})} as never)
  useDebts.setState({loaded:true}); useWishlist.setState({loaded:true, items:[{imagem_url:'wishlist-storage:ws/image'} as never]})
  try {
    await exportBackup({ ...useData.getState(), workspaceId:'ws', recurrences: [{ id: 'recorrencia-teste' }] } as ReturnType<typeof useData.getState>)
    const blob = capture.mock.calls[0][0] as Blob
    const text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob) })
    const payload=JSON.parse(text)
    expect(payload.recurrences).toEqual([{ id: 'recorrencia-teste' }])
    expect(payload.wishlistHistory).toHaveLength(1001)
    expect(payload.wishlistImages).toEqual([{path:'ws/image',dataUrl:'data:image/png;base64,Zm90bw=='}])
  } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); useDebts.getState().reset(); useWishlist.getState().reset() }
})
