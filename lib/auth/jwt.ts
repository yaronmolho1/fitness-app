import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { authConfig } from './config'

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(authConfig.jwtSecret)
}

/** Issue a signed JWT for the given username. */
export async function issueToken(username: string): Promise<string> {
  const secret = getSecretKey()

  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(authConfig.jwtExpiresIn)
    .sign(secret)
}

/** Verify a JWT and return its payload. Throws on expired/tampered tokens. */
export async function verifyToken(token: string): Promise<JWTPayload> {
  const secret = getSecretKey()
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  })
  return payload
}
