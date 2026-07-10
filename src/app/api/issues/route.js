import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { resolveAssessor } from '@/lib/dqa-entry'
import { canAccessDataManagement, isStateScoped } from '@/lib/roles'

export async function GET(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')
  const state = searchParams.get('state')
  const status = searchParams.get('status')

  const where = {}
  if (period) where.period = period
  if (state) where.state = state
  if (status) where.status = status

  if (isStateScoped(session.role) && session.state && !state) {
    where.state = session.state
  }

  const records = await prisma.issue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(records)
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, createdAt, updatedAt, ...fields } = body

  if (!resolveAssessor(fields.assessor, '')) {
    return Response.json({ error: 'assessor is required' }, { status: 400 })
  }

  if (id) {
    const record = await prisma.issue.update({ where: { id }, data: fields })
    return Response.json(record)
  }

  const record = await prisma.issue.create({ data: fields })
  return Response.json(record, { status: 201 })
}

export async function DELETE(request) {
  const session = await getSession()
  if (!session || !canAccessDataManagement(session.role)) {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    await prisma.issue.delete({ where: { id } })
    return Response.json({ deleted: 1 })
  }

  const where = {}
  const period = searchParams.get('period')
  const state = searchParams.get('state')
  if (period) where.period = period
  if (state) where.state = state

  const result = await prisma.issue.deleteMany({ where })
  return Response.json({ deleted: result.count })
}
