import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canAccessDataManagement } from '@/lib/roles'
import * as XLSX from 'xlsx'
import { processAggPreloadData, processTxPreloadData } from '@/lib/preload-process'

export async function GET(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  const where = {}
  if (type) where.type = type

  const preloads = await prisma.preload.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, type: true, period: true, state: true,
      uploadedBy: true, locked: true, createdAt: true,
    },
  })

  return Response.json(preloads)
}

export async function POST(request) {
  const session = await getSession()
  if (!session || !canAccessDataManagement(session.role)) {
    return Response.json({ error: 'HQ access required' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const type = formData.get('type')
  const period = formData.get('period') || null
  const state = formData.get('state') || null

  if (!file || !type) {
    return Response.json({ error: 'file and type are required' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(bytes), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  if (!rows.length) {
    return Response.json({ error: 'File is empty or could not be parsed' }, { status: 400 })
  }

  const processed = type === 'tx'
    ? processTxPreloadData(rows)
    : processAggPreloadData(rows)

  const preload = await prisma.preload.create({
    data: { type, period, state, data: processed, uploadedBy: session.name },
  })

  return Response.json(preload, { status: 201 })
}
