import { BaseApplicationError } from "./BaseError"
import { ErrorContext, ErrorSeverity, ErrorCategory, SupportedLanguage } from "./types"
import { LanguageHelper } from "./languageHelper"
import errorCatalog from "../config/errorCatalog.json"

/**
 * XOrientation Error — Module IA d'orientation scolaire & professionnelle
 * Codes XOR_001 → XOR_010
 */
export class XOrientationError extends BaseApplicationError {
  constructor(
    errorCode: keyof typeof errorCatalog.XORIENTATION,
    language?: SupportedLanguage,
    context?: ErrorContext
  ) {
    const errorDef = errorCatalog.XORIENTATION[errorCode]
    const lang = language || LanguageHelper.getDefaultLanguage()

    if (!errorDef) {
      const fallbackMessage =
        lang === "fr"
          ? "Erreur inconnue du module d'orientation"
          : "Unknown orientation module error"
      super("XOR_UNKNOWN", fallbackMessage, 500, "ERROR", "UNKNOWN", lang, context)
    } else {
      const message = errorDef.message[lang] ?? errorDef.message.fr
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

    Object.setPrototypeOf(this, XOrientationError.prototype)
  }

  // ── Factory methods ────────────────────────────────────────────────────────

  /** XOR_001 — Clé API Anthropic absente */
  static apiKeyMissing(language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_001", language)
  }

  /** XOR_002 — JSON body invalide */
  static invalidJsonBody(language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_002", language)
  }

  /** XOR_003 — Paramètres de conversation invalides (Zod) */
  static invalidParameters(
    language?: SupportedLanguage,
    context?: ErrorContext
  ): XOrientationError {
    return new XOrientationError("XOR_003", language, context)
  }

  /** XOR_004 — Rate limit dépassé */
  static rateLimitExceeded(language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_004", language)
  }

  /** XOR_005 — Erreur Anthropic API */
  static anthropicError(cause: string, language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_005", language, { cause })
  }

  /** XOR_006 — Erreur pendant le streaming SSE */
  static streamError(cause: string, language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_006", language, { cause })
  }

  /** XOR_007 — Échec d'enregistrement en base */
  static registrationFailed(cause: string, language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_007", language, { cause })
  }

  /** XOR_008 — Niveau scolaire inconnu */
  static invalidLevel(level: string, language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_008", language, { level })
  }

  /** XOR_009 — Conversation dépasse 50 messages */
  static conversationTooLong(
    messageCount: number,
    language?: SupportedLanguage
  ): XOrientationError {
    return new XOrientationError("XOR_009", language, { messageCount })
  }

  /** XOR_010 — Service temporairement indisponible */
  static serviceUnavailable(language?: SupportedLanguage): XOrientationError {
    return new XOrientationError("XOR_010", language)
  }
}
