import type { FC } from 'react'
import {
  IconApple,
  IconBallFootball,
  IconBarbell,
  IconBeach,
  IconBike,
  IconBolt,
  IconBook,
  IconBriefcase,
  IconBuildingBank,
  IconBuildingHospital,
  IconBuildingStore,
  IconBulb,
  IconBus,
  IconCalculator,
  IconCalendar,
  IconCar,
  IconCash,
  IconCat,
  IconChartBar,
  IconChartLine,
  IconClock,
  IconCoffee,
  IconCoin,
  IconConfetti,
  IconCreditCard,
  IconDeviceGamepad2,
  IconDeviceLaptop,
  IconDeviceTv,
  IconDog,
  IconDots,
  IconDroplet,
  IconFlame,
  IconGasStation,
  IconGift,
  IconHeart,
  IconHeartbeat,
  IconHome,
  IconLuggage,
  IconMapPin,
  IconMeat,
  IconMoneybag,
  IconMotorbike,
  IconMovie,
  IconMusic,
  IconPaw,
  IconPhone,
  IconPigMoney,
  IconPill,
  IconPizza,
  IconPlane,
  IconPlus,
  IconReceipt,
  IconReceiptTax,
  IconRepeat,
  IconRun,
  IconSchool,
  IconScissors,
  IconShirt,
  IconShoppingBag,
  IconShoppingCart,
  IconSparkles,
  IconSpeakerphone,
  IconStar,
  IconStethoscope,
  IconTag,
  IconTicket,
  IconTool,
  IconToolsKitchen2,
  IconTrendingUp,
  IconTruck,
  IconVaccine,
  IconWallet,
  IconWifi,
} from '@tabler/icons-react'

type IconComp = FC<{ className?: string; size?: number | string }>

export interface CatalogIcon {
  key: string
  comp: IconComp
  terms: string[]
}

/**
 * Catálogo curado de ícones (Tabler) para categorias.
 * `key` é o valor salvo em `categories.icone`.
 * `terms` = palavras de busca em PT e EN.
 */
export const CATEGORY_ICONS: CatalogIcon[] = [
  { key: 'home', comp: IconHome, terms: ['casa', 'moradia', 'lar', 'aluguel', 'home', 'house', 'rent'] },
  { key: 'utensils', comp: IconToolsKitchen2, terms: ['alimentacao', 'comida', 'restaurante', 'food', 'meal', 'dining'] },
  { key: 'shopping-cart', comp: IconShoppingCart, terms: ['mercado', 'supermercado', 'compras', 'grocery', 'market', 'cart'] },
  { key: 'shopping-bag', comp: IconShoppingBag, terms: ['compras', 'loja', 'shopping', 'bag', 'store'] },
  { key: 'coffee', comp: IconCoffee, terms: ['cafe', 'lanche', 'coffee', 'snack'] },
  { key: 'pizza', comp: IconPizza, terms: ['pizza', 'fastfood', 'delivery'] },
  { key: 'apple', comp: IconApple, terms: ['fruta', 'saudavel', 'fruit', 'healthy'] },
  { key: 'meat', comp: IconMeat, terms: ['carne', 'acougue', 'meat', 'butcher'] },
  { key: 'car', comp: IconCar, terms: ['carro', 'transporte', 'car', 'transport', 'auto'] },
  { key: 'gas', comp: IconGasStation, terms: ['gasolina', 'combustivel', 'posto', 'gas', 'fuel'] },
  { key: 'bus', comp: IconBus, terms: ['onibus', 'transporte', 'bus', 'transit'] },
  { key: 'bike', comp: IconBike, terms: ['bicicleta', 'bike', 'cycling'] },
  { key: 'motorbike', comp: IconMotorbike, terms: ['moto', 'motocicleta', 'motorbike', 'motorcycle'] },
  { key: 'truck', comp: IconTruck, terms: ['caminhao', 'entrega', 'frete', 'truck', 'delivery', 'freight'] },
  { key: 'plane', comp: IconPlane, terms: ['aviao', 'viagem', 'voo', 'plane', 'flight', 'travel'] },
  { key: 'luggage', comp: IconLuggage, terms: ['viagem', 'mala', 'ferias', 'travel', 'luggage', 'vacation'] },
  { key: 'beach', comp: IconBeach, terms: ['praia', 'ferias', 'beach', 'vacation', 'holiday'] },
  { key: 'heart-pulse', comp: IconHeartbeat, terms: ['saude', 'medico', 'health', 'medical'] },
  { key: 'pill', comp: IconPill, terms: ['remedio', 'farmacia', 'medicamento', 'pill', 'pharmacy', 'medicine'] },
  { key: 'stethoscope', comp: IconStethoscope, terms: ['medico', 'consulta', 'doctor', 'health'] },
  { key: 'hospital', comp: IconBuildingHospital, terms: ['hospital', 'clinica', 'saude', 'clinic'] },
  { key: 'vaccine', comp: IconVaccine, terms: ['vacina', 'injecao', 'vaccine', 'shot'] },
  { key: 'school', comp: IconSchool, terms: ['educacao', 'escola', 'faculdade', 'education', 'school', 'college'] },
  { key: 'book', comp: IconBook, terms: ['livro', 'curso', 'estudo', 'book', 'course', 'study'] },
  { key: 'laptop', comp: IconDeviceLaptop, terms: ['computador', 'notebook', 'tecnologia', 'laptop', 'computer', 'tech'] },
  { key: 'movie', comp: IconMovie, terms: ['cinema', 'filme', 'lazer', 'movie', 'cinema', 'entertainment'] },
  { key: 'music', comp: IconMusic, terms: ['musica', 'show', 'music', 'concert'] },
  { key: 'game', comp: IconDeviceGamepad2, terms: ['jogo', 'games', 'videogame', 'game', 'gaming'] },
  { key: 'ticket', comp: IconTicket, terms: ['ingresso', 'evento', 'ticket', 'event'] },
  { key: 'football', comp: IconBallFootball, terms: ['futebol', 'esporte', 'football', 'soccer', 'sport'] },
  { key: 'gym', comp: IconBarbell, terms: ['academia', 'treino', 'gym', 'fitness', 'workout'] },
  { key: 'run', comp: IconRun, terms: ['corrida', 'exercicio', 'run', 'running', 'exercise'] },
  { key: 'party', comp: IconConfetti, terms: ['festa', 'lazer', 'party', 'celebration'] },
  { key: 'shirt', comp: IconShirt, terms: ['roupa', 'vestuario', 'clothes', 'clothing', 'apparel'] },
  { key: 'scissors', comp: IconScissors, terms: ['cabelo', 'salao', 'beleza', 'haircut', 'beauty', 'salon'] },
  { key: 'gift', comp: IconGift, terms: ['presente', 'gift', 'present'] },
  { key: 'tv', comp: IconDeviceTv, terms: ['assinatura', 'streaming', 'tv', 'subscription'] },
  { key: 'wifi', comp: IconWifi, terms: ['internet', 'wifi', 'net'] },
  { key: 'phone', comp: IconPhone, terms: ['telefone', 'celular', 'phone', 'mobile'] },
  { key: 'bolt', comp: IconBolt, terms: ['energia', 'luz', 'eletricidade', 'energy', 'electricity', 'power'] },
  { key: 'water', comp: IconDroplet, terms: ['agua', 'water'] },
  { key: 'gas-flame', comp: IconFlame, terms: ['gas', 'fogo', 'flame'] },
  { key: 'dog', comp: IconDog, terms: ['pet', 'cachorro', 'dog', 'animal'] },
  { key: 'cat', comp: IconCat, terms: ['pet', 'gato', 'cat', 'animal'] },
  { key: 'paw', comp: IconPaw, terms: ['pet', 'animal', 'paw', 'vet'] },
  { key: 'briefcase', comp: IconBriefcase, terms: ['trabalho', 'negocio', 'servico', 'work', 'business', 'service'] },
  { key: 'store', comp: IconBuildingStore, terms: ['loja', 'comercio', 'vendas', 'store', 'shop', 'sales'] },
  { key: 'tool', comp: IconTool, terms: ['ferramenta', 'reparo', 'manutencao', 'tool', 'repair', 'software'] },
  { key: 'megaphone', comp: IconSpeakerphone, terms: ['marketing', 'anuncio', 'publicidade', 'ads', 'marketing'] },
  { key: 'calculator', comp: IconCalculator, terms: ['contador', 'contabilidade', 'calculo', 'accountant', 'accounting'] },
  { key: 'wallet', comp: IconWallet, terms: ['carteira', 'dinheiro', 'wallet', 'money'] },
  { key: 'cash', comp: IconCash, terms: ['dinheiro', 'salario', 'nota', 'cash', 'salary', 'money'] },
  { key: 'coin', comp: IconCoin, terms: ['moeda', 'dinheiro', 'coin', 'money'] },
  { key: 'moneybag', comp: IconMoneybag, terms: ['renda', 'bonus', 'ganhos', 'income', 'earnings'] },
  { key: 'pig', comp: IconPigMoney, terms: ['poupanca', 'reserva', 'economia', 'savings', 'reserve'] },
  { key: 'card', comp: IconCreditCard, terms: ['cartao', 'credito', 'card', 'credit'] },
  { key: 'bank', comp: IconBuildingBank, terms: ['banco', 'taxa', 'imposto', 'bank', 'tax', 'fee'] },
  { key: 'tax', comp: IconReceiptTax, terms: ['imposto', 'das', 'inss', 'tax'] },
  { key: 'receipt', comp: IconReceipt, terms: ['recibo', 'nota', 'conta', 'receipt', 'bill', 'invoice'] },
  { key: 'chart', comp: IconChartBar, terms: ['grafico', 'relatorio', 'chart', 'report'] },
  { key: 'invest', comp: IconChartLine, terms: ['investimento', 'acoes', 'invest', 'stocks'] },
  { key: 'trending-up', comp: IconTrendingUp, terms: ['crescimento', 'lucro', 'growth', 'profit'] },
  { key: 'gift-heart', comp: IconHeart, terms: ['doacao', 'caridade', 'amor', 'donation', 'charity', 'love'] },
  { key: 'baby', comp: IconMapPin, terms: ['local', 'lugar', 'place', 'location'] },
  { key: 'idea', comp: IconBulb, terms: ['ideia', 'projeto', 'idea', 'project'] },
  { key: 'calendar', comp: IconCalendar, terms: ['agenda', 'data', 'calendar', 'date'] },
  { key: 'clock', comp: IconClock, terms: ['hora', 'tempo', 'clock', 'time'] },
  { key: 'star', comp: IconStar, terms: ['favorito', 'destaque', 'star', 'favorite'] },
  { key: 'sparkles', comp: IconSparkles, terms: ['brilho', 'novo', 'sparkles', 'new'] },
  { key: 'repeat', comp: IconRepeat, terms: ['assinatura', 'recorrente', 'subscription', 'recurring'] },
  { key: 'tag', comp: IconTag, terms: ['etiqueta', 'geral', 'tag', 'other', 'outros'] },
  { key: 'other', comp: IconDots, terms: ['outros', 'diversos', 'other', 'misc'] },
  { key: 'plus', comp: IconPlus, terms: ['adicionar', 'novo', 'add', 'new', 'outras'] },
]

const MAP = new Map(CATEGORY_ICONS.map((i) => [i.key, i.comp]))

/** Renderiza o ícone de uma categoria pelo `key`, com fallback. */
export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  const Comp = (name && MAP.get(name)) || IconTag
  return <Comp className={className} />
}

/** Busca ícones por termo (PT ou EN). Vazio = todos. */
export function searchIcons(q: string): CatalogIcon[] {
  const s = q.trim().toLowerCase()
  if (!s) return CATEGORY_ICONS
  return CATEGORY_ICONS.filter(
    (i) => i.key.includes(s) || i.terms.some((t) => t.includes(s)),
  )
}
