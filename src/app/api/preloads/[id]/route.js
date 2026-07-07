import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const preload = await prisma.preload.findUnique({ where: { id: parseInt(id) } })
  if (!preload) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(preload)
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session || session.role !== 'hq') {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const preload = await prisma.preload.update({
    where: { id: parseInt(id) },
    data: { locked: body.locked },
  })

  return Response.json(preload)
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session || session.role !== 'hq') {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const { id } = await params
  await prisma.preload.delete({ where: { id: parseInt(id) } })

  return Response.json({ ok: true })
}
