import { SchoolApplicationRepository, type ReviewData } from '@/lib/repositories/SchoolApplicationRepository'
import { InscriptionFormRepository } from '@/lib/repositories/InscriptionFormRepository'
import { InscriptionError } from '@/lib/errors'
import { ApplicationStatus, InscriptionFormStatus, PaymentStatus } from '@/models/enums'
import type { ISchoolApplication } from '@/models/SchoolApplication'
import { InscriptionEmailService } from '@/lib/services/InscriptionEmailService'

// ── State Machine ───────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    [ApplicationStatus.DRAFT]:     [ApplicationStatus.SUBMITTED],
    [ApplicationStatus.SUBMITTED]: [ApplicationStatus.PAID, ApplicationStatus.CANCELLED],
    [ApplicationStatus.PAID]:      [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED],
    [ApplicationStatus.APPROVED]:  [ApplicationStatus.CANCELLED],
    [ApplicationStatus.REJECTED]:  [],
    [ApplicationStatus.CANCELLED]: [],
}

function assertValidTransition(from: ApplicationStatus, to: ApplicationStatus): void {
    const allowed = VALID_TRANSITIONS[from]
    if (!allowed || !allowed.includes(to)) {
        throw InscriptionError.invalidTransition(from, to)
    }
}

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * SchoolApplicationService — logique metier des candidatures.
 *
 * Regles :
 * - Un etudiant connecte ne peut candidater qu'une fois par fiche (anti-doublon)
 * - La fiche doit etre PUBLISHED et pas expiree
 * - La capacite max doit pas etre atteinte
 * - Les transitions de statut sont gardees par la state machine
 */
export class SchoolApplicationService {
    /**
     * Soumettre une candidature.
     * Verifie : fiche publiee + capacite + doublon.
     * Incremente le compteur atomique.
     */
    static async submitApplication(
        formId: string,
        data: {
            userId?: string
            guestEmail?: string
            candidateData: Record<string, unknown>
            parentData?: Record<string, unknown>
            domainChoices?: string[]
            docsUploaded?: { fieldId: string; fileUrl: string; uploadedAt?: string }[]
        },
    ): Promise<ISchoolApplication> {
        const formRepo = new InscriptionFormRepository()
        const appRepo = new SchoolApplicationRepository()

        // 1. Verifier que la fiche existe et est publiee
        const form = await formRepo.findById(formId)
        if (!form) throw InscriptionError.formNotFound()
        if (form.status !== InscriptionFormStatus.PUBLISHED) {
            throw InscriptionError.inscriptionClosed()
        }

        // 2. Verifier les dates
        const now = new Date()
        if (now < new Date(form.opensAt) || now > new Date(form.closesAt)) {
            throw InscriptionError.inscriptionClosed()
        }

        // 3. Verifier la capacite
        if (form.maxCandidates && form.currentCandidates >= form.maxCandidates) {
            throw InscriptionError.capacityReached()
        }

        // 4. Anti-doublon (user connecte)
        if (data.userId) {
            const exists = await appRepo.existsByFormAndUser(formId, data.userId)
            if (exists) throw InscriptionError.duplicateApplication()
        }

        // 5. Creer la candidature (SUBMITTED directement, pas DRAFT pour le flow public)
        const schoolId = (form.schoolId as unknown as { _id: { toString(): string } })?._id?.toString()
            ?? (form.schoolId as unknown as string)?.toString()

        const application = await appRepo.create({
            inscriptionFormId: formId as unknown as ISchoolApplication['inscriptionFormId'],
            schoolId: schoolId as unknown as ISchoolApplication['schoolId'],
            userId: data.userId ? data.userId as unknown as ISchoolApplication['userId'] : undefined,
            guestEmail: data.guestEmail,
            candidateData: data.candidateData,
            parentData: data.parentData ?? {},
            domainChoices: data.domainChoices ?? [],
            docsUploaded: (data.docsUploaded ?? []).map((d) => ({
                fieldId: d.fieldId,
                fileUrl: d.fileUrl,
                uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : new Date(),
            })),
            appStatus: ApplicationStatus.SUBMITTED,
            paymentStatus: PaymentStatus.PENDING,
            submittedAt: new Date(),
        })

        // 6. Incrementer le compteur (atomique)
        await formRepo.incrementCandidates(formId)

        return application
    }

    /**
     * Mettre a jour le statut (avec state machine).
     */
    static async updateStatus(
        applicationId: string,
        newStatus: ApplicationStatus,
        reviewData?: ReviewData,
    ): Promise<ISchoolApplication> {
        const appRepo = new SchoolApplicationRepository()

        const app = await appRepo.findById(applicationId)
        if (!app) throw InscriptionError.formNotFound()

        // State machine guard
        assertValidTransition(app.appStatus, newStatus)

        const updated = await appRepo.updateStatus(applicationId, newStatus, reviewData)
        if (!updated) throw InscriptionError.formNotFound()

        // Envoyer email de notification si approuve/rejete (non-bloquant)
        if (newStatus === ApplicationStatus.APPROVED || newStatus === ApplicationStatus.REJECTED) {
            InscriptionEmailService.sendStatusUpdate({
                studentEmail: (app.userId as unknown as { email?: string })?.email ?? app.guestEmail ?? '',
                studentName: (app.userId as unknown as { name?: string })?.name
                    ?? (app.candidateData as Record<string, unknown>)?.nom as string ?? 'Candidat',
                schoolName: (app.schoolId as unknown as { name?: string })?.name ?? 'Etablissement',
                formTitle: (app.inscriptionFormId as unknown as { title?: string })?.title ?? 'Inscription',
                newStatus,
                reviewNote: reviewData?.reviewNote,
            }).catch(() => { /* non-bloquant */ })
        }

        return updated
    }

    /**
     * Candidatures d'une fiche (admin view).
     */
    static async getFormApplications(
        formId: string,
        page: number = 1,
        limit: number = 20,
        status?: ApplicationStatus,
    ) {
        const appRepo = new SchoolApplicationRepository()
        return appRepo.findByForm(formId, { page, limit, appStatus: status })
    }

    /**
     * Candidatures d'un etudiant connecte.
     */
    static async getUserApplications(userId: string, page: number = 1, limit: number = 20) {
        const appRepo = new SchoolApplicationRepository()
        return appRepo.findByUser(userId, page, limit)
    }

    /**
     * Detail d'une candidature.
     */
    static async getApplicationDetail(applicationId: string) {
        const appRepo = new SchoolApplicationRepository()
        const app = await appRepo.findById(applicationId)
        if (!app) throw InscriptionError.formNotFound()
        return app
    }

    /**
     * Lier les candidatures anonymes a un compte (appel au signup/login).
     */
    static async linkGuestApplications(email: string, userId: string): Promise<number> {
        const appRepo = new SchoolApplicationRepository()
        return appRepo.linkGuestApplications(email, userId)
    }

    /**
     * Stats candidatures par statut pour une fiche.
     */
    static async getApplicationStats(formId: string) {
        const appRepo = new SchoolApplicationRepository()
        return appRepo.countByStatusForForm(formId)
    }
}
