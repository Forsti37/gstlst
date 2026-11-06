import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'

/** Reported content is hidden until someone has reviewed it. */
export function ReportButton({ targetType, targetId, onReported }: { targetType: 'media' | 'profile'; targetId: string; onReported?: () => void }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')

  const report = async () => {
    const reason = window.prompt(t('moderation.reportReason'))?.trim()
    if (!reason) return
    const { error } = await getSupabase().rpc('report_content', { target_type: targetType, target_id: targetId, reason })
    setState(error ? 'failed' : 'done')
    if (!error) onReported?.()
  }

  if (state === 'done') return <p className="text-sm text-text-secondary">{t('moderation.reported')}</p>
  return (
    <>
      <Button variant="danger" onClick={() => void report()}>{t('moderation.report')}</Button>
      {state === 'failed' && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </>
  )
}
