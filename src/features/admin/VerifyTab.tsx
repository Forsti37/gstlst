import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, TextField } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useDecision } from './shared'

export function VerifyTab() {
  const { t, i18n } = useTranslation()
  const [username, setUsername] = useState('')
  const trimmed = username.trim().toLowerCase()
  const checkins = useQuery({
    queryKey: ['admin', 'verify', trimmed],
    enabled: trimmed.length >= 3,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('staff_list_checkins', { target_username: trimmed })
      if (error) throw error
      return data
    },
  })
  const verify = useDecision((input: { id: string; verified: boolean }) =>
    getSupabase().rpc('staff_verify_checkin', { checkin_id: input.id, verified: input.verified }),
  )

  return (
    <>
      <TextField label={t('onboarding.username')} hint={t('admin.verifyHint')} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="off" />
      {verify.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      <ul className="mt-4 space-y-2">
        {checkins.data?.map((checkin) => (
          <li key={checkin.id} className="flex items-center gap-3 rounded-lg bg-surface-1 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{checkin.event_name}</span>
              <span className="text-sm text-text-secondary">
                {new Date(`${checkin.date_start}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage)}
                {checkin.verified_gps && ` · ${t('admin.gpsVerified')}`}
              </span>
            </span>
            <Button
              variant={checkin.verified_admin ? 'quiet' : 'primary'}
              onClick={() => verify.mutate({ id: checkin.id, verified: !checkin.verified_admin })}
            >
              {checkin.verified_admin ? t('admin.unverify') : t('admin.verify')}
            </Button>
          </li>
        ))}
      </ul>
      {checkins.data?.length === 0 && <p className="mt-4 text-text-secondary">{t('admin.noCheckins')}</p>}
    </>
  )
}
