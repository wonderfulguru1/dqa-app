import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { resolveAssessor, normalizeAggValidationPayload } from '@/lib/dqa-entry'
import { canAccessDataManagement, isStateScoped } from '@/lib/roles'

export async function GET(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')
  const state = searchParams.get('state')
  const facilityName = searchParams.get('facilityName')
  const indicator = searchParams.get('indicator')

  const where = {}
  if (period) where.period = period
  if (state) where.state = state
  if (facilityName) where.facilityName = facilityName
  if (indicator) where.indicator = indicator

  if (isStateScoped(session.role) && session.state && !state) {
    where.state = session.state
  }

  const records = await prisma.aggValidation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })

  return Response.json(records)
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const items = Array.isArray(body) ? body : [body]

  const results = []
  for (const item of items) {
    const data = normalizeAggValidationPayload({
      ...item,
      state: item.state || session.state,
    })
    const { period, facilityName, indicator } = data

    if (!period || !facilityName || !indicator) continue
    if (!resolveAssessor(data.assessor, '')) {
      return Response.json({ error: 'assessor is required' }, { status: 400 })
    }

    const existing = await prisma.aggValidation.findFirst({
      where: { period, facilityName, indicator },
    })

    if (existing) {
      results.push(await prisma.aggValidation.update({ where: { id: existing.id }, data }))
    } else {
      results.push(await prisma.aggValidation.create({ data }))
    }
  }

  return Response.json(results, { status: 201 })
}

export async function DELETE(request) {
  const session = await getSession()
  if (!session || !canAccessDataManagement(session.role)) {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')
  const state = searchParams.get('state')

  const where = {}
  if (period) where.period = period
  if (state) where.state = state

  const result = await prisma.aggValidation.deleteMany({ where })
  return Response.json({ deleted: result.count })
}
