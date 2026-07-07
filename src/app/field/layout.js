import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import FieldShell from './FieldShell'

export const metadata = { title: 'Field Entry — ECEWS DQA' }

export default async function FieldLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'hq') redirect('/hq/field/tx')

  const s = { id: session.id, name: session.name, email: session.email, role: session.role, state: session.state }
  return <FieldShell session={s}>{children}</FieldShell>
}
