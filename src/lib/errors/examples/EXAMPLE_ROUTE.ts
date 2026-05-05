/**
 * EXEMPLE DE ROUTE API AVEC GESTION D'ERREURS MULTILINGUE
 *
 * Ce fichier montre comment utiliser le système de gestion d'erreurs
 * dans une vraie route API Next.js avec support multilingue.
 */

import { NextResponse } from "next/server"
import { AuthenticationError, withErrorHandler, LanguageHelper } from "@/lib/errors"
// import User from "@/models/User"
// import bcrypt from "bcryptjs"

/**
 * EXEMPLE 1: Route Login avec détection automatique de langue
 *
 * Tester:
 * - Français: POST /api/auth/login
 * - Anglais: POST /api/auth/login?lang=en
 * - Anglais: POST /api/auth/login avec header X-Language: en
 */
export async function POST_LOGIN_EXAMPLE(req: Request) {
  return withErrorHandler(async (lang) => {
    // lang est automatiquement détecté : 'fr' ou 'en'
    const { email, password } = await req.json()

    // Validation des champs requis
    if (!email || !password) {
      throw AuthenticationError.missingCredentials(lang)
    }

    // Validation format email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw AuthenticationError.invalidEmailFormat(email, lang)
    }

    // Recherche de l'utilisateur
    // const user = await User.findOne({ email: email.toLowerCase() })
    const user = null // Simulé pour l'exemple

    if (!user) {
      throw AuthenticationError.userNotFoundByEmail(email, lang, {
        requestPath: new URL(req.url).pathname,
      })
    }

    // Vérification que l'utilisateur a un mot de passe (pas OAuth)
    // if (!user.password) {
    //   throw AuthenticationError.differentAuthMethod(lang, {
    //     userId: user._id.toString(),
    //     availableMethods: user.authMethods,
    //   })
    // }

    // Vérification du mot de passe
    // const isValid = await bcrypt.compare(password, user.password)
    const isValid = false // Simulé

    if (!isValid) {
      throw AuthenticationError.invalidPassword(lang, {
        // userId: user._id.toString(),
        attempt: 1,
        timestamp: new Date().toISOString(),
      })
    }

    // Succès
    return NextResponse.json({
      success: true,
      message: lang === "fr" ? "Connexion réussie" : "Login successful",
      user: {
        // id: user._id.toString(),
        // email: user.email,
        // name: user.name,
      },
    })
  }, req) // ⚠️ Important: passer req pour la détection de langue
}

/**
 * EXEMPLE 2: Route Register avec validation complète
 *
 * Tester:
 * - Français: POST /api/auth/register
 * - Anglais: POST /api/auth/register?lang=en
 */
export async function POST_REGISTER_EXAMPLE(req: Request) {
  return withErrorHandler(async (lang) => {
    const { email, password, phone } = await req.json()

    // Validation email et mot de passe requis
    if (!email || !password) {
      throw AuthenticationError.missingCredentials(lang)
    }

    // Validation format email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw AuthenticationError.invalidEmailFormat(email, lang)
    }

    // Validation mot de passe
    if (password.length < 8) {
      throw AuthenticationError.weakPassword(lang, {
        passwordLength: password.length,
        requiredLength: 8,
      })
    }

    // Validation format téléphone (optionnel)
    if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) {
      throw AuthenticationError.invalidPhoneFormat(phone, lang)
    }

    // Vérifier si l'email existe déjà
    // const existingUser = await User.findOne({ email: email.toLowerCase() })
    const existingUser = null // Simulé

    // if (existingUser) {
    //   throw AuthenticationError.emailAlreadyExists(email, lang, {
    //     existingSince: existingUser.createdAt,
    //   })
    // }

    // Vérifier si le téléphone existe déjà
    // if (phone) {
    //   const existingPhone = await User.findOne({ phone })
    //   if (existingPhone) {
    //     throw AuthenticationError.phoneAlreadyExists(phone, lang)
    //   }
    // }

    // Créer l'utilisateur
    try {
      // const hashedPassword = await bcrypt.hash(password, 10)
      // const user = await User.create({
      //   email: email.toLowerCase(),
      //   password: hashedPassword,
      //   phone,
      // })

      return NextResponse.json({
        success: true,
        message: lang === "fr" ? "Compte créé avec succès" : "Account created successfully",
        user: {
          // id: user._id.toString(),
          // email: user.email,
        },
      })
    } catch (error: any) {
      // Erreur de création
      throw AuthenticationError.userCreationFailed(lang, {
        originalError: error.message,
      })
    }
  }, req)
}

/**
 * EXEMPLE 3: Route Verify Email
 *
 * Tester:
 * - POST /api/auth/verify?lang=en
 */
export async function POST_VERIFY_EXAMPLE(req: Request) {
  return withErrorHandler(async (lang) => {
    const { token } = await req.json()

    if (!token) {
      throw AuthenticationError.invalidVerificationCode(lang)
    }

    // Vérifier le token
    // const verification = await VerificationToken.findOne({ token })
    const verification = null // Simulé

    if (!verification) {
      throw AuthenticationError.invalidVerificationCode(lang, {
        tokenPrefix: token.substring(0, 8),
      })
    }

    // Vérifier si expiré
    // if (verification.expiresAt < new Date()) {
    //   throw AuthenticationError.invalidVerificationCode(lang, {
    //     expired: true,
    //     expiredAt: verification.expiresAt,
    //   })
    // }

    // Marquer l'email comme vérifié
    // await User.updateOne(
    //   { _id: verification.userId },
    //   { emailVerified: true }
    // )

    return NextResponse.json({
      success: true,
      message: lang === "fr" ? "Email vérifié avec succès" : "Email verified successfully",
    })
  }, req)
}

/**
 * EXEMPLE 4: Extraction manuelle de la langue (pour middleware, etc.)
 */
export async function GET_LANGUAGE_INFO_EXAMPLE(req: Request) {
  // Extraire manuellement la langue
  const detectedLang = LanguageHelper.getLanguageFromRequest(req)
  const supportedLanguages = LanguageHelper.getSupportedLanguages()
  const defaultLanguage = LanguageHelper.getDefaultLanguage()

  return NextResponse.json({
    detectedLanguage: detectedLang,
    supportedLanguages,
    defaultLanguage,
    sources: {
      queryParam: new URL(req.url).searchParams.get("lang"),
      xLanguageHeader: req.headers.get("x-language"),
      acceptLanguage: req.headers.get("accept-language"),
    },
  })
}

/**
 * EXEMPLE 5: Route avec gestion d'erreur manuelle (try-catch)
 * Utile si vous avez besoin de faire des opérations avant/après le handler
 */
export async function POST_MANUAL_ERROR_HANDLING_EXAMPLE(req: Request) {
  const lang = LanguageHelper.getLanguageFromRequest(req)

  try {
    const { email } = await req.json()

    if (!email) {
      throw AuthenticationError.invalidEmailFormat("", lang)
    }

    // Votre logique ici...

    return NextResponse.json({ success: true })
  } catch (error) {
    // L'erreur est automatiquement formatée
    if (error instanceof AuthenticationError) {
      return NextResponse.json(error.toJSON(), { status: error.httpStatus })
    }

    // Erreur inconnue
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: lang === "fr" ? "Erreur inattendue" : "Unexpected error",
          severity: "ERROR",
          category: "UNKNOWN",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}

/**
 * EXEMPLE 6: Middleware pour vérifier l'authentification
 * (Pour utilisation dans un middleware Next.js ou dans une fonction réutilisable)
 */
export async function requireAuth(req: Request) {
  const lang = LanguageHelper.getLanguageFromRequest(req)
  const token = req.headers.get("authorization")?.replace("Bearer ", "")

  if (!token) {
    throw AuthenticationError.invalidToken(lang, {
      path: new URL(req.url).pathname,
    })
  }

  // Vérifier le token
  // const session = await verifyToken(token)
  const session = null

  if (!session) {
    throw AuthenticationError.sessionExpired(lang)
  }

  // return session
}

/**
 * COMMENT UTILISER CES EXEMPLES:
 *
 * 1. Copiez le code de l'exemple souhaité
 * 2. Créez une route dans src/app/api/votre-route/route.ts
 * 3. Exportez la fonction comme POST, GET, etc.
 *
 * Exemple:
 *
 * // src/app/api/auth/login/route.ts
 * export { POST_LOGIN_EXAMPLE as POST } from '@/lib/errors/EXAMPLE_ROUTE'
 *
 * Ou créez votre propre route en suivant le pattern :
 *
 * export async function POST(req: Request) {
 *   return withErrorHandler(async (lang) => {
 *     // Votre code ici
 *     // Utilisez lang pour les erreurs
 *   }, req)
 * }
 */
