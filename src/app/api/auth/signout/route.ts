import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isValidNextAuthCsrfToken } from "@/lib/auth/csrf";
import { SessionInvalidationService } from "@/lib/services/SessionInvalidationService";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

const CSRF_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-next-auth.csrf-token"
    : "next-auth.csrf-token";

function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(CSRF_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function parseCsrfToken(req: NextRequest): Promise<string> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    return form.get("csrfToken")?.toString() ?? "";
  }

  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      return typeof body?.csrfToken === "string" ? body.csrfToken : "";
    } catch {
      return "";
    }
  }

  return "";
}

/**
 * POST /api/auth/signout
 * Déconnexion avec invalidation serveur (tokenVersion) + suppression du cookie session.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 },
      );
    }

    const csrfToken = await parseCsrfToken(req);
    const csrfCookie = req.cookies.get(CSRF_COOKIE)?.value;

    if (!isValidNextAuthCsrfToken(csrfToken, csrfCookie, secret)) {
      return NextResponse.json(
        { error: "Jeton CSRF invalide ou manquant" },
        { status: 400 },
      );
    }

    const token = await getToken({ req, secret });
    if (token?.id) {
      await SessionInvalidationService.invalidateUserSessions(
        token.id as string,
      );
    }

    const callbackUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
    const response = NextResponse.json({ url: callbackUrl }, { status: 200 });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    console.error("[Auth Signout] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/auth/signout — redirige vers la page de login (compat NextAuth).
 */
export async function GET(req: NextRequest) {
  const loginUrl = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(loginUrl);
}
