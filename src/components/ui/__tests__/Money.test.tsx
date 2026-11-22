import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Money } from '../Money'

const texto = (el: HTMLElement) => (el.textContent ?? '').replace(/\u00a0/g, ' ')

describe('Money showSign', () => {
  it('DESPESA com tipo mostra sinal de menos mesmo com centavos positivos', () => {
    const { container } = render(<Money cents={1500} tipo="DESPESA" showSign />)
    expect(texto(container)).toMatch(/^−R\$ 15,00$/)
  })
  it('RECEITA com tipo mostra sinal de mais', () => {
    const { container } = render(<Money cents={1500} tipo="RECEITA" showSign />)
    expect(texto(container)).toMatch(/^\+R\$ 15,00$/)
  })
  it('sem tipo, o sinal vem dos centavos (negativo)', () => {
    const { container } = render(<Money cents={-1500} showSign />)
    expect(texto(container)).toMatch(/^−R\$ 15,00$/)
  })
  it('sem tipo, positivo mostra +', () => {
    const { container } = render(<Money cents={1500} showSign />)
    expect(texto(container)).toMatch(/^\+R\$ 15,00$/)
  })
})
