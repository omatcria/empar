import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Category } from '@/domain/types'
import { CategoryCombobox } from '../CategoryCombobox'

function cat(id: string, nome: string, pai: string | null = null): Category {
  return {
    id, nome, categoria_pai_id: pai, chave: null, contexto: 'pessoal', cor: '#000000',
    created_at: '', icone: 'tag', sistema: false, tipo: 'despesa', updated_at: '',
    user_id: 'u', workspace_id: 'w',
  } as Category
}
const cats = [cat('a', 'Alimentação'), cat('r', 'Restaurante', 'a'), cat('t', 'Transporte')]

describe('CategoryCombobox', () => {
  it('busca mantém a subcategoria recuada sob a mãe', () => {
    render(<CategoryCombobox value="" onChange={vi.fn()} categories={cats} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'rest' } })
    const sub = screen.getByText('Restaurante').closest('button')!
    expect(sub).toHaveAttribute('data-depth', '1')
    expect(screen.getByText('Alimentação').closest('button')).toHaveAttribute('data-depth', '0')
    expect(screen.queryByText('Transporte')).toBeNull()
  })

  it('botão fechado mostra Mãe › Sub', () => {
    const onChange = vi.fn()
    const { rerender } = render(<CategoryCombobox value="" onChange={onChange} categories={cats} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'rest' } })
    fireEvent.click(screen.getByText('Restaurante'))
    expect(onChange).toHaveBeenCalledWith('r')
    rerender(<CategoryCombobox value="r" onChange={onChange} categories={cats} />)
    expect(screen.getByRole('button')).toHaveTextContent('Alimentação › Restaurante')
  })
})
