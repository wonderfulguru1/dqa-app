import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
const COOKIE = 'dqa_session'

/** Use COOKIE_SECURE=true only when the app is served over HTTPS. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  }
}

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET)
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch {
    return null
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function requireSession(requiredRole = null) {
  const session = await getSession()
  if (!session) return null
  if (requiredRole && session.role !== requiredRole && session.role !== 'hq') return null
  return session
}

export { COOKIE }
