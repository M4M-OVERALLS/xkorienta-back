import { InscriptionFormRepository, type PublishedFormFilters } from '@/lib/repositories/InscriptionFormRepository'
import { InscriptionError } from '@/lib/errors'
import { InscriptionFormStatus } from '@/models/enums'
import type { IInscriptionForm } from '@/models/InscriptionForm'

/**
 * InscriptionFormService — logique metier CRUD des fiches d'inscription.
 *
 * Regles :
 * - Seul un SCHOOL_ADMIN de l'ecole peut creer/modifier/publier/fermer
 * - Seul un brouillon (DRAFT) peut etre modifie
 * - La publication snapshot le taux de commission
 * - Les fiches publiees sont visibles par tous
 */

/** Taux de commission plateforme par defaut (%). Ex: 35 000 FCFA → 10 000 app + 25 000 ecole */
const DEFAULT_COMMISSION_RATE = 28.57

export class InscriptionFormService {
    /**
     * Creer une fiche d'inscription (brouillon).
     */
    static async createForm(
        schoolId: string,
        adminId: string,
        data: {
            title: string
            description?: string
            price: number
            opensAt: string
            closesAt: string
            maxCandidates?: number
            formFields?: IInscriptionForm['formFields']
            docsRequired?: string[]
            domainGroups?: IInscriptionForm['domainGroups']
        },
    ): Promise<IInscriptionForm> {
        const repo = new InscriptionFormRepository()
        return repo.create({
            schoolId: schoolId as unknown as IInscriptionForm['schoolId'],
            createdBy: adminId as unknown as IInscriptionForm['createdBy'],
            title: data.title,
            description: data.description,
            price: data.price,
            opensAt: new Date(data.opensAt),
            closesAt: new Date(data.closesAt),
            maxCandidates: data.maxCandidates,
            formFields: data.formFields ?? [],
            docsRequired: data.docsRequired ?? [],
            domainGroups: data.domainGroups ?? [],
            status: InscriptionFormStatus.DRAFT,
            commissionRate: DEFAULT_COMMISSION_RATE,
        })
    }

    /**
     * Modifier une fiche (brouillon uniquement).
     */
    static async updateForm(
        formId: string,
        adminId: string,
        data: Partial<{
            title: string
            description: string
            price: number
            opensAt: string
            closesAt: string
            maxCandidates: number | null
            formFields: IInscriptionForm['formFields']
            docsRequired: string[]
            domainGroups: IInscriptionForm['domainGroups']
        }>,
    ): Promise<IInscriptionForm> {
        const repo = new InscriptionFormRepository()
        const form = await repo.findById(formId)

        if (!form) throw InscriptionError.formNotFound()
        if (form.createdBy?._id?.toString() !== adminId && (form.createdBy as unknown as string)?.toString() !== adminId) {
            throw InscriptionError.unauthorized()
        }
        const isDraft = form.status === InscriptionFormStatus.DRAFT

        const updateData: Record<string, unknown> = {}
        // Champs modifiables quel que soit le statut
        if (data.title !== undefined) updateData.title = data.title
        if (data.description !== undefined) updateData.description = data.description
        if (data.closesAt !== undefined) updateData.closesAt = new Date(data.closesAt)
        if (data.maxCandidates !== undefined) updateData.maxCandidates = data.maxCandidates
        if (data.formFields !== undefined) updateData.formFields = data.formFields
        if (data.docsRequired !== undefined) updateData.docsRequired = data.docsRequired
        if (data.domainGroups !== undefined) updateData.domainGroups = data.domainGroups

        // Champs modifiables uniquement en brouillon
        if (isDraft) {
            if (data.price !== undefined) updateData.price = data.price
            if (data.opensAt !== undefined) updateData.opensAt = new Date(data.opensAt)
        }

        const updated = await repo.update(formId, updateData as Partial<IInscriptionForm>)
        if (!updated) throw InscriptionError.formNotFound()
        return updated
    }

    /**
     * Publier une fiche.
     * Valide les champs requis et snapshot le taux de commission.
     */
    static async publishForm(formId: string, adminId: string): Promise<IInscriptionForm> {
        const repo = new InscriptionFormRepository()
        const form = await repo.findById(formId)

        if (!form) throw InscriptionError.formNotFound()
        if (form.createdBy?._id?.toString() !== adminId && (form.createdBy as unknown as string)?.toString() !== adminId) {
            throw InscriptionError.unauthorized()
        }
        if (form.status !== InscriptionFormStatus.DRAFT) {
            throw InscriptionError.notDraft()
        }

        // Valider les champs obligatoires pour la publication
        const missing: string[] = []
        if (!form.title) missing.push('title')
        if (!form.price && form.price !== 0) missing.push('price')
        if (!form.opensAt) missing.push('opensAt')
        if (!form.closesAt) missing.push('closesAt')
        if (missing.length > 0) {
            throw InscriptionError.missingFieldsForPublish(missing)
        }

        const published = await repo.updateStatus(formId, InscriptionFormStatus.PUBLISHED, {
            commissionRate: DEFAULT_COMMISSION_RATE,
        } as Partial<IInscriptionForm>)
        if (!published) throw InscriptionError.formNotFound()
        return published
    }

    /**
     * Fermer une fiche (plus de nouvelles candidatures).
     */
    static async closeForm(formId: string, adminId: string): Promise<IInscriptionForm> {
        const repo = new InscriptionFormRepository()
        const form = await repo.findById(formId)

        if (!form) throw InscriptionError.formNotFound()
        if (form.createdBy?._id?.toString() !== adminId && (form.createdBy as unknown as string)?.toString() !== adminId) {
            throw InscriptionError.unauthorized()
        }
        if (form.status !== InscriptionFormStatus.PUBLISHED) {
            throw InscriptionError.invalidTransition(form.status, InscriptionFormStatus.CLOSED)
        }

        const closed = await repo.updateStatus(formId, InscriptionFormStatus.CLOSED)
        if (!closed) throw InscriptionError.formNotFound()
        return closed
    }

    /**
     * Liste publique des fiches publiees et ouvertes.
     */
    static async getPublishedForms(filters: PublishedFormFilters) {
        const repo = new InscriptionFormRepository()
        return repo.findPublished(filters)
    }

    /**
     * Detail d'une fiche (enrichi avec spotsLeft si maxCandidates defini).
     */
    static async getFormDetail(formId: string) {
        const repo = new InscriptionFormRepository()
        const form = await repo.findById(formId)
        if (!form) throw InscriptionError.formNotFound()

        const result = form as IInscriptionForm & { spotsLeft?: number | null }
        if (form.maxCandidates) {
            result.spotsLeft = Math.max(0, form.maxCandidates - form.currentCandidates)
        } else {
            result.spotsLeft = null
        }

        return result
    }

    /**
     * Fiches d'une ecole (admin dashboard).
     */
    static async getSchoolForms(
        schoolId: string,
        page: number = 1,
        limit: number = 20,
        status?: InscriptionFormStatus,
    ) {
        const repo = new InscriptionFormRepository()
        return repo.findBySchool(schoolId, page, limit, status)
    }

    /**
     * Stats par statut pour le dashboard admin.
     */
    static async getSchoolFormStats(schoolId: string) {
        const repo = new InscriptionFormRepository()
        return repo.countByStatus(schoolId)
    }
}
