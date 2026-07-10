import { getSession } from '@/lib/auth'
import { canAccessDataManagement } from '@/lib/roles'
import { redirect } from 'next/navigation'

export default async function ManageLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessDataManagement(session.role)) redirect('/hq/overview')
  return children
}
