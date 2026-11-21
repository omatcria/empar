import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Select } from '../Select'

/** Três opções simples, valor inicial "a". */
function renderBasic(onChange = vi.fn(), value: string = 'a') {
  render(
    <Select id="sel" value={value} onChange={onChange}>
      <option value="a">Alfa</option>
      <option value="b">Beta</option>
      <option value="c">Gama</option>
    </Select>,
  )
  return { onChange, trigger: screen.getByRole('combobox') }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Select', () => {
  it('abre ao clicar e lista as opções', () => {
    const { trigger } = renderBasic()
    expect(trigger).toHaveTextContent('Alfa')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.click(trigger)

    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getAllByRole('option')).toHaveLength(3)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    // a opção atual vem marcada
    expect(screen.getByRole('option', { name: 'Alfa' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false')
  })

  it('renderiza o painel num portal em document.body', () => {
    const { trigger } = renderBasic()
    fireEvent.click(trigger)
    const panel = screen.getByRole('listbox').closest('[data-placement]') as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.parentElement).toBe(document.body)
    expect(panel.style.position).toBe('fixed')
  })

  it('clicar numa opção chama onChange com e.target.value e fecha', () => {
    const { trigger, onChange } = renderBasic()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe('b')
    expect(onChange.mock.calls[0][0].target.id).toBe('sel')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('teclado: ArrowDown + Enter seleciona; Escape fecha sem mudar', () => {
    const { trigger, onChange } = renderBasic()
    trigger.focus()

    // ArrowDown com o painel fechado abre, mantendo a opção atual ativa
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const alfa = screen.getByRole('option', { name: 'Alfa' })
    expect(trigger).toHaveAttribute('aria-activedescendant', alfa.id)

    // ArrowDown move para a próxima; Enter seleciona e fecha
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const beta = screen.getByRole('option', { name: 'Beta' })
    expect(trigger).toHaveAttribute('aria-activedescendant', beta.id)
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe('b')
    expect(screen.queryByRole('listbox')).toBeNull()

    // Reabre, navega e Escape fecha sem chamar onChange de novo
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('teclado: Home/End e digitação saltam para a opção', () => {
    const { trigger, onChange } = renderBasic()
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'End' })
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Gama' }).id)
    fireEvent.keyDown(trigger, { key: 'Home' })
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Alfa' }).id)
    fireEvent.keyDown(trigger, { key: 'b' })
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Beta' }).id)
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange.mock.calls[0][0].target.value).toBe('b')
  })

  it('teclado: Espaço abre e seleciona a opção ativa', () => {
    const { trigger, onChange } = renderBasic()
    trigger.focus()
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(onChange.mock.calls[0][0].target.value).toBe('b')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('Escape não propaga para o documento (não fecha o Modal por trás)', () => {
    const { trigger } = renderBasic()
    const docSpy = vi.fn()
    document.addEventListener('keydown', docSpy)
    try {
      fireEvent.click(trigger)
      fireEvent.keyDown(trigger, { key: 'Escape' })
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(docSpy).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', docSpy)
    }
  })

  it('Tab fecha sem mudar', () => {
    const { trigger, onChange } = renderBasic()
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Tab' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fecha ao clicar fora', () => {
    const { trigger, onChange } = renderBasic()
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('optgroup vira cabeçalho não selecionável', () => {
    const onChange = vi.fn()
    render(
      <Select value="p1" onChange={onChange} aria-label="Conta">
        <optgroup label="Pessoal">
          <option value="p1">Nubank</option>
          <option value="p2">Itaú</option>
        </optgroup>
        <optgroup label="Empresarial">
          <option value="e1">Inter PJ</option>
        </optgroup>
      </Select>,
    )
    fireEvent.click(screen.getByRole('combobox'))
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getAllByRole('option')).toHaveLength(3)

    const header = within(listbox).getByText('Empresarial')
    expect(header).not.toHaveAttribute('role', 'option')
    expect(header.closest('[role="option"]')).toBeNull()
    expect(within(listbox).getAllByRole('group')).toHaveLength(2)

    fireEvent.click(header)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    // teclado pula o cabeçalho: Itaú → Inter PJ
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange.mock.calls[0][0].target.value).toBe('e1')
  })

  it('option disabled não é selecionável', () => {
    const onChange = vi.fn()
    render(
      <Select value="a" onChange={onChange}>
        <option value="a">Alfa</option>
        <option value="b" disabled>
          Beta
        </option>
        <option value="c">Gama</option>
      </Select>,
    )
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    const beta = screen.getByRole('option', { name: 'Beta' })
    expect(beta).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(beta)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    // teclado pula a desabilitada: Alfa → Gama
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Gama' }).id)
  })

  it('value numérico (3) mostra o rótulo da option "3"', () => {
    const onChange = vi.fn()
    render(
      <Select id="parc" value={3} onChange={onChange}>
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {n}x
          </option>
        ))}
      </Select>,
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('3x')
    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: '3x' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('option', { name: '4x' }))
    expect(onChange.mock.calls[0][0].target.value).toBe('4')
  })

  it('aceita fragments, arrays e filhos condicionais; valor ausente = rótulo', () => {
    const onChange = vi.fn()
    const extra = false
    render(
      <Select value="" onChange={onChange}>
        {extra && <option value="x">Nunca</option>}
        <option value="">— nenhuma —</option>
        <>
          <option>Sem valor</option>
          {['um', 'dois'].map((v) => (
            <option key={v} value={v}>
              {v.toUpperCase()}
            </option>
          ))}
        </>
        {null}
      </Select>,
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('— nenhuma —')
    fireEvent.click(trigger)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '— nenhuma —',
      'Sem valor',
      'UM',
      'DOIS',
    ])
    fireEvent.click(screen.getByRole('option', { name: 'Sem valor' }))
    expect(onChange.mock.calls[0][0].target.value).toBe('Sem valor')
  })

  it('sem opção correspondente mostra o placeholder', () => {
    render(
      <Select value="zzz" placeholder="Escolha..." onChange={() => {}}>
        <option value="a">Alfa</option>
      </Select>,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Escolha...')
  })

  it('busca aparece com mais de 8 opções e filtra por texto sem acento', () => {
    const labels = ['Alimentação', 'Crédito', 'Débito', 'Educação', 'Lazer', 'Moradia', 'Saúde', 'Transporte']

    // 8 opções: sem busca
    const { unmount } = render(
      <Select value="0" onChange={() => {}}>
        {labels.map((l, i) => (
          <option key={l} value={String(i)}>
            {l}
          </option>
        ))}
      </Select>,
    )
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('textbox')).toBeNull()
    unmount()

    // 9 opções: com busca
    const onChange = vi.fn()
    render(
      <Select value="8" onChange={onChange}>
        {[...labels, 'Viagem'].map((l, i) => (
          <option key={l} value={String(i)}>
            {l}
          </option>
        ))}
      </Select>,
    )
    fireEvent.click(screen.getByRole('combobox'))
    const search = screen.getByRole('textbox')
    expect(search).toHaveFocus()

    fireEvent.change(search, { target: { value: 'credito' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Crédito'])

    fireEvent.change(search, { target: { value: 'ÇÃO' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Alimentação', 'Educação'])

    // Enter na busca seleciona a primeira opção filtrada
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange.mock.calls[0][0].target.value).toBe('0')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('abre para cima quando falta espaço', () => {
    const { trigger } = renderBasic()
    const h = window.innerHeight
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: h - 64,
      top: h - 64,
      bottom: h - 20,
      left: 10,
      right: 210,
      width: 200,
      height: 44,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(trigger)
    const panel = screen.getByRole('listbox').closest('[data-placement]') as HTMLElement
    expect(panel).toHaveAttribute('data-placement', 'top')
    expect(panel.style.width).toBe('200px')
  })

  it('abre para baixo quando há espaço', () => {
    const { trigger } = renderBasic()
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 100,
      top: 100,
      bottom: 144,
      left: 10,
      right: 210,
      width: 200,
      height: 44,
      toJSON: () => ({}),
    } as DOMRect)
    fireEvent.click(trigger)
    const panel = screen.getByRole('listbox').closest('[data-placement]') as HTMLElement
    expect(panel).toHaveAttribute('data-placement', 'bottom')
  })

  it('disabled não abre', () => {
    const onChange = vi.fn()
    render(
      <Select value="a" onChange={onChange} disabled>
        <option value="a">Alfa</option>
        <option value="b">Beta</option>
      </Select>,
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeDisabled()
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('label com htmlFor aponta para o gatilho', () => {
    render(
      <>
        <label htmlFor="cat">Categoria</label>
        <Select id="cat" value="a" onChange={() => {}}>
          <option value="a">Alfa</option>
        </Select>
      </>,
    )
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveAttribute('id', 'cat')
  })
})
