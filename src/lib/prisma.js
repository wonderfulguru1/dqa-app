import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { statSync } from 'fs'
import { join } from 'path'

const globalForPrisma = globalThis

function prismaSchemaMtime() {
  try {
    return statSync(join(process.cwd(), 'node_modules/.prisma/client/schema.prisma')).mtimeMs
  } catch {
    return 0
  }
}

function makePrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const schemaMtime = prismaSchemaMtime()
if (
  process.env.NODE_ENV !== 'production' &&
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaMtime !== schemaMtime
) {
  void globalForPrisma.prisma.$disconnect()
  globalForPrisma.prisma = undefined
}

const prisma = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaSchemaMtime = schemaMtime
}

export default prisma
