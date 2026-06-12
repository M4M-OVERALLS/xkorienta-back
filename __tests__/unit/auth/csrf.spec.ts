import { describe, expect, it } from "@jest/globals";
import { createHash, randomBytes } from "crypto";
import { isValidNextAuthCsrfToken } from "@/lib/auth/csrf";

function buildCsrfPair(secret: string) {
  const token = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${token}${secret}`).digest("hex");
  return { token, cookie: `${token}|${hash}` };
}

describe("isValidNextAuthCsrfToken", () => {
  const secret = "test-secret-for-csrf-validation-32chars";

  it("should accept a valid CSRF token and cookie pair", () => {
    const { token, cookie } = buildCsrfPair(secret);
    expect(isValidNextAuthCsrfToken(token, cookie, secret)).toBe(true);
  });

  it("should reject when token does not match cookie hash", () => {
    const { cookie } = buildCsrfPair(secret);
    expect(isValidNextAuthCsrfToken("wrong-token", cookie, secret)).toBe(false);
  });

  it("should reject when cookie or token is missing", () => {
    const { token } = buildCsrfPair(secret);
    expect(isValidNextAuthCsrfToken("", `${token}|abc`, secret)).toBe(false);
    expect(isValidNextAuthCsrfToken(token, undefined, secret)).toBe(false);
  });
});
