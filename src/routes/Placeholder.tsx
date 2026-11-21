import { Construction } from '@/components/icons'

/** Placeholder para rotas ainda não implementadas nesta fase. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="py-20 text-center">
      <Construction className="mx-auto mb-3 size-8 text-app-muted" />
      <p className="text-lg font-semibold text-app-fg">{title}</p>
      <p className="mt-1 text-sm text-app-muted">Chega já já, na sequência da Fase 1.</p>
    </div>
  )
}
