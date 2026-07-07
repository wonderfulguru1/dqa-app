import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  return Response.json({ id: session.id, name: session.name, email: session.email, role: session.role, state: session.state })
}
