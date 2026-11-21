import { useState } from 'react'
import { useReactions } from '@/store/reactions'
import { useAuth } from '@/store/auth'
import type { ReactionEmoji, TransactionReaction } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Smile } from '@/components/icons'

const EMOJIS: { id: ReactionEmoji; label: string; icon: string }[] = [
  { id: 'like', label: 'Curtir', icon: '👍' },
  { id: 'love', label: 'Amei', icon: '❤️' },
  { id: 'sad', label: 'Triste', icon: '😢' },
  { id: 'angry', label: 'Grr', icon: '😡' },
]

export function TransactionReactions({
  txId,
  reactions,
}: {
  txId: string
  reactions: TransactionReaction[]
}) {
  const uid = useAuth((s) => s.user?.id)
  const { addReaction, removeReaction } = useReactions()
  const [pickerOpen, setPickerOpen] = useState(false)

  const counts = EMOJIS.map((e) => {
    const reacts = reactions.filter((r) => r.emoji === e.id)
    const myReact = reacts.find((r) => r.user_id === uid)
    return { ...e, count: reacts.length, myReact }
  }).filter((c) => c.count > 0)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {counts.map((c) => (
        <button
          key={c.id}
          onClick={() => {
            if (c.myReact) removeReaction(c.myReact.id)
            else addReaction(txId, c.id)
          }}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors cursor-pointer',
            c.myReact
              ? 'border-pessoal bg-pessoal/10 text-pessoal-strong'
              : 'border-app-border bg-app-surface-2 text-app-muted hover:bg-app-border',
          )}
        >
          <span>{c.icon}</span>
          <span className="font-medium">{c.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex h-5 w-5 items-center justify-center rounded-full text-app-muted hover:bg-app-surface-2 hover:text-app-fg transition-colors cursor-pointer"
          title="Adicionar reação"
        >
          <Smile className="size-3.5" />
        </button>

        {pickerOpen && (
          <div className="absolute left-0 top-full mt-1 flex gap-1 rounded-full border border-app-border bg-app-surface p-1 shadow-lg z-10">
            {EMOJIS.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setPickerOpen(false)
                  const my = counts.find((c) => c.id === e.id)?.myReact
                  if (!my) addReaction(txId, e.id)
                }}
                className="flex size-6 items-center justify-center rounded-full hover:bg-app-surface-2 text-sm transition-transform hover:scale-110 cursor-pointer"
                title={e.label}
              >
                {e.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
