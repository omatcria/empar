import { Building2, User } from '@/components/icons'
import type { Context } from '@/domain/types'
import { CONTEXT_LABEL, contextBadgeClass } from '@/domain/enums'
import { cn } from '@/lib/cn'
import { Badge } from './primitives'

/** Etiqueta de contexto (Pessoal azul / Empresarial violeta) com ícone. */
export function ContextBadge({
  contexto,
  className,
  iconOnly,
}: {
  contexto: Context
  className?: string
  iconOnly?: boolean
}) {
  const Icon = contexto === 'PESSOAL' ? User : Building2
  return (
    <Badge className={cn(contextBadgeClass(contexto), className)}>
      <Icon className="size-3" />
      {!iconOnly && CONTEXT_LABEL[contexto]}
    </Badge>
  )
}
