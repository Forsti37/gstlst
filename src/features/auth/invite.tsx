import { Navigate, useParams } from 'react-router'
import { readStored, removeStored, writeStored } from '../../lib/safeStorage'

const INVITE_KEY = 'gstlst.invite-code'

export const readInviteCode = () => readStored(INVITE_KEY)
export const clearInviteCode = () => removeStored(INVITE_KEY)

/** /invite/:code keeps the code across the Google login, then continues to the login page. */
export function InvitePage() {
  const { code } = useParams()
  if (code) writeStored(INVITE_KEY, code)
  return <Navigate to="/login" replace />
}
