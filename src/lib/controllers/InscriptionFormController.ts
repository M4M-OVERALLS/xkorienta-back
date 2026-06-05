import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { InscriptionFormService } from '@/lib/services/InscriptionFormService'
import { BaseApplicationError } from '@/lib/errors'
import { InscriptionFormStatus } from '@/models/enums'
import { isSchoolOrPlatformAdmin } from '@/lib/auth/roles'

type SessionUser = { id: string; role?: string; schools?: string[] }

/**
 * InscriptionFormController — traduction HTTP <-> metier pour les fiches d'inscription.
 * Aucune logique metier ici — tout est delegue au service.
 */
export class InscriptionFormController {
    /**
     * GET /api/inscriptions/forms — liste publique paginee.
     */
    static async listPublished(req: Request) {
        try {
            const url = new URL(req.url)
            const page = parseInt(url.searchParams.get('page') ?? '1', 10)
            const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
            const search = url.searchParams.get('search') ?? undefined
            const schoolId = url.searchParams.get('schoolId') ?? undefined
            const priceMin = url.searchParams.get('priceMin') ? Number(url.searchParams.get('priceMin')) : undefined
            const priceMax = url.searchParams.get('priceMax') ? Number(url.searchParams.get('priceMax')) : undefined

            const result = await InscriptionFormService.getPublishedForms({
                page, limit, search, schoolId, priceMin, priceMax,
            })

            return NextResponse.json({ success: true, data: result })
        } catch (error: unknown) {
            return InscriptionFormController.handleError(error)
        }
    }

    /**
     * GET /api/inscriptions/forms/:id — detail d'une fiche.
     */
    static async getDetail(_req: Request, formId: string) {
        try {
            const form = await InscriptionFormService.getFormDetail(formId)
            return NextResponse.json({ success: true, data: form })
        } catch (error: unknown) {
            return InscriptionFormController.handleError(error)
        }
    }

    /**
     * POST /api/inscriptions/forms — creer une fiche (admin).
     */
    static async createForm(req: Request, user: SessionUser) {
        try {
            if (!isSchoolOrPlatformAdmin(user.role)) {
                return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
            }

            const body = await req.json()
            const schoolId = body.schoolId as string
            if (!schoolId) {
                return NextResponse.json({ success: false, message: 'schoolId requis' }, { status: 400 })
            }

            const form = await InscriptionFormService.createForm(schoolId, user.id, body)
            return NextResponse.json({ success: true, data: form }, { status: 201 })
        } catch (error: unknown) {
            return InscriptionFormController.handleError(error)
        }
    }

    /**
     * PUT /api/inscriptions/forms/:id — modifier une fiche (admin, brouillon uniquement).
     */
    static async updateForm(req: Request, user: SessionUser, formId: string) {
        try {
            if (!isSchoolOrPlatformAdmin(user.role)) {
                return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
            }

            const body = await req.json()
            const form = await InscriptionFormService.updateForm(formId, user.id, body)
            return NextResponse.json({ success: true, data: form })
        } catch (error: unknown) {
            return InscriptionFormController.handleError(error)
        }
    }

    /**
     * POST /api/inscriptions/forms/:id/publish — publier une fiche (admin).
     */
    static async publishForm(_req: Request, user: SessionUser, formId: string) {
        try {
            if (!isSchoolOrPlatformAdmin(user.role)) {
                return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
            }

            const form = await InscriptionFormService.publishForm(formId, user.id)
            return NextResponse.json({ success: true, data: form })
        } catch (error: unknown) {
            return InscriptionFormController.handleError(error)
        }
    }

    /**
     * POST /api/inscriptions/forms/:id/close — fermer une fiche (admin).
     */
    static async closeForm(_req: Request, user: SessionUser, formId: string) {
        try {
            if (!isSchoolOrPlatformAdmin(user.role)) {
                return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
            }

            const form = await InscriptionFormService.closeForm(formId, user.id)
            return NextResponse.json({ success: true, data: form })
        } catch (error: unknown) {
            return InscriptionFormController.handleError(error)
        }
    }

    /**
     * GET /api/inscriptions/admin/forms — fiches de l'ecole de l'admin.
     */
    static async listSchoolForms(req: Request, user: SessionUser) {
        try {
            if (!isSchoolOrPlatformAdmin(user.role)) {
                return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 403 })
            }

            const url = new URL(req.url)
            const schoolId = url.searchParams.get('schoolId') ?? user.schools?.[0]
            if (!schoolId) {
                return NextResponse.json({ success: false, message: 'schoolId requis' }, { status: 400 })
            }

            const page = parseInt(url.searchParams.get('page') ?? '1', 10)
            const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
            const status = url.searchParams.get('status') as InscriptionFormStatus | undefined

            const result = await InscriptionFormService.getSchoolForms(schoolId, page, limit, status)
            const stats = await InscriptionFormService.getSchoolFormStats(schoolId)

            return NextResponse.json({ success: true, data: { ...result, stats } })
        } catch (error: unknown) {
            return InscriptionFormController.handleError(error)
        }
    }

    // ── Error handler ───────────────────────────────────────────────────────

    private static handleError(error: unknown) {
        if (error instanceof BaseApplicationError) {
            error.log()
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }
        Sentry.captureException(error)
        const message = error instanceof Error ? error.message : 'Erreur interne'
        return NextResponse.json({ success: false, message }, { status: 500 })
    }
}
