import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { isHqDashboardRole } from '@/lib/roles'

export default async function Home() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (isHqDashboardRole(session.role)) redirect('/hq/overview')
  redirect('/field/tx')
}
