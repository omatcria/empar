import {
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from '@/components/icons'
import { cn } from '@/lib/cn'
import { controlBase } from './form'

/* ============================================================================
 * Select padronizado — substitui o <select> nativo mantendo a mesma API
 * (value / onChange(e) com e.target.value / filhos <option> e <optgroup>).
 * Painel em portal com posição fixa (não é cortado pelo Modal que rola),
 * abre para cima quando falta espaço, busca automática com mais de 8 opções.
 * ========================================================================== */

export interface SelectChangeEvent {
  target: { value: string; id?: string }
}

export interface SelectProps {
  id?: string
  name?: string
  value?: string | number
  onChange?: (e: SelectChangeEvent) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
  children: ReactNode
}

/* ---------------- constantes de layout ---------------- */
const GAP = 6 // distância gatilho ↔ painel
const MARGIN = 8 // folga mínima até a borda da janela
const MAX_H = 288 // 18rem
const MIN_H = 120 // nunca espremer o painel abaixo disso
const MIN_W = 160 // gatilhos estreitos (ex.: parcelas) ainda ganham um painel legível
const ROW_H = 36 // altura estimada de uma linha (para decidir a direção)
const SEARCH_H = 45
const PAD = 14
const SEARCH_THRESHOLD = 8 // busca aparece com MAIS de 8 opções
const TYPEAHEAD_MS = 500

/* ---------------- parsing dos filhos ---------------- */
interface ParsedOption {
  index: number
  value: string
  label: string
  disabled: boolean
  group: number | null
}
interface ParsedGroup {
  index: number
  label: string
}
interface Parsed {
  options: ParsedOption[]
  groups: ParsedGroup[]
}

type OptionLikeProps = {
  value?: string | number | readonly string[]
  label?: string
  disabled?: boolean
  children?: ReactNode
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return String(node)
  }
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

function parseChildren(children: ReactNode): Parsed {
  const options: ParsedOption[] = []
  const groups: ParsedGroup[] = []

  const walk = (node: ReactNode, group: number | null, groupDisabled: boolean) => {
    if (node == null || typeof node === 'boolean') return
    if (Array.isArray(node)) {
      for (const n of node) walk(n, group, groupDisabled)
      return
    }
    if (!isValidElement(node)) return
    const props = node.props as OptionLikeProps
    if (node.type === Fragment) {
      walk(props.children, group, groupDisabled)
    } else if (node.type === 'optgroup') {
      const g: ParsedGroup = { index: groups.length, label: String(props.label ?? '') }
      groups.push(g)
      walk(props.children, g.index, groupDisabled || !!props.disabled)
    } else if (node.type === 'option') {
      const label = (props.label ?? textOf(props.children)).replace(/\s+/g, ' ').trim()
      options.push({
        index: options.length,
        value: props.value != null ? String(props.value) : label,
        label,
        disabled: groupDisabled || !!props.disabled,
        group,
      })
    }
  }

  walk(children, null, false)
  return { options, groups }
}

/** Minúsculas e sem acento ("Crédito" → "credito"). */
function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/* ---------------- posicionamento ---------------- */
type Placement = 'top' | 'bottom'
interface PanelPos {
  placement: Placement
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

function computePosition(trigger: HTMLElement, rowCount: number, hasSearch: boolean): PanelPos {
  const r = trigger.getBoundingClientRect()
  const vh = window.innerHeight
  const vw = window.innerWidth
  const estimated = Math.min(MAX_H, rowCount * ROW_H + (hasSearch ? SEARCH_H : 0) + PAD)
  const below = vh - r.bottom - GAP - MARGIN
  const above = r.top - GAP - MARGIN
  const placement: Placement = below < estimated && above > below ? 'top' : 'bottom'
  const maxHeight = Math.max(MIN_H, Math.min(MAX_H, placement === 'top' ? above : below))
  const width = Math.max(r.width, MIN_W)
  const left = Math.max(MARGIN, Math.min(r.left, vw - width - MARGIN))
  return placement === 'top'
    ? { placement, left, width, bottom: vh - r.top + GAP, maxHeight }
    : { placement, left, width, top: r.bottom + GAP, maxHeight }
}

function samePos(a: PanelPos | null, b: PanelPos): boolean {
  return (
    !!a &&
    a.placement === b.placement &&
    a.left === b.left &&
    a.width === b.width &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.maxHeight === b.maxHeight
  )
}

/* ============================================================================ */

export function Select({
  id,
  name,
  value,
  onChange,
  disabled = false,
  required,
  placeholder,
  className,
  'aria-label': ariaLabel,
  children,
}: SelectProps) {
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optionId = (index: number) => `${baseId}-opt-${index}`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const typeBuffer = useRef('')
  const typeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [openState, setOpenState] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [pos, setPos] = useState<PanelPos | null>(null)
  // Só usado quando `value` não é passado (uso não controlado).
  const [innerValue, setInnerValue] = useState<string | undefined>(undefined)

  const isOpen = openState && !disabled
  const { options, groups } = useMemo(() => parseChildren(children), [children])
  const hasSearch = options.length > SEARCH_THRESHOLD

  const current = value !== undefined ? String(value) : (innerValue ?? '')
  const matched = options.find((o) => o.value === current)
  // Sem correspondência: como o <select> nativo (via React), mostra a 1ª opção
  // habilitada — a menos que haja placeholder.
  const shown =
    matched ?? (placeholder === undefined ? options.find((o) => !o.disabled) : undefined)

  const visible = useMemo(() => {
    const q = normalizeText(query.trim())
    return q ? options.filter((o) => normalizeText(o.label).includes(q)) : options
  }, [options, query])
  const navigable = useMemo(() => visible.filter((o) => !o.disabled), [visible])

  /* ---------- abrir / fechar / selecionar ---------- */
  const close = useCallback((focusTrigger: boolean) => {
    setOpenState(false)
    setQuery('')
    typeBuffer.current = ''
    if (focusTrigger) triggerRef.current?.focus()
  }, [])

  const open = (active?: number | null, initialQuery = '') => {
    if (disabled || !triggerRef.current) return
    setPos(computePosition(triggerRef.current, options.length + groups.length, hasSearch))
    setQuery(initialQuery)
    setActiveIndex(
      active !== undefined ? active : (shown?.index ?? options.find((o) => !o.disabled)?.index ?? null),
    )
    setOpenState(true)
    // Sem busca, o teclado é tratado no gatilho (o Safari não foca botão no clique).
    if (!hasSearch) triggerRef.current.focus({ preventScroll: true })
  }

  const select = (o: ParsedOption | undefined) => {
    if (!o || o.disabled) return
    if (o.value !== current) {
      if (value === undefined) setInnerValue(o.value)
      onChange?.({ target: { value: o.value, id } })
    }
    close(true)
  }

  /* ---------- navegação ---------- */
  const move = (delta: 1 | -1) => {
    if (navigable.length === 0) return
    const at = navigable.findIndex((o) => o.index === activeIndex)
    const next =
      at === -1
        ? delta === 1
          ? 0
          : navigable.length - 1
        : Math.min(navigable.length - 1, Math.max(0, at + delta))
    setActiveIndex(navigable[next].index)
  }

  /** Digitação salta para a opção cujo rótulo começa com o que foi digitado. */
  const typeahead = (ch: string): ParsedOption | undefined => {
    clearTimeout(typeTimer.current)
    typeBuffer.current += ch
    typeTimer.current = setTimeout(() => {
      typeBuffer.current = ''
    }, TYPEAHEAD_MS)

    const buf = normalizeText(typeBuffer.current)
    const repeated = buf.length > 1 && [...buf].every((c) => c === buf[0])
    const needle = repeated ? buf[0] : buf
    const list = options.filter((o) => !o.disabled)
    const at = Math.max(0, list.findIndex((o) => o.index === activeIndex))
    // 1ª tecla (ou a mesma repetida) procura a partir da próxima → cicla entre iniciais iguais
    const start = buf.length === 1 || repeated ? at + 1 : at
    const ordered = [...list.slice(start), ...list.slice(0, start)]
    return ordered.find((o) => normalizeText(o.label).startsWith(needle))
  }

  const isPrintable = (e: KeyboardEvent) =>
    e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>, source: 'trigger' | 'search') => {
    if (disabled) return

    if (!isOpen) {
      if (source !== 'trigger') return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      } else if (isPrintable(e)) {
        e.preventDefault()
        if (hasSearch) {
          const first = options.find(
            (o) => !o.disabled && normalizeText(o.label).includes(normalizeText(e.key)),
          )
          open(first?.index ?? null, e.key)
        } else {
          const hit = typeahead(e.key)
          open(hit ? hit.index : undefined)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        if (navigable.length) setActiveIndex(navigable[0].index)
        break
      case 'End':
        e.preventDefault()
        if (navigable.length) setActiveIndex(navigable[navigable.length - 1].index)
        break
      case 'Enter':
        e.preventDefault()
        select(options[activeIndex ?? -1])
        break
      case 'Escape':
        // stopPropagation: o Modal escuta Esc no document — só o Select fecha.
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        // Sem preventDefault: o foco segue para o próximo campo, como no nativo.
        if (source === 'search') triggerRef.current?.focus()
        close(false)
        break
      case ' ':
        if (source === 'search') break // espaço digita na busca
        e.preventDefault()
        if (typeBuffer.current) {
          const hit = typeahead(' ')
          if (hit) setActiveIndex(hit.index)
        } else {
          select(options[activeIndex ?? -1])
        }
        break
      default:
        if (source === 'trigger' && isPrintable(e)) {
          e.preventDefault()
          const hit = typeahead(e.key)
          if (hit) setActiveIndex(hit.index)
        }
    }
  }

  /* ---------- efeitos enquanto aberto ---------- */

  // Desabilitado com o painel aberto: fecha de vez (não reabre sozinho depois).
  useEffect(() => {
    if (disabled) setOpenState(false)
  }, [disabled])

  // Fecha em clique fora (gatilho e painel contam como "dentro").
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      close(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isOpen, close])

  // Reposiciona em scroll (capturado: pega a rolagem interna do Modal) e resize.
  useEffect(() => {
    if (!isOpen) return
    const update = (e?: Event) => {
      if (e && e.target instanceof Node && panelRef.current?.contains(e.target)) return
      const el = triggerRef.current
      if (!el) return
      const next = computePosition(el, options.length + groups.length, hasSearch)
      setPos((prev) => (samePos(prev, next) ? prev : next))
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [isOpen, options.length, groups.length, hasSearch])

  // Foco na busca ao abrir (cursor no fim, para quem abriu digitando).
  useEffect(() => {
    if (!isOpen || !hasSearch) return
    const input = searchRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    const len = input.value.length
    input.setSelectionRange(len, len)
  }, [isOpen, hasSearch])

  // Mantém a opção ativa visível na lista rolável.
  useEffect(() => {
    if (!isOpen || activeIndex == null) return
    const el = document.getElementById(optionId(activeIndex))
    el?.scrollIntoView?.({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeIndex])

  useEffect(() => () => clearTimeout(typeTimer.current), [])

  /* ---------- render ---------- */
  const activeId = isOpen && activeIndex != null && visible.some((o) => o.index === activeIndex)
    ? optionId(activeIndex)
    : undefined

  // Agrupa as opções visíveis em blocos contíguos (sem grupo / por optgroup).
  const segments: Array<{ group: ParsedGroup | null; items: ParsedOption[] }> = []
  for (const o of visible) {
    const g = o.group == null ? null : groups[o.group]
    const last = segments[segments.length - 1]
    if (last && last.group === g) last.items.push(o)
    else segments.push({ group: g, items: [o] })
  }

  const renderOption = (o: ParsedOption) => {
    const isSelected = shown?.index === o.index
    const isActive = activeIndex === o.index
    return (
      <div
        key={o.index}
        id={optionId(o.index)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={o.disabled || undefined}
        data-active={isActive || undefined}
        onMouseMove={() => {
          if (!o.disabled && activeIndex !== o.index) setActiveIndex(o.index)
        }}
        onClick={() => select(o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-app-fg transition-colors',
          o.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-app-surface-2',
          (isActive || isSelected) && !o.disabled && 'bg-app-surface-2',
          isSelected && 'font-medium',
        )}
      >
        <span className="min-w-0 flex-1 break-words">{o.label}</span>
        {isSelected && <Check className="size-4 shrink-0 text-pessoal" />}
      </div>
    )
  }

  const panelStyle: CSSProperties | undefined = pos
    ? {
        position: 'fixed',
        left: pos.left,
        width: pos.width,
        top: pos.top,
        bottom: pos.bottom,
        maxHeight: pos.maxHeight,
      }
    : undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={!hasSearch ? activeId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (isOpen ? close(false) : open())}
        onKeyDown={(e) => handleKeyDown(e, 'trigger')}
        // Firefox dispara click no keyup do Espaço; já tratamos no keydown.
        onKeyUp={(e) => {
          if (e.key === ' ') e.preventDefault()
        }}
        className={cn(
          controlBase,
          'flex items-center justify-between gap-2 text-left cursor-pointer disabled:cursor-not-allowed',
          className,
        )}
      >
        <span className={cn('min-w-0 truncate', !shown && 'text-app-muted')}>
          {shown ? shown.label : (placeholder ?? '')}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-app-muted transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {name && <input type="hidden" name={name} value={shown?.value ?? ''} />}

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            data-placement={pos?.placement ?? 'bottom'}
            style={panelStyle}
            // Clicar no painel não rouba o foco do gatilho/busca (exceto na própria busca).
            onMouseDown={(e) => {
              if (e.target !== searchRef.current) e.preventDefault()
            }}
            className="z-[60] flex flex-col overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-xl"
          >
            {hasSearch && (
              <div className="flex items-center gap-2 border-b border-app-border px-3 py-2 text-app-fg">
                <Search className="size-4 shrink-0 text-app-muted" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const q = e.target.value
                    setQuery(q)
                    const nq = normalizeText(q.trim())
                    const first = options.find(
                      (o) => !o.disabled && (!nq || normalizeText(o.label).includes(nq)),
                    )
                    setActiveIndex(first?.index ?? null)
                  }}
                  onKeyDown={(e) => handleKeyDown(e, 'search')}
                  placeholder="Buscar..."
                  aria-label="Buscar opção"
                  aria-controls={listboxId}
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-base sm:text-sm outline-none placeholder:text-app-muted"
                />
              </div>
            )}
            <div
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              aria-labelledby={!ariaLabel && id ? id : undefined}
              className="flex-1 space-y-0.5 overflow-y-auto p-1.5"
            >
              {visible.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-app-muted">
                  Nenhuma opção encontrada.
                </p>
              ) : (
                segments.map((s, i) =>
                  s.group ? (
                    <div
                      key={`g-${s.group.index}-${i}`}
                      role="group"
                      aria-labelledby={`${baseId}-grp-${s.group.index}`}
                      className="space-y-0.5"
                    >
                      <div
                        id={`${baseId}-grp-${s.group.index}`}
                        role="presentation"
                        className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-app-muted"
                      >
                        {s.group.label}
                      </div>
                      {s.items.map(renderOption)}
                    </div>
                  ) : (
                    <Fragment key={`s-${i}`}>{s.items.map(renderOption)}</Fragment>
                  ),
                )
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
