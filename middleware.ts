import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const publicPaths = ['/login', '/api/auth', '/api/health']

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth-token')?.value

  if (isPublicPath(pathname)) {
    // Redirect authenticated users away from login page
    if (pathname === '/login' && token) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET)
        await jwtVerify(token, secret, { algorithms: ['HS256'] })
        return NextResponse.redirect(new URL('/', request.url))
      } catch {
        return NextResponse.next()
      }
    }
    return NextResponse.next()
  }

  // Protected route — require valid JWT
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
