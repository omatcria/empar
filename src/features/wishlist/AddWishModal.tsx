import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { Field, TextInput, Textarea, MoneyInput, Select } from '@/components/ui/form'
import { useWishlist } from '@/store/wishlist'
import type { WishlistItem } from '@/domain/types'
import { WishCategoryModal } from './WishCategoryModal'
import { removeWishImage, uploadWishImage, useWishImage, validateWishImage } from './wishImages'

const validUrl = (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }

export function AddWishModal({ item, onClose }: { item?: WishlistItem; onClose: () => void }) {
  const { categories, scrape, addItem, updateItem } = useWishlist()
  const [url, setUrl] = useState(item?.url ?? '')
  const [title, setTitle] = useState(item?.titulo ?? '')
  const [desc, setDesc] = useState(item?.descricao ?? '')
  const [image, setImage] = useState(item?.imagem_url ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [shop, setShop] = useState(item?.loja ?? '')
  const [category, setCategory] = useState(item?.category_id ?? '')
  const [price, setPrice] = useState(item?.preco_atual_centavos ?? 0)
  const [target, setTarget] = useState(item?.preco_alvo_centavos ?? 0)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [managing, setManaging] = useState(false)
  const latestUrl = useRef(url)
  const readId = useRef(0)
  const signedImage = useWishImage(image)
  latestUrl.current = url
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  useEffect(() => {
    if (!validUrl(url) || url === item?.url) return
    const timer = setTimeout(() => void read(url), 900)
    return () => clearTimeout(timer)
    // A leitura acompanha apenas mudanças no endereço, não nos campos preenchidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])
  useEffect(() => () => { readId.current++ }, [])

  function chooseFile(next: File | undefined) {
    if (!next) return
    const reason = validateWishImage(next)
    if (reason) { setError(reason); return }
    setFile(next); setError('')
  }
  function pasteImage(event: ClipboardEvent<HTMLElement>) {
    const copied = Array.from(event.clipboardData.files).find(f => f.type.startsWith('image/'))
      ?? Array.from(event.clipboardData.items ?? []).find(i => i.type.startsWith('image/'))?.getAsFile() ?? undefined
    if (copied) { event.preventDefault(); event.stopPropagation(); chooseFile(copied) }
  }
  async function pasteFromClipboard() {
    if (!navigator.clipboard?.read) { setError('Toque na área de colagem e use a opção Colar do teclado.'); return }
    try {
      const entries = await navigator.clipboard.read()
      const entry = entries.find(e => e.types.some(t => t.startsWith('image/')))
      const type = entry?.types.find(t => t.startsWith('image/'))
      if (!entry || !type) { setError('Não há imagem disponível para colar.'); return }
      const blob = await entry.getType(type)
      chooseFile(new File([blob], 'imagem-colada', { type }))
    } catch { setError('Não foi possível acessar a área de transferência. Toque na área de colagem e use Colar no teclado.') }
  }
  async function read(address = url, browserFallback = false) {
    if (!validUrl(address)) { setError('Informe um link http ou https válido.'); return }
    const id = ++readId.current
    setReading(true); setError('')
    try {
      const r = await scrape(address, browserFallback)
      if (id !== readId.current || latestUrl.current !== address) return
      if (!r.ok) { setError(`Não conseguimos ler esta loja automaticamente — preencha os campos abaixo.${r.motivo ? ` ${r.motivo}` : ''}`); return }
      setTitle(v => v || r.titulo || ''); setDesc(v => v || r.descricao || '')
      setImage(v => v || r.imagem_url || ''); setShop(v => v || r.loja || '')
      setPrice(v => v || r.preco_centavos || 0)
      if (!r.titulo || r.preco_centavos == null || !r.imagem_url) setError('A loja forneceu apenas parte dos dados. Confira e complete os campos abaixo.')
    } finally { if (id === readId.current) setReading(false) }
  }
  async function save() {
    if (!title.trim() || !validUrl(url) || (!file && image && !image.startsWith('wishlist-storage:') && !validUrl(image))) return
    setBusy(true); setError('')
    let uploaded: string | null = null
    try {
      if (file) uploaded = await uploadWishImage(file)
      const fields = { url: url.trim(), titulo: title.trim(), descricao: desc.trim() || null, imagem_url: uploaded ?? (image.trim() || null), loja: shop.trim() || null, category_id: category || null, preco_atual_centavos: price || null, preco_alvo_centavos: target || null }
      if (item) await updateItem(item.id, fields); else await addItem(fields)
      if (item?.imagem_url?.startsWith('wishlist-storage:') && item.imagem_url !== fields.imagem_url) {
        try { await removeWishImage(item.imagem_url) } catch { console.warn('Não foi possível remover a imagem anterior') }
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally { setBusy(false) }
  }
  const imageValid = !image || image.startsWith('wishlist-storage:') || validUrl(image)
  return <><Modal open onClose={onClose} title={item ? 'Editar desejo' : 'Adicionar desejo'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={busy || !title.trim() || !validUrl(url) || (!file && !imageValid)} loading={busy} onClick={() => void save()}>Salvar</Button></>}><div className="space-y-4" onPaste={pasteImage}>
    <Field label="Link do produto" htmlFor="wish-url" required><div className="flex gap-2"><TextInput id="wish-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."/><Button variant="secondary" disabled={busy || reading} onClick={() => void read(url, true)}>{reading ? 'Buscando…' : 'Buscar'}</Button></div></Field>
    {error && <p role="status" className="text-sm text-app-muted">{error}</p>}
    <Field label="Título" htmlFor="wish-title" required><TextInput id="wish-title" value={title} onChange={e => setTitle(e.target.value)}/></Field>
    <Field label="Descrição" htmlFor="wish-desc"><Textarea id="wish-desc" value={desc} onChange={e => setDesc(e.target.value)}/></Field>
    <Field label="Imagem (URL)" htmlFor="wish-image"><TextInput id="wish-image" value={image.startsWith('wishlist-storage:') ? '' : image} onChange={e => { setImage(e.target.value); setFile(null) }} placeholder="https://..."/></Field>
    <Field label="Enviar imagem" htmlFor="wish-upload" hint="JPG, PNG, WebP ou GIF, até 5 MB."><input id="wish-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => chooseFile(e.target.files?.[0])}/></Field>
    <Button size="sm" variant="secondary" onClick={() => void pasteFromClipboard()}>Colar imagem</Button>
    <div contentEditable role="textbox" aria-label="Colar imagem" suppressContentEditableWarning onPaste={pasteImage} className="rounded-xl border border-dashed border-app-border p-3 text-sm text-app-muted" tabIndex={0}>Clique ou toque aqui e cole uma imagem.</div>
    {file && <div className="flex min-w-0 items-center gap-2 text-sm"><span className="min-w-0 truncate">{file.name || 'Imagem colada'}</span><Button size="sm" variant="ghost" onClick={() => setFile(null)}>Remover imagem selecionada</Button></div>}
    {(preview || signedImage) && <img src={preview || signedImage || ''} referrerPolicy="no-referrer" className="h-24 max-w-full object-contain" alt="Prévia"/>}
    {!file && image && <Button size="sm" variant="ghost" onClick={() => setImage('')}>Remover imagem</Button>}
    <Field label="Loja" htmlFor="wish-shop"><TextInput id="wish-shop" value={shop} onChange={e => setShop(e.target.value)}/></Field>
    <Field label="Categoria" htmlFor="wish-cat"><Select id="wish-cat" value={category} onChange={e => setCategory(e.target.value)}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Field>
    <Button size="sm" variant="ghost" onClick={() => setManaging(true)}>Criar ou gerenciar categorias</Button>
    <div className="grid grid-cols-2 gap-3"><Field label="Preço atual" htmlFor="wish-price"><MoneyInput id="wish-price" cents={price} onChangeCents={setPrice}/></Field><Field label="Preço-alvo" htmlFor="wish-target"><MoneyInput id="wish-target" cents={target} onChangeCents={setTarget}/></Field></div>
  </div></Modal>{managing && <WishCategoryModal onClose={() => setManaging(false)}/>}</>
}
