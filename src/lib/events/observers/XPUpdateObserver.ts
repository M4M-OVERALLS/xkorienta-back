import { IObserver } from '../interfaces/IObserver'
import { Event, EventType, ExamCompletedEvent, BadgeEarnedEvent } from '../types'
import { publishEvent } from '../EventPublisher'
import LearnerProfile from '@/models/LearnerProfile'

/**
 * Observateur pour la gestion de l'expérience (XP) et des niveaux
 *
 * NOTE: Cet observateur gère les événements d'examens et de badges.
 * D'autres sources de XP (SCHOOL_LINKED, PROFILE_COMPLETED, etc.) sont
 * gérées directement par le GamificationService qui publie automatiquement
 * les événements XP_GAINED et LEVEL_UP.
 *
 * @see GamificationService pour la liste complète des sources XP
 */
export class XPUpdateObserver implements IObserver {
    // Configuration des gains d'XP
    private readonly XP_RATES = {
        EXAM_PASSED: 100,
        PERFECT_SCORE_BONUS: 50,
        BADGE_EARNED: 200,
        QUESTION_ANSWERED: 10,
        STREAK_BONUS: 20
    }

    getName(): string {
        return 'XPUpdateObserver'
    }

    getInterestedEvents(): string[] {
        return [
            EventType.EXAM_COMPLETED,
            EventType.BADGE_EARNED,
            EventType.QUESTION_ANSWERED
        ]
    }

    async update(event: Event): Promise<void> {
        switch (event.type) {
            case EventType.EXAM_COMPLETED:
                await this.handleExamXP(event as ExamCompletedEvent)
                break

            case EventType.BADGE_EARNED:
                await this.handleBadgeXP(event as BadgeEarnedEvent)
                break

            // case EventType.QUESTION_ANSWERED:
            //     await this.handleQuestionXP(event)
            //     break
        }
    }

    private async handleExamXP(event: ExamCompletedEvent): Promise<void> {
        let xpGain = 0

        // XP de base pour la réussite
        if (event.data.passed) {
            xpGain += this.XP_RATES.EXAM_PASSED

            // Bonus selon le score
            xpGain += Math.floor(event.data.percentage) // 1% = 1 XP
        } else {
            // XP de consolation pour la participation
            xpGain += 10
        }

        // Bonus perfection
        if (event.data.percentage === 100) {
            xpGain += this.XP_RATES.PERFECT_SCORE_BONUS
        }

        if (xpGain > 0) {
            await this.addXP(event.userId, xpGain, `Examen terminé (${event.data.percentage}%)`)
        }
    }

    private async handleBadgeXP(event: BadgeEarnedEvent): Promise<void> {
        await this.addXP(event.userId, this.XP_RATES.BADGE_EARNED, `Badge obtenu: ${event.data.badgeName}`)
    }

    private async addXP(userId: any, amount: number, source: string): Promise<void> {
        console.log(`[XP] Adding ${amount} XP to user ${userId} for: ${source}`)

        try {
            const profile = await LearnerProfile.findOne({ user: userId })
            if (!profile) return

            const oldLevel = profile.gamification.level

            // Ajouter l'XP
            profile.gamification.xp += amount

            // Vérifier la montée de niveau
            // Formule simple: Level = sqrt(XP / 100)
            // Ou seuils fixes: 0, 100, 300, 600, 1000...
            const newLevel = this.calculateLevel(profile.gamification.xp)

            if (newLevel > oldLevel) {
                profile.gamification.level = newLevel
                console.log(`[XP] User ${userId} leveled up to ${newLevel}!`)

                // Publier l'événement LEVEL_UP
                await publishEvent({
                    type: EventType.LEVEL_UP,
                    timestamp: new Date(),
                    userId: userId,
                    data: {
                        oldLevel,
                        newLevel,
                        rewards: [`Niveau ${newLevel} débloqué`]
                    }
                })
            }

            await profile.save()

            // Publier l'événement XP_GAINED
            await publishEvent({
                type: EventType.XP_GAINED,
                timestamp: new Date(),
                userId: userId,
                data: {
                    amount,
                    source,
                    newTotal: profile.gamification.xp
                }
            })

        } catch (error) {
            console.error('[XP] Error adding XP:', error)
        }
    }

    /**
     * Calcule le niveau en fonction des points totaux
     * Formule: Niveau N nécessite 100 * N^2 points
     * Donc Niveau = racine(Points / 100)
     */
    private calculateLevel(points: number): number {
        return Math.floor(Math.sqrt(points / 100)) + 1
    }
}
