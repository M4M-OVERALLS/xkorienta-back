import { BaseApplicationError } from "./BaseError"
import { ErrorContext, ErrorSeverity, ErrorCategory, SupportedLanguage } from "./types"
import { LanguageHelper } from "./languageHelper"
import errorCatalog from "../config/errorCatalog.json"

/**
 * Authentication Error
 * Used for all authentication-related errors
 */
export class AuthenticationError extends BaseApplicationError {
  constructor(
    errorCode: keyof typeof errorCatalog.AUTH,
    language?: SupportedLanguage,
    context?: ErrorContext
  ) {
    const errorDef = errorCatalog.AUTH[errorCode]
    const lang = language || LanguageHelper.getDefaultLanguage()

    if (!errorDef) {
      // Fallback for unknown error codes
      const fallbackMessage = lang === "fr"
        ? "Erreur d'authentification inconnue"
        : "Unknown authentication error"

      super(
        "AUTH_UNKNOWN",
        fallbackMessage,
        500,
        "ERROR",
        "UNKNOWN",
        lang,
        context
      )
    } else {
      // Get the message in the requested language
      const message = errorDef.message[lang] || errorDef.message.fr

      super(
        errorDef.code,
        message,
        errorDef.httpStatus,
        errorDef.severity as ErrorSeverity,
        errorDef.category as ErrorCategory,
        lang,
        context
      )
    }

    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }

  /**
   * Factory methods for common authentication errors
   * All methods accept an optional language parameter
   */

  static missingCredentials(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_001", language, context)
  }

  static userNotFoundByEmail(email: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_002", language, { ...context, email })
  }

  static userNotFoundByPhone(phone: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_003", language, { ...context, phone })
  }

  static invalidPassword(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_004", language, context)
  }

  static differentAuthMethod(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_005", language, context)
  }

  static invalidToken(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_006", language, context)
  }

  static sessionExpired(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_007", language, context)
  }

  static accessDenied(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_008", language, context)
  }

  static emailAlreadyExists(email: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_009", language, { ...context, email })
  }

  static phoneAlreadyExists(phone: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_010", language, { ...context, phone })
  }

  static invalidEmailFormat(email: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_011", language, { ...context, email })
  }

  static invalidPhoneFormat(phone: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_012", language, { ...context, phone })
  }

  static weakPassword(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_013", language, context)
  }

  static invalidVerificationCode(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_014", language, context)
  }

  static rateLimitExceeded(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_015", language, context)
  }

  static accountDisabled(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_016", language, context)
  }

  static emailNotVerified(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_017", language, context)
  }

  static invalidResetToken(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_018", language, context)
  }

  static oauthError(provider: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_019", language, { ...context, provider })
  }

  static oauthNotConfigured(provider: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_020", language, { ...context, provider })
  }

  static databaseError(operation: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_021", language, { ...context, operation })
  }

  static googleAccountConflict(email: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_022", language, { ...context, email })
  }

  static githubAccountConflict(email: string, language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_023", language, { ...context, email })
  }

  static userCreationFailed(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_024", language, context)
  }

  static emailSendingFailed(language?: SupportedLanguage, context?: ErrorContext): AuthenticationError {
    return new AuthenticationError("AUTH_025", language, context)
  }
}
