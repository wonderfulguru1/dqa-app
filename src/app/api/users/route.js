import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'hq') {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, state: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(users)
}

export async function POST(request) {
  const session = await getSession()
  if (!session || session.role !== 'hq') {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const { name, email, password, role, state } = await request.json()

  if (!name || !email || !password) {
    return Response.json({ error: 'name, email, and password are required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'Email already in use' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: role || 'field', state: state || null },
    select: { id: true, name: true, email: true, role: true, state: true, createdAt: true },
  })

  return Response.json(user, { status: 201 })
}

export async function DELETE(request) {
  const session = await getSession()
  if (!session || session.role !== 'hq') {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  if (parseInt(id) === session.id) {
    return Response.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id: parseInt(id) } })
  return Response.json({ ok: true })
}
