/**
 * GamificationService
 * 
 * Gestion du système de points, badges, niveaux et récompenses
 * - Attribution de points (XP)
 * - Déblocage de badges
 * - Calcul des niveaux
 * - Suivi des streaks
 */

import mongoose from 'mongoose'
import { Badge, UserBadge, BadgeCategory, BadgeRarity } from '@/models/Badge'
import { Challenge, ChallengeProgress, ChallengeStatus } from '@/models/Challenge'
import { publishEvent } from '@/lib/events/EventPublisher'
import { EventType } from '@/lib/events/types'
import { MasteryLevel, MASTERY_LEVEL_PERCENTAGES } from '@/lib/patterns/EvaluationStrategy'

// ==========================================
// TYPES
// ==========================================

export interface XPTransaction {
    userId: string
    amount: number
    source: XPSource
    sourceId?: string
    description: string
    timestamp: Date
}

export enum XPSource {
    EXAM_COMPLETED = 'EXAM_COMPLETED',
    EXAM_PASSED = 'EXAM_PASSED',
    PERFECT_SCORE = 'PERFECT_SCORE',
    BADGE_EARNED = 'BADGE_EARNED',
    CHALLENGE_COMPLETED = 'CHALLENGE_COMPLETED',
    STREAK_BONUS = 'STREAK_BONUS',
    SELF_EVAL = 'SELF_EVAL',
    DAILY_LOGIN = 'DAILY_LOGIN',
    HELP_GIVEN = 'HELP_GIVEN',
    SCHOOL_LINKED = 'SCHOOL_LINKED',
    PROFILE_COMPLETED = 'PROFILE_COMPLETED'
}

export interface UserGamificationStats {
    userId: string
    totalXP: number
    level: number
    nextLevelXP: number
    currentLevelProgress: number // 0-100%
    badges: {
        total: number
        byCategory: Record<BadgeCategory, number>
        recent: any[]
    }
    streak: {
        current: number
        longest: number
        lastActivityDate: Date | null
    }
    challenges: {
        active: number
        completed: number
    }
}

export interface LevelInfo {
    level: number
    title: string
    minXP: number
    maxXP: number
    color: string
    icon: string
}

// Level thresholds and titles
const LEVELS: LevelInfo[] = [
    { level: 1, title: "Débutant", minXP: 0, maxXP: 100, color: "#9ca3af", icon: "🌱" },
    { level: 2, title: "Apprenti", minXP: 100, maxXP: 300, color: "#22c55e", icon: "📚" },
    { level: 3, title: "Étudiant", minXP: 300, maxXP: 600, color: "#84cc16", icon: "🎓" },
    { level: 4, title: "Érudit", minXP: 600, maxXP: 1000, color: "#eab308", icon: "⭐" },
    { level: 5, title: "Savant", minXP: 1000, maxXP: 1500, color: "#f59e0b", icon: "🌟" },
    { level: 6, title: "Expert", minXP: 1500, maxXP: 2200, color: "#f97316", icon: "💫" },
    { level: 7, title: "Maître", minXP: 2200, maxXP: 3000, color: "#ef4444", icon: "🔥" },
    { level: 8, title: "Grand Maître", minXP: 3000, maxXP: 4000, color: "#dc2626", icon: "👑" },
    { level: 9, title: "Sage", minXP: 4000, maxXP: 5500, color: "#7c3aed", icon: "🧙" },
    { level: 10, title: "Légende", minXP: 5500, maxXP: Infinity, color: "#8b5cf6", icon: "🏆" }
]

// XP rewards for different actions
const XP_REWARDS: Record<XPSource, number> = {
    [XPSource.EXAM_COMPLETED]: 25,
    [XPSource.EXAM_PASSED]: 50,
    [XPSource.PERFECT_SCORE]: 100,
    [XPSource.BADGE_EARNED]: 0, // Badge has its own points
    [XPSource.CHALLENGE_COMPLETED]: 0, // Challenge has its own points
    [XPSource.STREAK_BONUS]: 10, // Per day of streak
    [XPSource.SELF_EVAL]: 5,
    [XPSource.DAILY_LOGIN]: 5,
    [XPSource.HELP_GIVEN]: 15,
    [XPSource.SCHOOL_LINKED]: 75,
    [XPSource.PROFILE_COMPLETED]: 50
}

// ==========================================
// GAMIFICATION SERVICE
// ==========================================

export class GamificationService {

    /**
     * Award XP to a user
     */
    static async awardXP(
        userId: string,
        source: XPSource,
        options: {
            sourceId?: string
            multiplier?: number
            customAmount?: number
            description?: string
        } = {}
    ): Promise<XPTransaction> {
        const User = mongoose.models.User
        const { sourceId, multiplier = 1, customAmount, description } = options

        const baseAmount = customAmount ?? XP_REWARDS[source]
        const amount = Math.round(baseAmount * multiplier)

        if (amount <= 0) {
            return {
                userId,
                amount: 0,
                source,
                sourceId,
                description: description || `XP from ${source}`,
                timestamp: new Date()
            }
        }

        // Update user's total XP
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $inc: { 'gamification.totalXP': amount },
                $set: { 'gamification.lastActivityDate': new Date() }
            },
            { new: true }
        ).lean()

        if (!user) {
            throw new Error('User not found')
        }

        // Check for level up
        const newLevel = this.calculateLevel((user as any).gamification?.totalXP || 0)
        const currentLevel = (user as any).gamification?.level || 1

        if (newLevel > currentLevel) {
            await User.findByIdAndUpdate(userId, {
                $set: { 'gamification.level': newLevel }
            })

            // Publish level up event
            await publishEvent({
                type: EventType.LEVEL_UP,
                timestamp: new Date(),
                userId: new mongoose.Types.ObjectId(userId),
                data: {
                    oldLevel: currentLevel,
                    newLevel: newLevel,
                    levelInfo: LEVELS[newLevel - 1]
                }
            })
        }

        // Publish XP gained event
        await publishEvent({
            type: EventType.XP_GAINED,
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(userId),
            data: {
                amount,
                source,
                sourceId,
                newTotal: (user as any).gamification?.totalXP || 0
            }
        })

        return {
            userId,
            amount,
            source,
            sourceId,
            description: description || `+${amount} XP from ${source}`,
            timestamp: new Date()
        }
    }

    /**
     * Calculate level from XP
     */
    static calculateLevel(xp: number): number {
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (xp >= LEVELS[i].minXP) {
                return LEVELS[i].level
            }
        }
        return 1
    }

    /**
     * Get level info for a given level
     */
    static getLevelInfo(level: number): LevelInfo {
        const clamped = Math.max(1, Math.min(level, LEVELS.length))
        return LEVELS[clamped - 1]
    }

    /**
     * Check and award badges after an action
     */
    static async checkAndAwardBadges(
        userId: string,
        context: {
            examId?: string
            score?: number
            maxScore?: number
            subject?: string
        } = {}
    ): Promise<any[]> {
        const User = mongoose.models.User
        const Attempt = mongoose.models.Attempt

        const earnedBadges: any[] = []

        // Get all active badges
        const allBadges = await Badge.find({ isActive: true }).lean()

        // Get user's existing badges
        const existingBadges = await UserBadge.find({ userId }).lean()
        const earnedBadgeIds = new Set(existingBadges.map(b => b.badgeId.toString()))

        // Get user's attempt history for checks
        const attempts = await Attempt.find({ userId, status: 'COMPLETED' }).lean()

        for (const badge of allBadges) {
            // Skip if already earned
            if (earnedBadgeIds.has(badge._id.toString())) continue

            let earned = false
            const criteria = badge.criteria

            switch (criteria.type) {
                case 'EXAM_SCORE':
                    // Check if current exam score meets threshold
                    if (context.score !== undefined && context.maxScore) {
                        const percentage = (context.score / context.maxScore) * 100
                        if (percentage >= criteria.threshold) {
                            earned = true
                        }
                    }
                    break

                case 'EXAM_COUNT':
                    // Check if user has completed enough exams
                    if (attempts.length >= criteria.threshold) {
                        earned = true
                    }
                    break

                case 'FIRST':
                    // Check for first-time achievements
                    if (criteria.threshold === 1 && attempts.length >= 1) {
                        earned = true
                    }
                    break

                case 'STREAK':
                    // Check streak (would need to calculate from user data)
                    const user = await User.findById(userId).lean()
                    const streak = (user as any).gamification?.currentStreak || 0
                    if (streak >= criteria.threshold) {
                        earned = true
                    }
                    break

                // Add more criteria types as needed
            }

            if (earned) {
                // Award the badge
                await UserBadge.create({
                    userId,
                    badgeId: badge._id,
                    earnedAt: new Date(),
                    earnedFromExam: context.examId ? new mongoose.Types.ObjectId(context.examId) : undefined,
                    pointsAwarded: badge.pointsValue
                })

                // Award XP for the badge
                if (badge.pointsValue > 0) {
                    await this.awardXP(userId, XPSource.BADGE_EARNED, {
                        customAmount: badge.pointsValue,
                        sourceId: badge._id.toString(),
                        description: `Badge "${badge.name}" débloqué!`
                    })
                }

                // Publish badge earned event
                await publishEvent({
                    type: EventType.BADGE_EARNED,
                    timestamp: new Date(),
                    userId: new mongoose.Types.ObjectId(userId),
                    data: {
                        badgeId: badge._id,
                        badgeName: badge.name,
                        badgeIcon: badge.icon,
                        badgeRarity: badge.rarity,
                        pointsAwarded: badge.pointsValue
                    }
                })

                earnedBadges.push(badge)
            }
        }

        return earnedBadges
    }

    /**
     * Update streak for a user
     */
    static async updateStreak(userId: string): Promise<{ current: number; longest: number }> {
        const User = mongoose.models.User

        const user = await User.findById(userId).lean()
        if (!user) throw new Error('User not found')

        const gamification = (user as any).gamification || {}
        const lastDate = gamification.lastActivityDate
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let currentStreak = gamification.currentStreak || 0
        let longestStreak = gamification.longestStreak || 0

        if (lastDate) {
            const lastDateNorm = new Date(lastDate)
            lastDateNorm.setHours(0, 0, 0, 0)

            const diffDays = Math.floor((today.getTime() - lastDateNorm.getTime()) / (1000 * 60 * 60 * 24))

            if (diffDays === 0) {
                // Same day, no change
            } else if (diffDays === 1) {
                // Consecutive day, increment streak
                currentStreak += 1

                // Award streak bonus XP every 7 days
                if (currentStreak % 7 === 0) {
                    await this.awardXP(userId, XPSource.STREAK_BONUS, {
                        customAmount: currentStreak * 2,
                        description: `Streak de ${currentStreak} jours!`
                    })

                    // Check for streak badges
                    await this.checkAndAwardBadges(userId)
                }
            } else {
                // Streak broken
                currentStreak = 1
            }
        } else {
            currentStreak = 1
        }

        longestStreak = Math.max(longestStreak, currentStreak)

        await User.findByIdAndUpdate(userId, {
            $set: {
                'gamification.currentStreak': currentStreak,
                'gamification.longestStreak': longestStreak,
                'gamification.lastActivityDate': new Date()
            }
        })

        return { current: currentStreak, longest: longestStreak }
    }

    /**
     * Get gamification stats for a user
     */
    static async getUserStats(userId: string): Promise<UserGamificationStats> {
        const User = mongoose.models.User

        const user = await User.findById(userId).lean()
        if (!user) throw new Error('User not found')

        const gamification = (user as any).gamification || {}
        const totalXP = gamification.totalXP || 0
        const level = this.calculateLevel(totalXP)
        const levelInfo = this.getLevelInfo(level)
        const nextLevelInfo = this.getLevelInfo(level + 1)

        // Calculate progress to next level
        const xpInCurrentLevel = totalXP - levelInfo.minXP
        const xpNeededForNextLevel = nextLevelInfo.minXP - levelInfo.minXP
        const currentLevelProgress = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100))

        // Get badges
        const userBadges = await UserBadge.find({ userId }).populate('badgeId').lean()
        const badgesByCategory: Record<BadgeCategory, number> = {
            [BadgeCategory.LEARNING]: 0,
            [BadgeCategory.PERFORMANCE]: 0,
            [BadgeCategory.CONSISTENCY]: 0,
            [BadgeCategory.SOCIAL]: 0,
            [BadgeCategory.MASTERY]: 0,
            [BadgeCategory.CHALLENGE]: 0,
            [BadgeCategory.SPECIAL]: 0
        }

        for (const ub of userBadges) {
            const badge = ub.badgeId as any
            if (badge?.category) {
                badgesByCategory[badge.category as BadgeCategory]++
            }
        }

        const recentBadges = userBadges
            .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
            .slice(0, 5)
            .map(ub => ub.badgeId)

        // Get active challenges
        const activeProgress = await ChallengeProgress.countDocuments({
            userId,
            completed: false
        })

        const completedChallenges = await ChallengeProgress.countDocuments({
            userId,
            completed: true
        })

        return {
            userId,
            totalXP,
            level,
            nextLevelXP: nextLevelInfo.minXP,
            currentLevelProgress,
            badges: {
                total: userBadges.length,
                byCategory: badgesByCategory,
                recent: recentBadges
            },
            streak: {
                current: gamification.currentStreak || 0,
                longest: gamification.longestStreak || 0,
                lastActivityDate: gamification.lastActivityDate || null
            },
            challenges: {
                active: activeProgress,
                completed: completedChallenges
            }
        }
    }

    /**
     * Process exam completion for gamification
     */
    static async processExamCompletion(
        userId: string,
        examId: string,
        score: number,
        maxScore: number
    ): Promise<{ xp: number; badges: any[] }> {
        const percentage = (score / maxScore) * 100
        let totalXP = 0

        // Base XP for completing
        const completionXP = await this.awardXP(userId, XPSource.EXAM_COMPLETED, { sourceId: examId })
        totalXP += completionXP.amount

        // Bonus XP for passing
        if (percentage >= 50) {
            const passXP = await this.awardXP(userId, XPSource.EXAM_PASSED, { sourceId: examId })
            totalXP += passXP.amount
        }

        // Bonus XP for perfect score
        if (percentage >= 100) {
            const perfectXP = await this.awardXP(userId, XPSource.PERFECT_SCORE, { sourceId: examId })
            totalXP += perfectXP.amount
        }

        // Score-based bonus
        const bonusMultiplier = percentage / 100
        if (bonusMultiplier > 0.7) {
            await this.awardXP(userId, XPSource.EXAM_COMPLETED, {
                sourceId: examId,
                customAmount: Math.round(25 * (bonusMultiplier - 0.7)),
                description: `Bonus performance ${Math.round(percentage)}%`
            })
        }

        // Update streak
        await this.updateStreak(userId)

        // Check for badges
        const badges = await this.checkAndAwardBadges(userId, {
            examId,
            score,
            maxScore
        })

        return { xp: totalXP, badges }
    }

    /**
     * Initialize default badges in the system
     */
    static async initializeDefaultBadges(): Promise<void> {
        const defaultBadges = [
            // Performance badges
            {
                name: "Premier Pas",
                description: "Compléter votre premier examen",
                icon: "🎯",
                category: BadgeCategory.LEARNING,
                rarity: BadgeRarity.COMMON,
                pointsValue: 25,
                criteria: { type: 'FIRST', threshold: 1, description: "Compléter 1 examen" },
                colors: { primary: "#22c55e", secondary: "#16a34a" }
            },
            {
                name: "Étoile Montante",
                description: "Obtenir 80% ou plus à un examen",
                icon: "⭐",
                category: BadgeCategory.PERFORMANCE,
                rarity: BadgeRarity.UNCOMMON,
                pointsValue: 50,
                criteria: { type: 'EXAM_SCORE', threshold: 80, description: "Score >= 80%" },
                colors: { primary: "#eab308", secondary: "#ca8a04" }
            },
            {
                name: "Perfection",
                description: "Obtenir un score parfait à un examen",
                icon: "💯",
                category: BadgeCategory.PERFORMANCE,
                rarity: BadgeRarity.RARE,
                pointsValue: 100,
                criteria: { type: 'EXAM_SCORE', threshold: 100, description: "Score = 100%" },
                colors: { primary: "#8b5cf6", secondary: "#7c3aed" }
            },
            {
                name: "Assidu",
                description: "Maintenir un streak de 7 jours",
                icon: "🔥",
                category: BadgeCategory.CONSISTENCY,
                rarity: BadgeRarity.UNCOMMON,
                pointsValue: 75,
                criteria: { type: 'STREAK', threshold: 7, description: "7 jours consécutifs" },
                colors: { primary: "#f97316", secondary: "#ea580c" }
            },
            {
                name: "Marathonien",
                description: "Compléter 10 examens",
                icon: "🏃",
                category: BadgeCategory.LEARNING,
                rarity: BadgeRarity.UNCOMMON,
                pointsValue: 100,
                criteria: { type: 'EXAM_COUNT', threshold: 10, description: "10 examens complétés" },
                colors: { primary: "#3b82f6", secondary: "#2563eb" }
            },
            {
                name: "Légende",
                description: "Compléter 50 examens",
                icon: "🏆",
                category: BadgeCategory.LEARNING,
                rarity: BadgeRarity.LEGENDARY,
                pointsValue: 500,
                criteria: { type: 'EXAM_COUNT', threshold: 50, description: "50 examens complétés" },
                colors: { primary: "#fbbf24", secondary: "#f59e0b" }
            }
        ]

        for (const badge of defaultBadges) {
            await Badge.findOneAndUpdate(
                { name: badge.name },
                { $setOnInsert: badge },
                { upsert: true }
            )
        }

        console.log('[GamificationService] Default badges initialized')
    }
}
