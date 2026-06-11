/**
 * [SEC] Signout + invalidation serveur des sessions JWT
 *
 * - POST /api/auth/signout → 200
 * - tokenVersion incrémenté en BD
 * - Rejeu d'un ancien JWT après logout
 */

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { createHash, randomBytes } from "crypto";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import User from "@/models/User";
import { authOptions } from "@/lib/auth";
import { POST as signOutPost } from "@/app/api/auth/signout/route";
import { SessionInvalidationService } from "@/lib/services/SessionInvalidationService";
import {
  connectMongoMemory,
  disconnectMongoMemory,
} from "../../helpers/mongoMemory";

const TEST_SECRET = "integration-test-nextauth-secret-32ch";
const SESSION_COOKIE = "next-auth.session-token";
const CSRF_COOKIE = "next-auth.csrf-token";

function buildCsrfPair(secret: string) {
  const token = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${token}${secret}`).digest("hex");
  return { token, cookie: `${token}|${hash}` };
}

async function buildSessionCookie(userId: string, email: string, tokenVersion = 0) {
  return encode({
    token: {
      id: userId,
      email,
      tokenVersion,
      sub: userId,
    },
    secret: TEST_SECRET,
    maxAge: 2 * 60 * 60,
  });
}

function signoutRequest(csrfToken: string, csrfCookie: string, sessionToken: string) {
  const body = new URLSearchParams({ csrfToken, json: "true" });
  return signOutPost(
    new Request("http://localhost:3001/api/auth/signout", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie: `${CSRF_COOKIE}=${csrfCookie}; ${SESSION_COOKIE}=${sessionToken}`,
      },
      body: body.toString(),
    }) as any,
  );
}

describe("POST /api/auth/signout — invalidation session", () => {
  let userId: string;
  const email = "signout-user@test.com";

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    process.env.NEXTAUTH_URL = "http://localhost:3001";
    await connectMongoMemory();
  }, 30000);

  afterAll(async () => {
    await disconnectMongoMemory();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    const hashed = await bcrypt.hash("SecurePass123!", 1);
    const user = await User.create({
      email,
      name: "Signout User",
      role: "TEACHER",
      password: hashed,
      tokenVersion: 0,
    });
    userId = user._id.toString();
  });

  it("should return HTTP 200 on valid signout", async () => {
    const { token: csrfToken, cookie: csrfCookie } = buildCsrfPair(TEST_SECRET);
    const sessionToken = await buildSessionCookie(userId, email, 0);

    const res = await signoutRequest(csrfToken, csrfCookie, sessionToken);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("url");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("should return 400 when CSRF token is missing", async () => {
    const sessionToken = await buildSessionCookie(userId, email, 0);
    const res = await signoutRequest("", "invalid|cookie", sessionToken);
    expect(res.status).toBe(400);
  });

  it("should increment tokenVersion in database on logout", async () => {
    const { token: csrfToken, cookie: csrfCookie } = buildCsrfPair(TEST_SECRET);
    const sessionToken = await buildSessionCookie(userId, email, 0);

    await signoutRequest(csrfToken, csrfCookie, sessionToken);

    const version = await SessionInvalidationService.getTokenVersion(userId);
    expect(version).toBe(1);
  });

  it("should reject session replay after logout (jwt callback)", async () => {
    const staleToken = {
      id: userId,
      email,
      tokenVersion: 0,
      sub: userId,
    };

    await SessionInvalidationService.invalidateUserSessions(userId);

    const jwtCallback = authOptions.callbacks?.jwt;
    expect(jwtCallback).toBeDefined();

    const refreshed = await jwtCallback!({
      token: { ...staleToken },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
      isNewUser: false,
      session: undefined,
    });

    expect((refreshed as { sessionInvalidated?: boolean }).sessionInvalidated).toBe(
      true,
    );

    const sessionCallback = authOptions.callbacks?.session;
    const session = await sessionCallback!({
      session: {
        user: { id: userId, email, name: "Signout User" },
        expires: new Date(Date.now() + 3600_000).toISOString(),
      },
      token: refreshed,
      user: undefined,
      newSession: undefined,
      trigger: "getSession",
    });

    expect(session.user).toBeUndefined();
  });
});
