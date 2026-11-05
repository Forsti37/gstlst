import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { useTranslation } from 'react-i18next'
import { Button } from '../../app/ui'
import { copyText } from '../../lib/clipboard'

export function profileUrl(username: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}u/${username}`
}

async function dataUrlToFile(dataUrl: string, name: string) {
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], name, { type: 'image/png' })
}

export function ShareCard({ username }: { username: string }) {
  const { t } = useTranslation()
  const url = profileUrl(username)
  const fileName = `gstlst-${username}.png`
  const { data: qr } = useQuery({
    queryKey: ['qr', url],
    staleTime: Infinity,
    queryFn: () => QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#000000', light: '#ffffff' } }),
  })

  const share = async () => {
    try {
      const file = qr ? await dataUrlToFile(qr, fileName) : null
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], url })
      } else if (typeof navigator.share === 'function') {
        await navigator.share({ url })
      } else {
        await copyText(url)
      }
    } catch {
      // The user closed the share sheet.
    }
  }

  return (
    <div className="rounded-xl bg-surface-1 p-4 text-center">
      {qr && <img src={qr} alt={t('profile.qrAlt', { username })} className="mx-auto size-56 rounded-lg" />}
      <p className="mt-3 text-sm break-all text-text-secondary">{url}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="social" onClick={() => void share()}>{t('profile.share')}</Button>
        {qr && (
          <a href={qr} download={fileName} className="inline-flex min-h-touch items-center justify-center rounded-lg bg-surface-2 px-4 font-semibold">
            {t('profile.saveQr')}
          </a>
        )}
      </div>
    </div>
  )
}
