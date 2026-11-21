import { cn } from '@/lib/cn'
import { BANK_LOGO_SVG } from './bank-logos'

export interface Bank {
  id: string
  nome: string
  cor: string
  short: string
  /** Texto escuro (para cores de marca claras). */
  dark?: boolean
}

/** Principais bancos do Brasil (marca por cor + sigla). */
export const BANKS: Bank[] = [
  { id: 'nubank', nome: 'Nubank', cor: '#820AD1', short: 'Nu' },
  { id: 'nubank-pj', nome: 'Nu Empresas', cor: '#820AD1', short: 'Nu' },
  { id: 'inter', nome: 'Inter', cor: '#FF7A00', short: 'in' },
  { id: 'inter-pj', nome: 'Inter Empresas', cor: '#FF7A00', short: 'in' },
  { id: 'itau', nome: 'Itaú', cor: '#EC7000', short: 'Itaú' },
  { id: 'itau-pj', nome: 'Itaú Empresas', cor: '#003399', short: 'Itaú' },
  { id: 'bradesco', nome: 'Bradesco', cor: '#CC092F', short: 'Bra' },
  { id: 'bb', nome: 'Banco do Brasil', cor: '#FAE128', short: 'BB', dark: true },
  { id: 'caixa', nome: 'Caixa Econômica', cor: '#0070AF', short: 'CX' },
  { id: 'mercadopago', nome: 'Mercado Pago', cor: '#00B1EA', short: 'MP' },
  { id: 'c6', nome: 'C6 Bank', cor: '#1D1D1B', short: 'C6' },
  { id: 'picpay', nome: 'PicPay', cor: '#11C76F', short: 'PP' },
  { id: 'neon', nome: 'Neon', cor: '#00E5D1', short: 'Ne', dark: true },
  { id: 'next', nome: 'Next', cor: '#00A868', short: 'Nx' },
  { id: 'santander', nome: 'Santander', cor: '#EC0000', short: 'Sa' },
  { id: 'will', nome: 'Will Bank', cor: '#FFE600', short: 'Wi', dark: true },
  { id: 'cora', nome: 'Cora', cor: '#FE3E6D', short: 'Co' },
  { id: 'stone', nome: 'Stone', cor: '#00A868', short: 'St' },
  { id: 'infinitepay', nome: 'InfinitePay', cor: '#00EE26', short: 'IP', dark: true },
  { id: 'pagbank', nome: 'PagBank', cor: '#41B06E', short: 'PB' },
  { id: 'btg', nome: 'BTG Pactual', cor: '#001E61', short: 'BTG' },
  { id: 'sicoob', nome: 'Sicoob', cor: '#003641', short: 'Sic' },
  { id: 'sicredi', nome: 'Sicredi', cor: '#146E37', short: 'Sic' },
  { id: 'pan', nome: 'Banco Pan', cor: '#0AB2F9', short: 'Pan' },
]

const MAP = new Map(BANKS.map((b) => [b.id, b]))
export function bankById(id?: string | null): Bank | undefined {
  return id ? MAP.get(id) : undefined
}

/** Opções da fileira de cores: a cor do banco vem primeiro quando não está na paleta. */
export function colorChoices(
  bancoId: string | null | undefined,
  palette: readonly string[],
): { cor: string; doBanco: boolean }[] {
  const list = palette.map((cor) => ({ cor, doBanco: false }))
  const bankCor = bankById(bancoId)?.cor
  if (bankCor && !palette.some((p) => p.toLowerCase() === bankCor.toLowerCase())) {
    list.unshift({ cor: bankCor, doBanco: true })
  }
  return list
}

/**
 * Logos oficiais (símbolo) para os bancos que temos SVG.
 * Bancos "-pj" reaproveitam o logo da versão principal.
 * Renderizados como data-URI em <img> para isolar os estilos internos do SVG.
 */
const LOGO_ALIAS: Record<string, string> = {
  'nubank-pj': 'nubank',
  'inter-pj': 'inter',
  'itau-pj': 'itau',
}
const LOGO_URI = new Map<string, string>()
for (const [id, svg] of Object.entries(BANK_LOGO_SVG)) {
  LOGO_URI.set(id, `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
}
function bankLogoUri(id?: string | null): string | undefined {
  if (!id) return undefined
  const key = LOGO_ALIAS[id] ?? id
  return LOGO_URI.get(key)
}
export function hasBankLogo(id?: string | null): boolean {
  return !!bankLogoUri(id)
}

/** Logo do banco em tile claro; cai para a sigla colorida quando não há SVG. */
export function BankBadge({
  id,
  className,
}: {
  id?: string | null
  className?: string
}) {
  const b = bankById(id)
  if (!b) return null
  const logo = bankLogoUri(id)
  if (logo) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden rounded-xl border border-app-border bg-white p-1',
          className,
        )}
        title={b.nome}
      >
        <img src={logo} alt={b.nome} className="h-full w-full object-contain" />
      </span>
    )
  }
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-xl font-bold leading-none', className)}
      style={{ background: b.cor, color: b.dark ? '#1c1c22' : '#ffffff' }}
      title={b.nome}
    >
      {b.short}
    </span>
  )
}

/** Grade de seleção de banco (+ opção "Outro"). */
export function BankPicker({
  value,
  onChange,
}: {
  value?: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'flex h-11 items-center justify-center rounded-xl border text-xs font-medium',
          !value
            ? 'border-pessoal bg-pessoal-soft text-pessoal-strong'
            : 'border-app-border text-app-muted hover:bg-app-surface-2',
        )}
      >
        Outro
      </button>
      {BANKS.map((b) => {
        const logo = bankLogoUri(b.id)
        const selected = value === b.id
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onChange(b.id)}
            title={b.nome}
            className={cn(
              'flex h-11 items-center justify-center overflow-hidden rounded-xl border transition-transform',
              logo ? 'border-app-border bg-white p-1.5' : 'border-transparent',
              selected ? 'ring-2 ring-app-fg ring-offset-2 ring-offset-app-surface scale-105' : '',
            )}
            style={logo ? undefined : { background: b.cor, color: b.dark ? '#1c1c22' : '#ffffff' }}
          >
            {logo ? (
              <img src={logo} alt={b.nome} className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm font-bold leading-none">{b.short}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
