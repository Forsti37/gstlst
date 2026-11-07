import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText, TextField } from '../../app/ui'
import { instagramHandle, toInstagramUrl } from '../../lib/instagram'

/** Takes a link or an @handle and saves it in the one form the database accepts. */
export function InstagramField({ current, onSave }: { current: string | null; onSave: (url: string | null) => Promise<boolean> }) {
  const { t } = useTranslation()
  const [value, setValue] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'invalid' | 'failed' | 'saved'>('idle')
  const shown = value ?? (current ? instagramHandle(current) : '')

  const save = async () => {
    const url = toInstagramUrl(shown)
    if (url === null) {
      setState('invalid')
      return
    }
    const ok = await onSave(url || null)
    setState(ok ? 'saved' : 'failed')
    if (ok) setValue(null)
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <TextField
          label={t('admin.instagram')}
          hint={t('admin.instagramHint')}
          value={shown}
          onChange={(event) => {
            setValue(event.target.value)
            setState('idle')
          }}
          autoComplete="off"
          autoCapitalize="none"
        />
        <Button disabled={value === null} onClick={() => void save()}>{t('common.save')}</Button>
      </div>
      {state === 'invalid' && <ErrorText>{t('admin.instagramInvalid')}</ErrorText>}
      {state === 'failed' && <ErrorText>{t('common.actionFailed')}</ErrorText>}
      {state === 'saved' && <p className="mt-1 text-sm text-text-secondary">{t('common.saved')}</p>}
    </div>
  )
}
