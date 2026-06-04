import { BaseApplicationError } from "./BaseError"
import { ErrorContext, ErrorSeverity, ErrorCategory, SupportedLanguage } from "./types"
import { LanguageHelper } from "./languageHelper"
import errorCatalog from "../config/errorCatalog.json"

/**
 * Notification Error — Push notifications FCM & préférences utilisateur
 * Codes NOTIF_001 → NOTIF_008
 */
export class NotificationError extends BaseApplicationError {
  constructor(
    errorCode: keyof typeof errorCatalog.NOTIF,
    language?: SupportedLanguage,
    context?: ErrorContext
  ) {
    const errorDef = errorCatalog.NOTIF[errorCode]
    const lang = language || LanguageHelper.getDefaultLanguage()

    if (!errorDef) {
      const fallbackMessage =
        lang === "fr"
          ? "Erreur inconnue du module notifications"
          : "Unknown notification module error"
      super("NOTIF_UNKNOWN", fallbackMessage, 500, "ERROR", "UNKNOWN", lang, context)
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

    Object.setPrototypeOf(this, NotificationError.prototype)
  }

  // ── Factory methods ────────────────────────────────────────────────────────

  /** NOTIF_001 — Token FCM manquant ou vide */
  static tokenRequired(language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_001", language)
  }

  /** NOTIF_002 — Platform invalide */
  static invalidPlatform(platform: string, language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_002", language, { receivedPlatform: platform })
  }

  /** NOTIF_003 — Corps de requête invalide */
  static invalidBody(language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_003", language)
  }

  /** NOTIF_004 — Format HH:mm invalide */
  static invalidTimeFormat(field: string, value: string, language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_004", language, { field, receivedValue: value })
  }

  /** NOTIF_005 — Fuseau horaire IANA invalide */
  static invalidTimezone(timezone: string, language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_005", language, { receivedTimezone: timezone })
  }

  /** NOTIF_006 — Body vide (aucune section fournie) */
  static noFieldProvided(language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_006", language)
  }

  /** NOTIF_007 — Firebase non configuré */
  static firebaseNotConfigured(language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_007", language)
  }

  /** NOTIF_008 — Erreur d'envoi FCM */
  static fcmSendError(cause: string, language?: SupportedLanguage): NotificationError {
    return new NotificationError("NOTIF_008", language, { cause })
  }
}
