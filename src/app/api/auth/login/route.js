import prisma from '@/lib/prisma'
import { signToken, COOKIE, sessionCookieOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = await signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      state: user.state,
    })

    const cookieStore = await cookies()
    cookieStore.set(COOKIE, token, sessionCookieOptions())

    return Response.json({ role: user.role, name: user.name })
  } catch (err) {
    console.error('Login error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
