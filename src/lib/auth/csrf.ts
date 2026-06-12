import { createHash } from "crypto";

/**
 * Valide un jeton CSRF NextAuth (double-submit cookie).
 * @see next-auth/core/lib/csrf
 */
export function isValidNextAuthCsrfToken(
  csrfToken: string,
  csrfCookie: string | undefined,
  secret: string,
): boolean {
  if (!csrfToken || !csrfCookie || !secret) return false;

  const [, hash] = csrfCookie.split("|");
  if (!hash) return false;

  const expected = createHash("sha256")
    .update(`${csrfToken}${secret}`)
    .digest("hex");

  return hash === expected;
}
