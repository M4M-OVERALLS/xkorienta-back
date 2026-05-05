import mongoose from 'mongoose'
import Attempt from '@/models/Attempt'
import Response from '@/models/Response'
import Question from '@/models/Question'
import { AttemptStatus } from '@/models/Attempt'

/**
 * Service pour générer des analytics pour les guests (Freemium-Direct)
 * Génère des données pour le radar chart basé sur les tags des questions
 */
export class GuestAnalyticsService {
    /**
     * Génère les données du radar chart pour un guest basé sur ses tentatives
     * Analyse les performances par tag de compétence
     */
    static async generateRadarChartData(guestSessionId: string) {
        // Récupérer toutes les tentatives complétées du guest
        const attempts = await Attempt.find({
            guestSessionId,
            status: AttemptStatus.COMPLETED
        }).lean()

        if (attempts.length === 0) {
            return {
                skills: [],
                message: "Aucune tentative complétée pour générer le diagnostic"
            }
        }

        // Récupérer toutes les réponses pour ces tentatives
        const attemptIds = attempts.map(a => a._id)
        const responses = await Response.find({
            attemptId: { $in: attemptIds }
        }).lean()

        // Récupérer toutes les questions avec leurs tags
        const questionIds = responses.map(r => r.questionId)
        const questions = await Question.find({
            _id: { $in: questionIds }
        }).select('_id tags').lean()

        // Créer un map questionId -> tags
        const questionTagsMap = new Map<string, string[]>()
        questions.forEach(q => {
            questionTagsMap.set(q._id.toString(), q.tags || [])
        })

        // Analyser les performances par tag
        const tagStats = new Map<string, { correct: number; total: number }>()

        responses.forEach(response => {
            const tags = questionTagsMap.get(response.questionId.toString()) || []
            
            tags.forEach(tag => {
                if (!tagStats.has(tag)) {
                    tagStats.set(tag, { correct: 0, total: 0 })
                }
                
                const stats = tagStats.get(tag)!
                stats.total++
                if (response.isCorrect) {
                    stats.correct++
                }
            })
        })

        // Convertir en format radar chart
        const skills = Array.from(tagStats.entries())
            .map(([skill, stats]) => ({
                skill: this.formatSkillName(skill),
                score: Math.round((stats.correct / stats.total) * 100),
                questionsAnswered: stats.total,
                correctAnswers: stats.correct
            }))
            .sort((a, b) => b.score - a.score) // Trier par score décroissant
            .slice(0, 8) // Limiter à 8 compétences max pour la lisibilité

        // Calculer le score global
        const globalScore = Math.round(
            skills.reduce((sum, s) => sum + s.score, 0) / skills.length
        )

        // Identifier les forces et faiblesses
        const strengths = skills.filter(s => s.score >= 70).map(s => s.skill)
        const weaknesses = skills.filter(s => s.score < 50).map(s => s.skill)

        return {
            skills,
            globalScore,
            strengths,
            weaknesses,
            totalAttempts: attempts.length,
            totalQuestions: responses.length,
            correctAnswers: responses.filter(r => r.isCorrect).length
        }
    }

    /**
     * Formate le nom d'une compétence pour l'affichage
     */
    private static formatSkillName(skill: string): string {
        // Capitaliser la première lettre et remplacer les tirets par des espaces
        return skill
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    /**
     * Génère des insights personnalisés basés sur les performances
     */
    static async generateInsights(guestSessionId: string) {
        const radarData = await this.generateRadarChartData(guestSessionId)

        if (!radarData.skills || radarData.skills.length === 0) {
            return {
                insights: [],
                recommendations: []
            }
        }

        const insights: string[] = []
        const recommendations: string[] = []

        // Insight sur le score global
        if (radarData.globalScore !== undefined) {
            if (radarData.globalScore >= 80) {
                insights.push("🎉 Excellent niveau général ! Vous maîtrisez bien les concepts.")
            } else if (radarData.globalScore >= 60) {
                insights.push("👍 Bon niveau général, avec des marges de progression.")
            } else if (radarData.globalScore >= 40) {
                insights.push("📚 Niveau moyen, un travail régulier vous permettra de progresser.")
            } else {
                insights.push("💪 Des bases à consolider, mais chaque effort compte !")
            }
        }

        // Insights sur les forces
        if (radarData.strengths && radarData.strengths.length > 0) {
            insights.push(`✨ Vos points forts : ${radarData.strengths.slice(0, 3).join(', ')}`)
        }

        // Insights sur les faiblesses
        if (radarData.weaknesses && radarData.weaknesses.length > 0) {
            insights.push(`🎯 À travailler : ${radarData.weaknesses.slice(0, 3).join(', ')}`)
            
            // Recommandations ciblées
            radarData.weaknesses.slice(0, 3).forEach(weakness => {
                recommendations.push(`Pratiquez davantage les exercices de ${weakness.toLowerCase()}`)
            })
        }

        // Recommandation générale
        if (radarData.totalAttempts !== undefined && radarData.totalAttempts < 3) {
            recommendations.push("Passez plus de mini-tests pour un diagnostic plus précis")
        }

        return {
            insights,
            recommendations,
            radarData
        }
    }
}
