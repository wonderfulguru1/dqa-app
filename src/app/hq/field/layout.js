import { getSession } from '@/lib/auth'
import { isHqDashboardRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import HqFieldEntryLayout from './HqFieldEntryLayout'

export const metadata = { title: 'Field Entry — ECEWS DQA' }

export default async function HqFieldLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isHqDashboardRole(session.role)) redirect('/field/tx')

  const s = {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    state: session.state,
  }
  return <HqFieldEntryLayout session={s}>{children}</HqFieldEntryLayout>
}
