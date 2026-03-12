import { NextRequest, NextResponse } from "next/server"
import { LanguageHelper } from "@/lib/errors"

/**
 * Middleware pour détecter et injecter la langue dans les requêtes
 *
 * Ce middleware détecte automatiquement la langue de la requête et :
 * 1. L'ajoute dans les headers de la requête (X-Detected-Language)
 * 2. La rend accessible dans les routes API
 *
 * Sources de détection (par ordre de priorité) :
 * 1. Query parameter: ?lang=en
 * 2. Header: X-Language
 * 3. Header: Accept-Language
 * 4. Default: fr
 *
 * Usage dans middleware.ts :
 * ```typescript
 * import { languageMiddleware } from '@/lib/middleware/languageMiddleware'
 *
 * export function middleware(request: NextRequest) {
 *   return languageMiddleware(request)
 * }
 * ```
 */
export function languageMiddleware(request: NextRequest) {
  // Détecter la langue depuis la requête
  const detectedLang = LanguageHelper.getLanguageFromRequest(request)

  // Créer une nouvelle requête avec le header X-Detected-Language
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("X-Detected-Language", detectedLang)

  // Continuer avec la requête modifiée
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Ajouter le header dans la réponse aussi (utile pour debug)
  response.headers.set("X-Detected-Language", detectedLang)

  return response
}

/**
 * Matcher de routes pour le middleware
 * À utiliser dans middleware.ts
 *
 * Example:
 * ```typescript
 * export const config = {
 *   matcher: LANGUAGE_MIDDLEWARE_MATCHER
 * }
 * ```
 */
export const LANGUAGE_MIDDLEWARE_MATCHER = [
  /*
   * Match toutes les routes API sauf :
   * - _next/static (fichiers statiques)
   * - _next/image (optimisation d'images)
   * - favicon.ico (favicon)
   */
  "/((?!_next/static|_next/image|favicon.ico).*)",
]

/**
 * Helper pour extraire la langue détectée depuis les headers
 * Utilise le header X-Detected-Language injecté par le middleware
 *
 * Usage dans les routes API :
 * ```typescript
 * export async function POST(req: Request) {
 *   const lang = getDetectedLanguage(req)
 *   // lang = 'fr' ou 'en'
 * }
 * ```
 */
export function getDetectedLanguage(request: Request) {
  const detectedLang = request.headers.get("X-Detected-Language")
  return LanguageHelper.normalize(detectedLang)
}
