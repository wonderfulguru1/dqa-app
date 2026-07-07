import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { normalizeTxValidationPayload, resolveAssessor } from '@/lib/dqa-entry'

export async function GET(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')
  const state = searchParams.get('state')
  const facilityName = searchParams.get('facilityName')

  const where = {}
  if (period) where.period = period
  if (state) where.state = state
  if (facilityName) where.facilityName = facilityName

  if (session.role === 'field' && session.state && !state) {
    where.state = session.state
  }

  const records = await prisma.txValidation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })

  return Response.json(records)
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = normalizeTxValidationPayload({
      ...body,
      state: body.state || session.state,
    })

    if (!data.period || !data.facilityName) {
      return Response.json({ error: 'period and facilityName are required' }, { status: 400 })
    }
    if (!data.state) {
      return Response.json({ error: 'state is required' }, { status: 400 })
    }
    if (!resolveAssessor(data.assessor, '')) {
      return Response.json({ error: 'assessor is required' }, { status: 400 })
    }

    const existing = await prisma.txValidation.findFirst({
      where: {
        period: data.period,
        facilityName: data.facilityName,
        patientId: data.patientId,
        pepId: data.pepId,
      },
    })

    const record = existing
      ? await prisma.txValidation.update({ where: { id: existing.id }, data })
      : await prisma.txValidation.create({ data })

    return Response.json(record, { status: existing ? 200 : 201 })
  } catch (err) {
    console.error('TX save error:', err)
    return Response.json(
      { error: err.message || 'Failed to save TX validation' },
      { status: 500 },
    )
  }
}

export async function DELETE(request) {
  const session = await getSession()
  if (!session || session.role !== 'hq') {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')
  const state = searchParams.get('state')

  const where = {}
  if (period) where.period = period
  if (state) where.state = state

  const result = await prisma.txValidation.deleteMany({ where })
  return Response.json({ deleted: result.count })
}
