import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { UserRole, MediaStatus, MediaType } from '@/models/enums'

const ADMIN_ROLES: UserRole[] = [UserRole.SCHOOL_ADMIN, UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/** GET /api/media/admin/stats — compteurs de médias par statut */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 })
        }
        if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
            return NextResponse.json({ success: false, message: 'Interdit' }, { status: 403 })
        }

        await connectDB()
        const Media = (await import('@/models/Media')).default

        const [total, pending, approved, rejected, archived, draft,
               videoCount, podcastCount, audioCount, bookCount] = await Promise.all([
            Media.countDocuments({}),
            Media.countDocuments({ status: MediaStatus.PENDING }),
            Media.countDocuments({ status: MediaStatus.APPROVED }),
            Media.countDocuments({ status: MediaStatus.REJECTED }),
            Media.countDocuments({ status: MediaStatus.ARCHIVED }),
            Media.countDocuments({ status: MediaStatus.DRAFT }),
            Media.countDocuments({ mediaType: MediaType.VIDEO }),
            Media.countDocuments({ mediaType: MediaType.PODCAST }),
            Media.countDocuments({ mediaType: MediaType.AUDIO }),
            Media.countDocuments({ mediaType: MediaType.BOOK }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                total, pending, approved, rejected, archived, draft,
                byType: { VIDEO: videoCount, PODCAST: podcastCount, AUDIO: audioCount, BOOK: bookCount },
            },
        })
    } catch (err) {
        return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
    }
}
