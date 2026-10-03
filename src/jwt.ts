/**
 * Read the lifetime a credential states about itself.
 *
 * The madmodel gateway issues campus JWTs, so the expiry is a claim in the
 * token rather than something only the provider can answer: decoding the
 * payload yields an exact deadline with no network request and no clock
 * guessing. The signature is deliberately not verified — this plugin is not
 * the issuer and holds no key, and the value is a local hint whose ground
 * truth is a real provider response.
 * @module dsh-thu-automad/jwt
 */

/** Lifetime claims read from one token payload, in epoch milliseconds. */
export interface TokenTimes {
  /** `iat`, when the payload carries a usable value. */
  issuedAt: number | null
  /** `exp`, when the payload carries a usable value. */
  expiresAt: number | null
}

/**
 * Decode a compact JWS payload and read its `iat`/`exp` claims.
 * @param token - credential value; it may be any string, including a non-JWT key.
 * @returns the lifetime claims, or undefined when the value states none.
 */
export function readTokenTimes(token: string): TokenTimes | undefined {
  const segments = token.split('.')
  if (segments.length !== 3) return undefined
  const payload = segments[1]
  if (payload === undefined || payload.length === 0) return undefined
  const claims = decodeClaims(payload)
  if (claims === undefined) return undefined
  const issuedAt = claimToMillis(claims.iat)
  const expiresAt = claimToMillis(claims.exp)
  if (issuedAt === null && expiresAt === null) return undefined
  return { issuedAt, expiresAt }
}

/** Parse a base64url payload segment, or report that it is not a JSON object. */
function decodeClaims(segment: string): Record<string, unknown> | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
  } catch (_notJson) {
    // A credential that merely contains two dots is not a token with claims.
    return undefined
  }
  return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
}

/** Convert one JWT numeric-date claim from seconds to epoch milliseconds. */
function claimToMillis(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value * 1000 : null
}
