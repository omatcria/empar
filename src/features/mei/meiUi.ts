import type { MeiNivel } from '@/engine/mei'

export const NIVEL_BAR: Record<MeiNivel, string> = {
  ok: 'bg-income',
  atencao: 'bg-warn',
  critico: 'bg-warn',
  excedido: 'bg-expense',
  desenquadrado: 'bg-expense',
}

export const NIVEL_TEXT: Record<MeiNivel, string> = {
  ok: 'text-income',
  atencao: 'text-warn',
  critico: 'text-warn',
  excedido: 'text-expense',
  desenquadrado: 'text-expense',
}

export const NIVEL_LABEL: Record<MeiNivel, string> = {
  ok: 'Dentro do limite',
  atencao: 'Atenção',
  critico: 'Crítico',
  excedido: 'Excedido',
  desenquadrado: 'Desenquadrado',
}
