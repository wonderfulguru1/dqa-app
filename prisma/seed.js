// Run: node prisma/seed.js
// Creates the initial HQ admin user

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' }) // fallback if .env.local not present

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.SEED_EMAIL || 'admin@ecews.org'
  const password = process.env.SEED_PASSWORD || 'DQA2025!'
  const name = process.env.SEED_NAME || 'DQA Admin'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`User ${email} already exists — skipping.`)
    return
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: 'hq' },
  })

  console.log(`\nCreated HQ admin user:`)
  console.log(`  Name:     ${user.name}`)
  console.log(`  Email:    ${user.email}`)
  console.log(`  Password: ${password}`)
  console.log(`  Role:     ${user.role}`)
  console.log(`\nChange the password after first login!\n`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
