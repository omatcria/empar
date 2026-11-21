import { cn } from '@/lib/cn'

/**
 * Bandeiras de cartão.
 * SVGs: simple-icons@13.21.0 (CC0), via https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/<slug>.svg
 *  - visa -> 'visa', mastercard -> 'mastercard', amex -> 'americanexpress'
 *  - elo e hipercard NÃO existem no simple-icons: selo desenhado aqui (retângulo arredondado na cor da marca + nome).
 * Os ícones do simple-icons são monocromáticos sem fill; o fill da cor da marca é aplicado no <path>.
 */
export type CardBrandId = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard'

export interface CardBrand {
  id: CardBrandId
  nome: string
  cor: string
  svg: string
}

export const CARD_BRANDS: CardBrand[] = [
  { id: 'visa', nome: 'Visa', cor: '#1A1F71', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#1A1F71\" d=\"M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z\"/></svg>" },
  { id: 'mastercard', nome: 'Mastercard', cor: '#EB001B', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#EB001B\" d=\"M11.343 18.031c.058.049.12.098.181.146-1.177.783-2.59 1.238-4.107 1.238C3.32 19.416 0 16.096 0 12c0-4.095 3.32-7.416 7.416-7.416 1.518 0 2.931.456 4.105 1.238-.06.051-.12.098-.165.15C9.6 7.489 8.595 9.688 8.595 12c0 2.311 1.001 4.51 2.748 6.031zm5.241-13.447c-1.52 0-2.931.456-4.105 1.238.06.051.12.098.165.15C14.4 7.489 15.405 9.688 15.405 12c0 2.31-1.001 4.507-2.748 6.031-.058.049-.12.098-.181.146 1.177.783 2.588 1.238 4.107 1.238C20.68 19.416 24 16.096 24 12c0-4.094-3.32-7.416-7.416-7.416zM12 6.174c-.096.075-.189.15-.28.231C10.156 7.764 9.169 9.765 9.169 12c0 2.236.987 4.236 2.551 5.595.09.08.185.158.28.232.096-.074.189-.152.28-.232 1.563-1.359 2.551-3.359 2.551-5.595 0-2.235-.987-4.236-2.551-5.595-.09-.08-.184-.156-.28-.231z\"/></svg>" },
  { id: 'elo', nome: 'Elo', cor: '#000000', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 40\"><rect width=\"64\" height=\"40\" rx=\"6\" fill=\"#000000\"/><text x=\"32\" y=\"20\" text-anchor=\"middle\" dominant-baseline=\"central\" font-family=\"Arial, Helvetica, sans-serif\" font-weight=\"700\" font-size=\"20\" fill=\"#fff\">elo</text></svg>" },
  { id: 'amex', nome: 'American Express', cor: '#2E77BC', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"#2E77BC\" d=\"M16.015 14.378c0-.32-.135-.496-.344-.622-.21-.12-.464-.135-.81-.135h-1.543v2.82h.675v-1.027h.72c.24 0 .39.024.478.125.12.13.104.38.104.55v.35h.66v-.555c-.002-.25-.017-.376-.108-.516-.06-.08-.18-.18-.33-.234l.02-.008c.18-.072.48-.297.48-.747zm-.87.407l-.028-.002c-.09.053-.195.058-.33.058h-.81v-.63h.824c.12 0 .24 0 .33.05.098.048.156.147.15.255 0 .12-.045.215-.134.27zM20.297 15.837H19v.6h1.304c.676 0 1.05-.278 1.05-.884 0-.28-.066-.448-.187-.582-.153-.133-.392-.193-.73-.207l-.376-.015c-.104 0-.18 0-.255-.03-.09-.03-.15-.105-.15-.21 0-.09.017-.166.09-.21.083-.046.177-.066.272-.06h1.23v-.602h-1.35c-.704 0-.958.437-.958.84 0 .9.776.855 1.407.87.104 0 .18.015.225.06.046.03.082.106.082.18 0 .077-.035.15-.08.18-.06.053-.15.07-.277.07zM0 0v10.096L.81 8.22h1.75l.225.464V8.22h2.043l.45 1.02.437-1.013h6.502c.295 0 .56.057.756.236v-.23h1.787v.23c.307-.17.686-.23 1.12-.23h2.606l.24.466v-.466h1.918l.254.465v-.466h1.858v3.948H20.87l-.36-.6v.585h-2.353l-.256-.63h-.583l-.27.614h-1.213c-.48 0-.84-.104-1.08-.24v.24h-2.89v-.884c0-.12-.03-.12-.105-.135h-.105v1.036H6.067v-.48l-.21.48H4.69l-.202-.48v.465H2.235l-.256-.624H1.4l-.256.624H0V24h23.786v-7.108c-.27.135-.613.18-.973.18H21.09v-.255c-.21.165-.57.255-.914.255H14.71v-.9c0-.12-.018-.12-.12-.12h-.075v1.022h-1.8v-1.066c-.298.136-.643.15-.928.136h-.214v.915h-2.18l-.54-.617-.57.6H4.742v-3.93h3.61l.518.602.554-.6h2.412c.28 0 .74.03.942.225v-.24h2.177c.202 0 .644.045.903.225v-.24h3.265v.24c.163-.164.508-.24.803-.24h1.89v.24c.194-.15.464-.24.84-.24h1.176V0H0zM21.156 14.955c.004.005.006.012.01.016.01.01.024.01.032.02l-.042-.035zM23.828 13.082h.065v.555h-.065zM23.865 15.03v-.005c-.03-.025-.046-.048-.075-.07-.15-.153-.39-.215-.764-.225l-.36-.012c-.12 0-.194-.007-.27-.03-.09-.03-.15-.105-.15-.21 0-.09.03-.16.09-.204.076-.045.15-.05.27-.05h1.223v-.588h-1.283c-.69 0-.96.437-.96.84 0 .9.78.855 1.41.87.104 0 .18.015.224.06.046.03.076.106.076.18 0 .07-.034.138-.09.18-.045.056-.136.07-.27.07h-1.288v.605h1.287c.42 0 .734-.118.9-.36h.03c.09-.134.135-.3.135-.523 0-.24-.045-.39-.135-.526zM18.597 14.208v-.583h-2.235V16.458h2.235v-.585h-1.57v-.57h1.533v-.584h-1.532v-.51M13.51 8.787h.685V11.6h-.684zM13.126 9.543l-.007.006c0-.314-.13-.5-.34-.624-.217-.125-.47-.135-.81-.135H10.43v2.82h.674v-1.034h.72c.24 0 .39.03.487.12.122.136.107.378.107.548v.354h.677v-.553c0-.25-.016-.375-.11-.516-.09-.107-.202-.19-.33-.237.172-.07.472-.3.472-.75zm-.855.396h-.015c-.09.054-.195.056-.33.056H11.1v-.623h.825c.12 0 .24.004.33.05.09.04.15.128.15.25s-.047.22-.134.266zM15.92 9.373h.632v-.6h-.644c-.464 0-.804.105-1.02.33-.286.3-.362.69-.362 1.11 0 .512.123.833.36 1.074.232.238.645.31.97.31h.78l.255-.627h1.39l.262.627h1.36v-2.11l1.272 2.11h.95l.002.002V8.786h-.684v1.963l-1.18-1.96h-1.02V11.4L18.11 8.744h-1.004l-.943 2.22h-.3c-.177 0-.362-.03-.468-.134-.125-.15-.186-.36-.186-.662 0-.285.08-.51.194-.63.133-.135.272-.165.516-.165zm1.668-.108l.464 1.118v.002h-.93l.466-1.12zM2.38 10.97l.254.628H4V9.393l.972 2.205h.584l.973-2.202.015 2.202h.69v-2.81H6.118l-.807 1.904-.876-1.905H3.343v2.663L2.205 8.787h-.997L.01 11.597h.72l.26-.626h1.39zm-.688-1.705l.46 1.118-.003.002h-.915l.457-1.12zM11.856 13.62H9.714l-.85.923-.825-.922H5.346v2.82H8l.855-.932.824.93h1.302v-.94h.838c.6 0 1.17-.164 1.17-.945l-.006-.003c0-.78-.598-.93-1.128-.93zM7.67 15.853l-.014-.002H6.02v-.557h1.47v-.574H6.02v-.51H7.7l.733.82-.764.824zm2.642.33l-1.03-1.147 1.03-1.108v2.253zm1.553-1.258h-.885v-.717h.885c.24 0 .42.098.42.344 0 .243-.15.372-.42.372zM9.967 9.373v-.586H7.73V11.6h2.237v-.58H8.4v-.564h1.527V9.88H8.4v-.507\"/></svg>" },
  { id: 'hipercard', nome: 'Hipercard', cor: '#B3131B', svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 40\"><rect width=\"64\" height=\"40\" rx=\"6\" fill=\"#B3131B\"/><text x=\"32\" y=\"20\" text-anchor=\"middle\" dominant-baseline=\"central\" font-family=\"Arial, Helvetica, sans-serif\" font-weight=\"700\" font-size=\"11\" fill=\"#fff\">Hipercard</text></svg>" },
]

const URI = new Map<CardBrandId, string>(
  CARD_BRANDS.map((b) => [b.id, `data:image/svg+xml;utf8,${encodeURIComponent(b.svg)}`]),
)

/** Converte texto livre (cartões antigos) no id da bandeira, ou null se não reconhecer. */
export function normalizeBrand(text?: string | null): CardBrandId | null {
  const t = (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  if (!t) return null
  if (t.includes('visa')) return 'visa'
  if (t.includes('master')) return 'mastercard'
  if (t.includes('amex') || t.includes('american')) return 'amex'
  if (t.includes('hiper')) return 'hipercard'
  if (t === 'elo' || t.startsWith('elo ')) return 'elo'
  return null
}

export function CardBrandLogo({
  brand,
  className,
}: {
  brand?: string | null
  className?: string
}) {
  const id = normalizeBrand(brand)
  if (!id) return null
  const nome = CARD_BRANDS.find((b) => b.id === id)!.nome
  return (
    <img
      src={URI.get(id)}
      alt={nome}
      title={nome}
      className={cn('h-6 w-auto object-contain', className)}
    />
  )
}

/** Grade de seleção de bandeira (+ opção "Nenhuma"). */
export function CardBrandPicker({
  value,
  onChange,
}: {
  value?: string | null
  onChange: (id: CardBrandId | null) => void
}) {
  const current = normalizeBrand(value)
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'flex h-11 items-center justify-center rounded-xl border text-xs font-medium',
          !current
            ? 'border-pessoal bg-pessoal-soft text-pessoal-strong'
            : 'border-app-border text-app-muted hover:bg-app-surface-2',
        )}
      >
        Nenhuma
      </button>
      {CARD_BRANDS.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onChange(b.id)}
          title={b.nome}
          aria-label={b.nome}
          className={cn(
            'flex h-11 items-center justify-center overflow-hidden rounded-xl border border-app-border bg-white p-1.5 transition-transform',
            current === b.id ? 'ring-2 ring-app-fg ring-offset-2 ring-offset-app-surface scale-105' : '',
          )}
        >
          <img src={URI.get(b.id)} alt={b.nome} className="h-full w-full object-contain" />
        </button>
      ))}
    </div>
  )
}
