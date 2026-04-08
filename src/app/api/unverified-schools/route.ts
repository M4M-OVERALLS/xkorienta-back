import connectDB from '@/lib/mongodb'
import { NextResponse } from 'next/server'
import { UnverifiedSchoolService } from '@/lib/services/UnverifiedSchoolService'
import UnverifiedSchool from '@/models/UnverifiedSchool'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/unverified-schools
 *
 * Liste les écoles non vérifiées en attente de traitement (ADMIN uniquement).
 *
 * Query params:
 *   ?status=PENDING|VALIDATED|MERGED|REJECTED   (défaut: PENDING)
 *   &page=number   (défaut: 1)
 *   &limit=number  (défaut: 20)
 */
export async function GET(req: Request) {
    await connectDB()

    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status') || 'PENDING'
        const page = parseInt(searchParams.get('page') || '1', 10)
        const limit = parseInt(searchParams.get('limit') || '20', 10)
        const skip = (page - 1) * limit

        const [schools, total] = await Promise.all([
            UnverifiedSchool.find({ status })
                .populate('declaredBy', 'name email phone')
                .sort({ declaredCount: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            UnverifiedSchool.countDocuments({ status })
        ])

        return NextResponse.json({
            schools,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })

    } catch (error: any) {
        console.error('[Unverified Schools GET] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Erreur interne' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/unverified-schools
 *
 * Action admin sur une école non vérifiée.
 *
 * Body:
 * {
 *   unverifiedSchoolId: string
 *   action: 'VALIDATE' | 'MERGE' | 'REJECT'
 *
 *   // Si action = VALIDATE
 *   schoolData?: {
 *     name: string
 *     type: string
 *     city?: string
 *     country?: string
 *   }
 *
 *   // Si action = MERGE
 *   targetSchoolId?: string
 *
 *   // Optionnel
 *   notes?: string
 * }
 */
export async function POST(req: Request) {
    await connectDB()

    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
        }

        const body = await req.json()
        const { unverifiedSchoolId, action, targetSchoolId, schoolData, notes } = body
        const adminId = session.user.id as string

        if (!unverifiedSchoolId || !action) {
            return NextResponse.json(
                { error: 'unverifiedSchoolId et action sont requis' },
                { status: 400 }
            )
        }

        let result: any

        switch (action) {
            case 'VALIDATE':
                if (!schoolData?.name || !schoolData?.type) {
                    return NextResponse.json(
                        { error: 'schoolData.name et schoolData.type requis pour VALIDATE' },
                        { status: 400 }
                    )
                }
                result = await UnverifiedSchoolService.validateSchool(
                    unverifiedSchoolId,
                    adminId,
                    schoolData
                )
                break

            case 'MERGE':
                if (!targetSchoolId) {
                    return NextResponse.json(
                        { error: 'targetSchoolId requis pour MERGE' },
                        { status: 400 }
                    )
                }
                result = await UnverifiedSchoolService.mergeToExistingSchool(
                    unverifiedSchoolId,
                    targetSchoolId,
                    adminId
                )
                break

            case 'REJECT':
                result = await UnverifiedSchoolService.rejectSchool(
                    unverifiedSchoolId,
                    adminId,
                    notes || 'Rejeté par un administrateur'
                )
                break

            default:
                return NextResponse.json(
                    { error: `Action invalide: ${action}. Actions valides: VALIDATE, MERGE, REJECT` },
                    { status: 400 }
                )
        }

        return NextResponse.json({ success: true, ...result })

    } catch (error: any) {
        console.error('[Unverified Schools POST] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Erreur interne' },
            { status: 500 }
        )
    }
}
