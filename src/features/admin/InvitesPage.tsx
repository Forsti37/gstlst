import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NotFoundPage } from '../../app/NotFoundPage'
import { Button, ErrorText, Section, TextField } from '../../app/ui'
import { copyText } from '../../lib/clipboard'
import { getSupabase } from '../../lib/supabase'
import { useMember } from '../auth/auth'

const KEY = ['inviteCodes']
const inviteUrl = (code: string) => `${window.location.origin}${import.meta.env.BASE_URL}invite/${code}`

/** Confirms the copy, and shows the link for manual copying if the browser refuses. */
function CopyLink({ code }: { code: string }) {
  const { t } = useTranslation()
  const [result, setResult] = useState<'copied' | 'failed' | null>(null)
  const url = inviteUrl(code)

  return (
    <>
      <Button onClick={() => void copyText(url).then((copied) => setResult(copied ? 'copied' : 'failed'))}>
        {result === 'copied' ? t('admin.copied') : t('admin.copyLink')}
      </Button>
      {result === 'failed' && (
        <p role="alert" className="basis-full text-sm break-all select-all">
          {t('admin.copyFailed')} {url}
        </p>
      )}
    </>
  )
}

function Invites() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [maxUses, setMaxUses] = useState('1')
  const [expiryDate, setExpiryDate] = useState('')

  const invites = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('invite_codes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: KEY })
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().rpc('admin_create_invite', {
        max_uses: Number(maxUses),
        // The end of the chosen day. The generated type doesn't know the parameter is nullable.
        expires_at: (expiryDate ? new Date(`${expiryDate}T23:59:59`).toISOString() : null) as string,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await getSupabase().from('invite_codes').delete().eq('code', code)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  return (
    <div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <TextField label={t('admin.maxUses')} type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} required />
        <TextField label={t('admin.expires')} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        <Button type="submit" variant="primary" disabled={create.isPending}>{t('admin.createInvite')}</Button>
        {create.isError && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      </form>

      <Section title={t('admin.existing')}>
        <ul className="space-y-3">
          {invites.data?.map((invite) => (
            <li key={invite.code} className="rounded-lg bg-surface-1 p-3">
              <p className="font-mono break-all">{invite.code}</p>
              <p className="mt-1 text-sm text-text-secondary">
                {t('admin.used', { used: invite.used_count, max: invite.max_uses })}
                {invite.expires_at && ` · ${t('admin.until', { date: new Date(invite.expires_at).toLocaleDateString(i18n.resolvedLanguage) })}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyLink code={invite.code} />
                <Button variant="danger" onClick={() => remove.mutate(invite.code)}>{t('admin.delete')}</Button>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

export function InvitesPage() {
  const me = useMember()
  return me.role === 'admin' ? <Invites /> : <NotFoundPage />
}
