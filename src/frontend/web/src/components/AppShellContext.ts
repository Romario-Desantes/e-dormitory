import { useOutletContext } from 'react-router-dom'
import type { AuthenticatedUser } from '../lib/types'

export function useCurrentUser() {
  return useOutletContext<AuthenticatedUser>()
}
