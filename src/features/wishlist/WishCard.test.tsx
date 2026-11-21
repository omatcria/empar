import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WishCard } from './WishCard'
import type { WishlistItem } from '@/domain/types'
describe('WishCard', () => {
  it('mostra variação e abre o produto', () => {
    const onClick = vi.fn()
    const item = { titulo:'Produto teste', loja:'Loja', preco_inicial_centavos:10000, preco_atual_centavos:8000, preco_minimo_centavos:8000, preco_alvo_centavos:9000 } as WishlistItem
    render(<WishCard item={item} onClick={onClick}/>)
    expect(screen.getByText(/20%/)).toBeInTheDocument()
    expect(screen.getByText(/Menor preço/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
