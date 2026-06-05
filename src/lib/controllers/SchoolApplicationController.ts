import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { SchoolApplicationService } from '@/lib/services/SchoolApplicationService'
import { BaseApplicationError } from '@/lib/errors'
import { ApplicationStatus } from '@/models/enums'
import { isSchoolOrPlatformAdmin } from '@/lib/auth/roles'

type SessionUser = { id: string; role?: string; schools?: string[] }

/**
 * SchoolApplicationController — traduction HTTP <-> metier pour les candidatures.
 */
export class SchoolApplicationController {
    /**
     * POST /api/inscriptions/forms/:id/apply — soumettre une candidature.
     * Accepte user connecte (session) ou anonyme (guestEmail dans le body).
     */
    static async apply(req: Request, formId: string, user?: SessionUser) {
        try {
            const body = await req.json()

            if (!user && !body.guestEmail) {
                return NextResponse.json(
                    { success: false, message: 'Connexion requise ou email obligatoire' },
                    { status: 400 },
                )
            }

            const application = await SchoolApplicationService.submitApplication(formId, {
                userId: user?.id,
                guestEmail: body.guestEmail,
                candidateData: body.candidateData ?? {},
                parentData: body.parentData,
                domainChoices: body.domainChoices,
                docsUploaded: body.docsUploaded,
            })

            return NextResponse.json({ success: true, data: application }, { status: 201 })
        } catch (error: unknown) {
            return SchoolApplicationController.handleError(error)
        }
    }

    /**
     * GET /api/inscriptions/applications/mine — mes candidatures (etudiant connecte).
     */
    static async myApplications(req: Request, user: SessionUser) {
        try {
            const url = new URL(req.url)
            const page = parseInt(url.searchParams.get('page') ?? '1', 10)
            const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)

            const result = await SchoolApplicationService.getUserApplications(user.id, page, limit)
            return NextResponse.json({ success: true, data: result })
        } catch (error: unknown) {
            return SchoolApplicationController.handleError(error)
        }
    }

    /**
     * GET /api/inscriptions/admin/applications — candidatures recues (admin ecole).
     */
    static async adminListApplications(req: Request, user: SessionUser) {
        try {
            if (!isSchoolOrPlatformAdmin(user.role)) {
                return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
            }

            const url = new URL(req.url)
            const formId = url.searchParams.get('formId')
            if (!formId) {
                return NextResponse.json({ success: false, message: 'formId requis' }, { status: 400 })
            }

            const page = parseInt(url.searchParams.get('page') ?? '1', 10)
            const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
            const status = url.searchParams.get('status') as ApplicationStatus | undefined

            const result = await SchoolApplicationService.getFormApplications(formId, page, limit, status)
            const stats = await SchoolApplicationService.getApplicationStats(formId)

            return NextResponse.json({ success: true, data: { ...result, stats } })
        } catch (error: unknown) {
            return SchoolApplicationController.handleError(error)
        }
    }

    /**
     * PATCH /api/inscriptions/admin/applications/:id — approuver/rejeter (admin ecole).
     */
    static async adminUpdateApplication(req: Request, user: SessionUser, applicationId: string) {
        try {
            if (!isSchoolOrPlatformAdmin(user.role)) {
                return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
            }

            const body = await req.json()
            const newStatus = body.status as ApplicationStatus
            if (!newStatus || !Object.values(ApplicationStatus).includes(newStatus)) {
                return NextResponse.json({ success: false, message: 'Statut invalide' }, { status: 400 })
            }

            const updated = await SchoolApplicationService.updateStatus(
                applicationId,
                newStatus,
                { reviewedBy: user.id, reviewNote: body.reviewNote },
            )

            return NextResponse.json({ success: true, data: updated })
        } catch (error: unknown) {
            return SchoolApplicationController.handleError(error)
        }
    }

    // ── Error handler ───────────────────────────────────────────────────────

    private static handleError(error: unknown) {
        if (error instanceof BaseApplicationError) {
            Sentry.captureException(error)
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
