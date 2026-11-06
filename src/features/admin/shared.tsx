import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ErrorText } from '../../app/ui'

/** Runs a moderation call, then refreshes the queues, the dashboard counts and the log. */
export function useDecision<Input>(run: (input: Input) => PromiseLike<{ error: { message: string } | null }>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Input) => {
      const { error } = await run(input)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function Card({ children }: { children: ReactNode }) {
  return <li className="space-y-3 rounded-xl bg-surface-1 p-4">{children}</li>
}

export function EmptyQueue({ isPending, count }: { isPending: boolean; count: number }) {
  const { t } = useTranslation()
  if (isPending) return <p className="text-text-secondary">{t('common.loading')}</p>
  return count === 0 ? <p className="text-text-secondary">{t('admin.queueEmpty')}</p> : null
}

/** Approve and reject. A rejection always asks for a reason, because the creator gets to read it. */
export function DecisionButtons({
  onApprove,
  onReject,
  disabled,
  failed,
}: {
  onApprove: () => void
  onReject: (reason: string) => void
  disabled?: boolean
  failed?: boolean
}) {
  const { t } = useTranslation()
  const [missingReason, setMissingReason] = useState(false)
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" disabled={disabled} onClick={onApprove}>{t('admin.approve')}</Button>
        <Button
          variant="danger"
          disabled={disabled}
          onClick={() => {
            const reason = window.prompt(t('admin.rejectReason'))?.trim()
            setMissingReason(reason === '')
            if (reason) onReject(reason)
          }}
        >
          {t('admin.reject')}
        </Button>
      </div>
      {missingReason && <ErrorText>{t('admin.reasonRequired')}</ErrorText>}
      {failed && <ErrorText>{t('common.actionFailed')}</ErrorText>}
    </div>
  )
}
