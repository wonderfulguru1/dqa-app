import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import HqShell from './HqShell'

export const metadata = { title: 'HQ Dashboard — ECEWS DQA' }

export default async function HqLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'hq') redirect('/field')

  const s = { id: session.id, name: session.name, email: session.email, role: session.role, state: session.state }
  return <HqShell session={s}>{children}</HqShell>
}
