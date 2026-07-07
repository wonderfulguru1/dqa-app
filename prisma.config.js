const { defineConfig } = require('prisma/config')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

module.exports = defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/dqa',
  },
})
