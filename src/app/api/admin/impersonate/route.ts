import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { encode } from 'next-auth/jwt'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { UserRole } from '@/models/enums'

const PLATFORM_ADMIN_ROLES: string[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/**
 * POST /api/admin/impersonate
 *
 * Generate a session token for a target user so the admin
 * can log in as that user. Sets the NextAuth session cookie.
 *
 * Body: { userId: string }
 *
 * To stop impersonating, call with { userId: <original-admin-id> }
 * or simply log out / log back in.
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !PLATFORM_ADMIN_ROLES.includes(session.user.role as string)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    let body: { userId?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ success: false, message: 'Corps de requête invalide' }, { status: 400 })
    }

    const { userId } = body
    if (!userId) {
        return NextResponse.json({ success: false, message: 'userId requis' }, { status: 400 })
    }

    await connectDB()
    const targetUser = await User.findById(userId).lean() as any
    if (!targetUser) {
        return NextResponse.json({ success: false, message: 'Utilisateur introuvable' }, { status: 404 })
    }

    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
        return NextResponse.json({ success: false, message: 'Server config error' }, { status: 500 })
    }

    // Build a JWT identical to what NextAuth produces
    const jwt = await encode({
        token: {
            id: targetUser._id.toString(),
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
            picture: targetUser.image || targetUser.metadata?.avatar || null,
            schools: targetUser.schools?.map((id: any) => id.toString()) || [],
            impersonatedBy: session.user.id,
        },
        secret,
        maxAge: 2 * 60 * 60,
    })

    const isProd = process.env.NODE_ENV === 'production'
    const cookieName = isProd ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

    const response = NextResponse.json({
        success: true,
        message: `Connecté en tant que ${targetUser.name}`,
        token: jwt,
        data: {
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
        },
    })

    response.cookies.set(cookieName, jwt, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProd,
        maxAge: 2 * 60 * 60,
    })

    return response
}
