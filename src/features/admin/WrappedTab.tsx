import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, TextField } from '../../app/ui'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'
import { useCommunityYears } from '../wrapped/api'

/** Opens the Community Wrapped of a year for everyone. Admins only, which the server checks too. */
export function WrappedTab() {
  const { t } = useTranslation()
  const me = useMember()
  const queryClient = useQueryClient()
  const years = useCommunityYears()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const toggle = useMutation({
    mutationFn: async ({ target, unlocked }: { target: number; unlocked: boolean }) => {
      const { error } = await getSupabase().rpc('admin_set_community_wrapped', { for_year: target, unlocked })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wrapped', 'community'] }),
  })

  if (me.role !== 'admin') return <p className="text-text-secondary">{t('admin.wrapped.adminOnly')}</p>

  return (
    <>
      <p className="text-text-secondary">{t('admin.wrapped.intro')}</p>
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <TextField type="number" label={t('admin.wrapped.year')} value={year} min={2000} max={2100} onChange={(event) => setYear(event.target.value)} />
        </div>
        <Button variant="primary" disabled={!year || toggle.isPending} onClick={() => toggle.mutate({ target: Number(year), unlocked: true })}>{t('admin.wrapped.unlock')}</Button>
      </div>
      {toggle.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      <ul className="mt-4 space-y-1">
        {years.data?.map((entry) => (
          <li key={entry} className="flex min-h-touch items-center justify-between rounded-lg bg-surface-1 px-3">
            <span className="font-semibold">{entry}</span>
            <Button onClick={() => toggle.mutate({ target: entry, unlocked: false })}>{t('admin.wrapped.lock')}</Button>
          </li>
        ))}
      </ul>
    </>
  )
}
