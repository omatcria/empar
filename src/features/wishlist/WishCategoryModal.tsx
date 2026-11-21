import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { Field, TextInput, Select } from '@/components/ui/form'
import { CATEGORY_ICONS, CategoryIcon } from '@/domain/icons-catalog'
import { PALETTE } from '@/domain/palette'
import { useWishlist } from '@/store/wishlist'
import type { WishlistCategory } from '@/domain/types'

export function WishCategoryModal({ onClose }: { onClose:()=>void }) {
 const {categories,addCategory,updateCategory,deleteCategory}=useWishlist()
 const [editing,setEditing]=useState<WishlistCategory|null>(null),[name,setName]=useState(''),[icon,setIcon]=useState('tag'),[color,setColor]=useState(PALETTE[0]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function save(){if(!name.trim())return;setBusy(true);setError('');try{if(editing)await updateCategory(editing.id,{nome:name.trim(),icone:icon,cor:color});else await addCategory({nome:name.trim(),icone:icon,cor:color});setEditing(null);setName('')}catch(e){setError(e instanceof Error?e.message:'Erro ao salvar categoria')}finally{setBusy(false)}}
 return <Modal open onClose={onClose} title="Categorias de desejos" footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}><div className="space-y-4"><div className="space-y-2">{categories.map(c=><div key={c.id} className="flex items-center gap-2 text-sm"><span style={{color:c.cor}}><CategoryIcon name={c.icone} className="size-5"/></span><span className="flex-1">{c.nome}</span><Button size="sm" variant="ghost" onClick={()=>{setEditing(c);setName(c.nome);setIcon(c.icone);setColor(c.cor)}}>Editar</Button><Button size="sm" variant="ghost" onClick={()=>{if(confirm(`Excluir categoria ${c.nome}?`))void deleteCategory(c.id).catch(()=>setError('Não foi possível excluir.'))}}>Excluir</Button></div>)}</div><Field label={editing?'Renomear categoria':'Nova categoria'} htmlFor="wish-category-name"><TextInput id="wish-category-name" value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Ícone" htmlFor="wish-category-icon"><Select id="wish-category-icon" value={icon} onChange={e=>setIcon(e.target.value)}>{CATEGORY_ICONS.map(i=><option key={i.key} value={i.key}>{i.key}</option>)}</Select></Field><div className="flex flex-wrap gap-2">{PALETTE.map(c=><button key={c} type="button" title={c} aria-label={`Cor ${c}`} aria-pressed={c===color} onClick={()=>setColor(c)} className="size-7 rounded-full border-2" style={{background:c,borderColor:c===color?'black':'transparent'}}/>)}</div>{error&&<p role="alert" className="text-expense text-sm">{error}</p>}<Button disabled={!name.trim()||busy} onClick={()=>void save()}>{editing?'Salvar categoria':'Adicionar categoria'}</Button>{editing&&<Button variant="ghost" onClick={()=>{setEditing(null);setName('')}}>Cancelar edição</Button>}</div></Modal>
}
