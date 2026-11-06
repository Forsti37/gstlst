import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'

export function FeedbackForm() {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().functions.invoke('feedback', {
        body: { text: text.trim(), appVersion: __APP_VERSION__, device: navigator.userAgent },
      })
      if (error) throw error
    },
    onSuccess: () => setText(''),
  })
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm text-text-secondary">{t('settings.feedbackLabel')}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          rows={4}
          className="w-full rounded-lg border border-surface-2 bg-surface-1 p-3"
        />
      </label>
      <p className="mt-1 text-xs text-text-secondary">{t('settings.feedbackPublic')}</p>
      <Button className="mt-2" disabled={!text.trim() || send.isPending} onClick={() => send.mutate()}>{t('settings.feedbackSend')}</Button>
      {send.isSuccess && <p className="mt-2 text-sm text-text-secondary">{t('settings.feedbackThanks')}</p>}
      {send.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}
