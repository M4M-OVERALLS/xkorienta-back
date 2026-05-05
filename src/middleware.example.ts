/**
 * EXEMPLE DE CONFIGURATION DU MIDDLEWARE
 *
 * Fichier: src/middleware.ts
 *
 * Ce fichier montre comment configurer le middleware de détection de langue.
 * Copiez ce contenu dans votre fichier src/middleware.ts si vous souhaitez
 * activer la détection automatique de langue.
 */

import { NextRequest } from "next/server"
import { languageMiddleware, LANGUAGE_MIDDLEWARE_MATCHER } from "@/lib/middleware"

/**
 * Middleware principal de l'application
 *
 * Ce middleware s'exécute sur toutes les requêtes matchant le pattern défini
 * dans la configuration ci-dessous.
 */
export function middleware(request: NextRequest) {
  // Détection automatique de la langue
  return languageMiddleware(request)

  // Si vous avez plusieurs middlewares, vous pouvez les composer :
  // const langResponse = languageMiddleware(request)
  // const authResponse = authMiddleware(langResponse)
  // return authResponse
}

/**
 * Configuration du matcher
 *
 * Définit sur quelles routes le middleware doit s'exécuter.
 * Par défaut, s'exécute sur toutes les routes sauf :
 * - _next/static (fichiers statiques)
 * - _next/image (optimisation d'images)
 * - favicon.ico (favicon)
 */
export const config = {
  matcher: LANGUAGE_MIDDLEWARE_MATCHER,

  // Ou personnalisez votre matcher :
  // matcher: [
  //   '/api/:path*',              // Seulement les routes API
  //   '/dashboard/:path*',        // Routes dashboard
  //   '/((?!_next|favicon).*)',   // Toutes sauf _next et favicon
  // ]
}

/**
 * ACTIVATION DU MIDDLEWARE
 *
 * Pour activer ce middleware :
 * 1. Renommez ce fichier en `middleware.ts` (enlevez `.example`)
 * 2. Redémarrez votre serveur de développement
 * 3. Le header X-Detected-Language sera maintenant injecté automatiquement
 *
 * VÉRIFICATION
 *
 * Pour vérifier que le middleware fonctionne :
 * ```bash
 * curl -X GET http://localhost:3001/api/health \
 *   -H "X-Language: en" \
 *   -v
 * ```
 *
 * Vous devriez voir le header `X-Detected-Language: en` dans la réponse.
 */
