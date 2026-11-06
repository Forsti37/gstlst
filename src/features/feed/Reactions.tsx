import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import type { QueuedAction } from '../offline/actions'
import { enqueue } from '../offline/queue'
import type { ReactionKind, ReactionSummary, ReactionTarget } from './api'

export const REACTIONS: { kind: ReactionKind; emoji: string }[] = [
  { kind: 'bassface', emoji: '😤' },
  { kind: 'dance', emoji: '💃' },
  { kind: 'fire', emoji: '🔥' },
]

/** The next state after a tap: tapping the current reaction removes it, another one changes it. */
export function applyReaction(summary: ReactionSummary, kind: ReactionKind): ReactionSummary {
  const next = { ...summary }
  if (summary.mine) next[summary.mine] -= 1
  if (summary.mine === kind) return { ...next, mine: null }
  next[kind] += 1
  return { ...next, mine: kind }
}

export function reactionAction(userId: string, target: ReactionTarget, targetId: string, current: ReactionKind | null, kind: ReactionKind): QueuedAction {
  if (current === kind) {
    return { kind: 'delete', table: 'reactions', match: { user_id: userId, target_type: target, target_id: targetId } }
  }
  return { kind: 'rpc', fn: 'set_reaction', args: { target, target_id: targetId, kind } }
}

function WhoReacted({ target, targetId }: { target: ReactionTarget; targetId: string }) {
  const { t } = useTranslation()
  const list = useQuery({
    queryKey: ['reactionList', target, targetId],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('list_reactions', { target, target_id: targetId })
      if (error) throw error
      return data
    },
  })
  if (list.isPending) return <p className="mt-2 text-sm text-text-secondary">{t('common.loading')}</p>
  return (
    <ul className="mt-2 text-sm">
      {list.data?.map((person) => (
        <li key={person.username}>
          <Link to={`/u/${person.username}`} className="flex min-h-touch items-center gap-2">
            <span aria-hidden>{REACTIONS.find((r) => r.kind === person.kind)?.emoji}</span>
            {person.display_name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Answers on the spot, also offline: the write waits in the queue like every other one. */
export function Reactions({ target, targetId, summary }: { target: ReactionTarget; targetId: string; summary: ReactionSummary }) {
  const { t } = useTranslation()
  const me = useMember()
  const [local, setLocal] = useState<ReactionSummary | null>(null)
  const [showList, setShowList] = useState(false)
  const current = local ?? summary
  const total = current.bassface + current.dance + current.fire

  const react = (kind: ReactionKind) => {
    setLocal(applyReaction(current, kind))
    void enqueue(me.id, [reactionAction(me.id, target, targetId, current.mine, kind)])
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        {REACTIONS.map(({ kind, emoji }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={current.mine === kind}
            aria-label={t(`feed.reactions.${kind}`)}
            onClick={() => react(kind)}
            className="inline-flex min-h-touch min-w-touch items-center justify-center gap-1 rounded-full bg-surface-2 px-3 text-sm aria-pressed:bg-blue aria-pressed:text-white"
          >
            <span aria-hidden className="text-lg">{emoji}</span>
            {current[kind] > 0 && <span className="tabular-nums">{current[kind]}</span>}
          </button>
        ))}
        {total > 0 && (
          <button type="button" onClick={() => setShowList(!showList)} className="min-h-touch px-2 text-sm text-text-secondary">
            {t('feed.whoReacted')}
          </button>
        )}
      </div>
      {showList && <WhoReacted target={target} targetId={targetId} />}
    </div>
  )
}
