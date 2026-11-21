import { describe,it,expect,vi } from 'vitest'
import { render,screen,fireEvent,waitFor } from '@testing-library/react'
const {scrape,addItem}=vi.hoisted(()=>({scrape:vi.fn(),addItem:vi.fn()}))
vi.mock('@/store/wishlist',()=>({useWishlist:()=>({categories:[],scrape,addItem,updateItem:vi.fn()})}))
import { AddWishModal } from './AddWishModal'
describe('Adicionar desejo',()=>{
 it('permite preencher manualmente quando a leitura falha',async()=>{
  scrape.mockResolvedValue({ok:false,motivo:'Bloqueado'});addItem.mockResolvedValue({id:'1'})
  const close=vi.fn();render(<AddWishModal onClose={close}/>)
  fireEvent.change(screen.getByLabelText(/Link do produto/),{target:{value:'https://loja.example/produto'}})
  fireEvent.click(screen.getByRole('button',{name:'Buscar'}))
  expect(scrape).toHaveBeenCalledWith('https://loja.example/produto', true)
  expect(await screen.findByText(/preencha os campos abaixo/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/Título/),{target:{value:'Produto'}})
  fireEvent.click(screen.getByRole('button',{name:'Salvar'}))
  await waitFor(()=>expect(addItem).toHaveBeenCalledWith(expect.objectContaining({titulo:'Produto',url:'https://loja.example/produto'})))
  expect(close).toHaveBeenCalled()
 })
})


it('aceita uma imagem colada antes de salvar', async()=>{
 const file=new File(['foto'],'produto.png',{type:'image/png'})
 vi.stubGlobal('URL', Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:preview'),revokeObjectURL:vi.fn()}))
 try {
  render(<AddWishModal onClose={()=>{}}/>)
  fireEvent.paste(screen.getByRole('textbox',{name:/colar imagem/i}),{clipboardData:{files:[file],items:[]}})
  expect(await screen.findByText('produto.png')).toBeInTheDocument()
 } finally {vi.unstubAllGlobals()}
})

it('busca automaticamente os dados após informar o link', async()=>{
 scrape.mockReset().mockResolvedValue({ok:true,titulo:'Cadeira',descricao:'Descrição',imagem_url:'https://loja.example/foto.png',preco_centavos:25000,loja:'loja.example'})
 render(<AddWishModal onClose={()=>{}}/>)
 fireEvent.change(screen.getByLabelText(/Link do produto/),{target:{value:'https://loja.example/cadeira'}})
 await waitFor(()=>expect(screen.getByLabelText(/Título/)).toHaveValue('Cadeira'),{timeout:3000})
 expect(scrape).toHaveBeenCalledWith('https://loja.example/cadeira', false)
 await waitFor(()=>expect(screen.getByLabelText(/Preço atual/)).toHaveValue('R$ 250,00'),{timeout:3000})
})
