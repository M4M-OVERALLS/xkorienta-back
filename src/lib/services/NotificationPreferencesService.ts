import mongoose from 'mongoose'
import NotificationPreferences, {
    INotificationPreferences,
    ITypePrefs,
    IQuietHours,
} from '@/models/NotificationPreferences'
import connectDB from '@/lib/mongodb'
import logger from '@/lib/utils/logger'

/** Regex de validation du format HH:mm (ex: "22:00", "06:30") */
const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Mapping type de notification backend → catégorie de préférence utilisateur.
 * Les types absents du mapping déclenchent toujours la push (safe default).
 */
const TYPE_TO_PREF_CATEGORY: Record<string, keyof ITypePrefs> = {
    exam_result: 'exam_result',
    exam_pending: 'exam_pending',
    exam_reminder: 'exam_pending',
    new_message: 'new_message',
    forum_reply: 'forum_reply',
    assistance_response: 'assistance_response',
    xp: 'rewards',
    level_up: 'rewards',
    badge: 'rewards',
    subscription_warning: 'account',
    account: 'account',
}

/**
 * Vérifie si un fuseau horaire IANA est valide (ex: "Africa/Douala").
 * Utilise l'API Intl native de Node.js — aucune dépendance externe.
 */
function isValidIANATimezone(tz: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz })
        return true
    } catch {
        return false
    }
}

/**
 * Détermine si l'heure actuelle est dans la fenêtre de silence d'un utilisateur.
 * Gère les fenêtres qui traversent minuit (ex: 22:00 → 06:00).
 * L'évaluation se fait dans la timezone du user via l'API Intl.
 */
function isInQuietHours(qh: IQuietHours): boolean {
    if (!qh.enabled) return false

    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: qh.timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    }).formatToParts(now)

    const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10)
    const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10)
    const currentMinutes = hour * 60 + minute

    const [sH, sM] = qh.start.split(':').map(Number)
    const [eH, eM] = qh.end.split(':').map(Number)
    const startMinutes = sH * 60 + sM
    const endMinutes = eH * 60 + eM

    // Fenêtre sur la même journée (ex: 09:00 → 17:00)
    if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes
    }
    // Fenêtre qui traverse minuit (ex: 22:00 → 06:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

/**
 * Erreurs de validation retournées par patchPreferences
 */
export class PreferencesValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'PreferencesValidationError'
    }
}

export class NotificationPreferencesService {
    /**
     * Retourne les préférences de l'utilisateur.
     * Lazy init : crée une ligne avec les valeurs par défaut si elle n'existe pas encore.
     */
    static async getOrCreate(userId: string): Promise<INotificationPreferences> {
        await connectDB()

        const existing = await NotificationPreferences.findOne({
            userId: new mongoose.Types.ObjectId(userId),
        })

        if (existing) return existing

        return NotificationPreferences.create({
            userId: new mongoose.Types.ObjectId(userId),
        })
    }

    /**
     * Met à jour partiellement les préférences (merge profond).
     * Seuls les champs envoyés sont modifiés — les autres restent intacts.
     *
     * @throws {PreferencesValidationError} si le format HH:mm ou la timezone sont invalides
     */
    static async patch(
        userId: string,
        body: {
            channels?: Partial<INotificationPreferences['channels']>
            types?: Partial<INotificationPreferences['types']>
            quietHours?: Partial<INotificationPreferences['quietHours']>
        }
    ): Promise<INotificationPreferences> {
        // Validation avant toute écriture en base
        if (body.quietHours) {
            const qh = body.quietHours
            if (qh.start !== undefined && !HH_MM_REGEX.test(qh.start)) {
                throw new PreferencesValidationError(
                    `Format d'heure invalide pour quietHours.start : "${qh.start}" (attendu HH:mm)`
                )
            }
            if (qh.end !== undefined && !HH_MM_REGEX.test(qh.end)) {
                throw new PreferencesValidationError(
                    `Format d'heure invalide pour quietHours.end : "${qh.end}" (attendu HH:mm)`
                )
            }
            if (qh.timezone !== undefined && !isValidIANATimezone(qh.timezone)) {
                throw new PreferencesValidationError(
                    `Fuseau horaire IANA invalide : "${qh.timezone}" (ex: "Africa/Douala", "Europe/Paris")`
                )
            }
        }

        await connectDB()

        const prefs = await NotificationPreferencesService.getOrCreate(userId)

        if (body.channels) {
            prefs.channels = { ...prefs.channels.toObject(), ...body.channels } as any
            prefs.markModified('channels')
        }
        if (body.types) {
            prefs.types = { ...prefs.types.toObject(), ...body.types } as any
            prefs.markModified('types')
        }
        if (body.quietHours) {
            prefs.quietHours = { ...prefs.quietHours.toObject(), ...body.quietHours } as any
            prefs.markModified('quietHours')
        }

        await prefs.save()
        return prefs
    }

    /**
     * Détermine si une push FCM doit être envoyée pour cette notification.
     * Applique les 3 gates dans l'ordre : master switch → type → heures de silence.
     *
     * La notification in-app est toujours créée en base — seule la push est filtrée.
     */
    static async canSendPush(userId: string, notificationType: string): Promise<boolean> {
        try {
            await connectDB()

            const prefs = await NotificationPreferences.findOne({
                userId: new mongoose.Types.ObjectId(userId),
            }).lean()

            // Pas de préférences en base → on utilise les valeurs par défaut (tout activé)
            if (!prefs) return true

            // Gate 1 — master switch push
            if (!prefs.channels.push) return false

            // Gate 2 — type spécifique
            const category = TYPE_TO_PREF_CATEGORY[notificationType]
            if (category && prefs.types[category] === false) return false

            // Gate 3 — heures de silence
            if (isInQuietHours(prefs.quietHours)) return false

            return true
        } catch (error) {
            // En cas d'erreur de lecture des prefs, on envoie quand même la push (safe default)
            logger.error('[NotificationPreferencesService] Erreur lors de la vérification des préférences:', error)
            return true
        }
    }
}
