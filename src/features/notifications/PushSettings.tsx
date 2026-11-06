import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, TextField } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { ownProfileKey, useMember, type OwnProfile } from '../auth/auth'
import { Chip } from '../checkin/components'
import { currentSubscription, disablePush, enablePush, pushAvailability, pushPermission } from './push'

const TYPES = ['friend_checkin', 'reaction', 'friend_request', 'tagged', 'friend_going', 'wishlist', 'decisions', 'badge'] as const

interface Settings {
  types?: Record<string, boolean>
  quiet_start?: string
  quiet_end?: string
  timezone?: string
}

/** Asked for only after the first check-in, or here. Never on first launch. */
export function PushPrompt({ onAnswered }: { onAnswered: () => void }) {
  const { t } = useTranslation()
  const me = useMember()
  const enable = useMutation({ mutationFn: () => enablePush(me.id), onSettled: onAnswered })
  if (pushAvailability() !== 'available' || pushPermission() !== 'default') return null
  return (
    <div className="mt-6 rounded-xl bg-surface-1 p-4 text-left">
      <p className="font-medium">{t('notifications.promptTitle')}</p>
      <p className="mt-1 text-sm text-text-secondary">{t('notifications.promptBody')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="social" onClick={() => enable.mutate()}>{t('notifications.enable')}</Button>
        <Button onClick={onAnswered}>{t('notifications.notNow')}</Button>
      </div>
    </div>
  )
}

export function PushSettings() {
  const { t } = useTranslation()
  const me = useMember()
  const queryClient = useQueryClient()
  const availability = pushAvailability()
  const settings = (me.notification_settings ?? {}) as Settings

  const subscription = useQuery({ queryKey: ['pushSubscription'], queryFn: async () => Boolean(await currentSubscription()) })
  const toggle = useMutation({
    mutationFn: async () => {
      if (subscription.data) await disablePush()
      else await enablePush(me.id)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['pushSubscription'] }),
  })
  const save = useMutation({
    mutationFn: async (next: Settings) => {
      const { error } = await getSupabase().from('profiles').update({ notification_settings: { ...next } }).eq('id', me.id)
      if (error) throw error
      return next
    },
    onSuccess: (next) => {
      queryClient.setQueryData<OwnProfile | null>(ownProfileKey(me.id), (old) => (old ? ({ ...old, notification_settings: { ...next } } as OwnProfile) : old))
    },
  })
  const update = (patch: Settings) =>
    save.mutate({ ...settings, ...patch, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })

  return (
    <div className="space-y-4">
      {availability === 'needs-install' && <p className="text-sm text-text-secondary">{t('notifications.needsInstall')}</p>}
      {availability === 'unsupported' && <p className="text-sm text-text-secondary">{t('notifications.unsupported')}</p>}
      {availability === 'available' && (
        <div>
          <Button variant={subscription.data ? 'quiet' : 'social'} disabled={toggle.isPending} onClick={() => toggle.mutate()}>
            {subscription.data ? t('notifications.disable') : t('notifications.enable')}
          </Button>
          {pushPermission() === 'denied' && <p className="mt-2 text-sm text-text-secondary">{t('notifications.denied')}</p>}
          {toggle.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm text-text-secondary">{t('notifications.typesIntro')}</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((type) => {
            const on = settings.types?.[type] !== false
            return (
              <Chip key={type} selected={on} onClick={() => update({ types: { ...settings.types, [type]: !on } })}>
                {t(`notifications.types.${type}`)}
              </Chip>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-text-secondary">{t('notifications.quietIntro')}</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('notifications.quietStart')} type="time" value={settings.quiet_start ?? ''} onChange={(e) => update({ quiet_start: e.target.value })} />
          <TextField label={t('notifications.quietEnd')} type="time" value={settings.quiet_end ?? ''} onChange={(e) => update({ quiet_end: e.target.value })} />
        </div>
      </div>
      {save.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}
