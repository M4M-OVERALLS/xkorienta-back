import { BaseApplicationError } from "./BaseError"
import { ErrorContext, ErrorSeverity, ErrorCategory, SupportedLanguage } from "./types"
import { LanguageHelper } from "./languageHelper"
import errorCatalog from "../config/errorCatalog.json"

/**
 * InscriptionError — Module d'inscription des apprenants dans les etablissements
 * Codes INS_001 -> INS_010
 */
export class InscriptionError extends BaseApplicationError {
    constructor(
        errorCode: keyof typeof errorCatalog.INSCRIPTION,
        language?: SupportedLanguage,
        context?: ErrorContext
    ) {
        const errorDef = errorCatalog.INSCRIPTION[errorCode]
        const lang = language || LanguageHelper.getDefaultLanguage()

        if (!errorDef) {
            const fallbackMessage =
                lang === "fr"
                    ? "Erreur inconnue du module d'inscription"
                    : "Unknown inscription module error"
            super("INS_UNKNOWN", fallbackMessage, 500, "ERROR", "UNKNOWN", lang, context)
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

        Object.setPrototypeOf(this, InscriptionError.prototype)
    }

    // ── Factory methods ─────────────────────────────────────────────────────

    /** INS_001 — Fiche d'inscription introuvable */
    static formNotFound(language?: SupportedLanguage, context?: ErrorContext): InscriptionError {
        return new InscriptionError("INS_001", language, context)
    }

    /** INS_002 — Inscription fermee ou expiree */
    static inscriptionClosed(language?: SupportedLanguage, context?: ErrorContext): InscriptionError {
        return new InscriptionError("INS_002", language, context)
    }

    /** INS_003 — Capacite maximale atteinte */
    static capacityReached(language?: SupportedLanguage, context?: ErrorContext): InscriptionError {
        return new InscriptionError("INS_003", language, context)
    }

    /** INS_004 — Candidature deja soumise */
    static duplicateApplication(language?: SupportedLanguage, context?: ErrorContext): InscriptionError {
        return new InscriptionError("INS_004", language, context)
    }

    /** INS_005 — Seul un brouillon peut etre modifie */
    static notDraft(language?: SupportedLanguage, context?: ErrorContext): InscriptionError {
        return new InscriptionError("INS_005", language, context)
    }

    /** INS_006 — Transition de statut invalide */
    static invalidTransition(
        from: string,
        to: string,
        language?: SupportedLanguage
    ): InscriptionError {
        return new InscriptionError("INS_006", language, { from, to })
    }

    /** INS_007 — Champs obligatoires manquants pour la publication */
    static missingFieldsForPublish(
        fields: string[],
        language?: SupportedLanguage
    ): InscriptionError {
        return new InscriptionError("INS_007", language, { missingFields: fields })
    }

    /** INS_008 — Acces non autorise */
    static unauthorized(language?: SupportedLanguage, context?: ErrorContext): InscriptionError {
        return new InscriptionError("INS_008", language, context)
    }

    /** INS_009 — Document requis manquant */
    static missingDocument(docName: string, language?: SupportedLanguage): InscriptionError {
        return new InscriptionError("INS_009", language, { document: docName })
    }

    /** INS_010 — Pas de fiche publiee pour cet etablissement */
    static noPublishedForm(language?: SupportedLanguage, context?: ErrorContext): InscriptionError {
        return new InscriptionError("INS_010", language, context)
    }
}
