import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'

/**
 * GET /api/public/mini-tests
 * Récupère la liste des mini-tests publics disponibles pour les guests
 */
export async function GET(req: Request) {
    try {
        await connectDB()

        // Import dynamique des modèles pour s'assurer qu'ils sont enregistrés
        const { default: Exam } = await import('@/models/Exam')
        const { default: Subject } = await import('@/models/Subject')
        const { default: LearningUnit } = await import('@/models/LearningUnit')
        const { default: User } = await import('@/models/User')

        const { searchParams } = new URL(req.url)
        const subjectId = searchParams.get('subjectId')
        const learningUnitId = searchParams.get('learningUnitId')
        const limit = parseInt(searchParams.get('limit') || '10')

        const query: any = {
            isPublicDemo: true,
            isPublished: true,
            isActive: true
        }

        if (subjectId) {
            query.subject = subjectId
        }

        if (learningUnitId) {
            query.learningUnit = learningUnitId
        }

        const miniTests = await Exam.find(query)
            .populate('subject', 'name')
            .populate('learningUnit', 'title')
            .populate('createdById', 'name')
            .select('title description imageUrl subject learningUnit difficultyLevel duration stats createdById')
            .sort({ 'stats.totalAttempts': -1 }) // Les plus populaires d'abord
            .limit(limit)
            .lean()

        return NextResponse.json({
            success: true,
            data: miniTests.map(exam => ({
                id: exam._id,
                title: exam.title,
                description: exam.description,
                imageUrl: exam.imageUrl,
                subject: (exam.subject as any)?.name || 'Non spécifié',
                learningUnit: (exam.learningUnit as any)?.title,
                difficulty: exam.difficultyLevel,
                duration: exam.duration,
                attempts: exam.stats?.totalAttempts || 0,
                teacher: (exam.createdById as any)?.name || 'Enseignant'
            }))
        })
    } catch (error: any) {
        console.error('[Public Mini-Tests] Error:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch mini-tests' },
            { status: 500 }
        )
    }
}
