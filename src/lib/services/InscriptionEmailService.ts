/**
 * InscriptionEmailService
 *
 * Emails specifiques au module d'inscription :
 * - Confirmation de candidature payee (etudiant)
 * - Notification de nouvelle candidature (admin ecole)
 * - Mise a jour de statut (approuve/rejete)
 *
 * Reutilise sendEmail() de @/lib/mail.ts (meme template HTML).
 */

import { sendEmail } from '@/lib/mail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const COLORS = {
    primary: '#10B981',
    secondary: '#7C3AED',
    text: '#1F2937',
    gray: '#6B7280',
    white: '#FFFFFF',
    success: '#059669',
    error: '#EF4444',
}

function emailWrapper(title: string, subtitle: string, content: string): string {
    return `
    <div style="font-family: 'Inter', 'Segoe UI', Roboto, sans-serif; background-color: #F3F4F6; margin: 0; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: ${COLORS.white}; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); overflow: hidden;">
            <div style="background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary}); padding: 40px 30px; text-align: center;">
                <h1 style="color: ${COLORS.white}; margin: 0; font-size: 22px; font-weight: 700;">${title}</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">${subtitle}</p>
            </div>
            <div style="padding: 32px 30px; color: ${COLORS.text}; font-size: 15px; line-height: 1.7;">
                ${content}
            </div>
            <div style="background: #F8FAFC; padding: 24px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                <p style="color: ${COLORS.gray}; font-size: 12px; margin: 0;">Xkorienta — Plateforme d'orientation scolaire au Cameroun</p>
            </div>
        </div>
    </div>`
}

// ── Emails ──────────────────────────────────────────────────────────────────

export class InscriptionEmailService {
    /**
     * Email a l'etudiant apres paiement confirme.
     */
    static async sendApplicationConfirmation(params: {
        studentEmail: string
        studentName: string
        schoolName: string
        formTitle: string
        amount: number
        currency: string
    }) {
        const { studentEmail, studentName, schoolName, formTitle, amount, currency } = params

        const content = `
            <p>Bonjour <strong>${studentName}</strong>,</p>
            <p>Votre candidature a bien ete recue et votre paiement confirme.</p>

            <div style="background: #F0FDFA; border: 1px solid #CCFBF1; border-radius: 16px; padding: 20px; margin: 20px 0;">
                <p style="color: ${COLORS.primary}; font-weight: 600; font-size: 13px; text-transform: uppercase; margin: 0 0 12px;">Details de l'inscription</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Etablissement :</strong> ${schoolName}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Campagne :</strong> ${formTitle}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Montant paye :</strong> ${amount.toLocaleString('fr-FR')} ${currency}</p>
            </div>

            <p>L'etablissement examinera votre dossier et vous serez notifie de la decision.</p>
            <p>Votre facture est disponible dans les <strong>parametres de votre compte</strong>.</p>

            <div style="text-align: center; margin: 24px 0;">
                <a href="${APP_URL}/student/inscriptions" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary}); color: ${COLORS.white}; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
                    Suivre ma candidature
                </a>
            </div>
        `

        await sendEmail({
            to: studentEmail,
            subject: `Candidature confirmee — ${schoolName}`,
            html: emailWrapper('Candidature recue et payee', schoolName, content),
        })
    }

    /**
     * Email a l'admin ecole quand nouvelle candidature payee.
     */
    static async notifySchoolAdmin(params: {
        adminEmail: string
        studentName: string
        schoolName: string
        formTitle: string
        amount: number
        netAmount: number
        currency: string
    }) {
        const { adminEmail, studentName, schoolName, formTitle, amount, netAmount, currency } = params

        const content = `
            <p>Nouvelle candidature payee pour <strong>${formTitle}</strong>.</p>

            <div style="background: #F0FDFA; border: 1px solid #CCFBF1; border-radius: 16px; padding: 20px; margin: 20px 0;">
                <p style="color: ${COLORS.primary}; font-weight: 600; font-size: 13px; text-transform: uppercase; margin: 0 0 12px;">Nouvelle candidature</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Candidat :</strong> ${studentName}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Montant :</strong> ${amount.toLocaleString('fr-FR')} ${currency}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Net recu :</strong> ${netAmount.toLocaleString('fr-FR')} ${currency}</p>
            </div>

            <div style="text-align: center; margin: 24px 0;">
                <a href="${APP_URL}/school-admin/inscriptions" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary}); color: ${COLORS.white}; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
                    Voir les candidatures
                </a>
            </div>
        `

        await sendEmail({
            to: adminEmail,
            subject: `Nouvelle candidature — ${studentName}`,
            html: emailWrapper('Nouvelle candidature payee', schoolName, content),
        })
    }

    /**
     * Email a l'etudiant quand sa candidature est approuvee ou rejetee.
     */
    static async sendStatusUpdate(params: {
        studentEmail: string
        studentName: string
        schoolName: string
        formTitle: string
        newStatus: 'APPROVED' | 'REJECTED'
        reviewNote?: string
    }) {
        const { studentEmail, studentName, schoolName, formTitle, newStatus, reviewNote } = params
        const isApproved = newStatus === 'APPROVED'

        const statusText = isApproved ? 'approuvee' : 'rejetee'
        const statusColor = isApproved ? COLORS.success : COLORS.error
        const statusEmoji = isApproved ? '✅' : '❌'

        const noteBlock = reviewNote
            ? `<p style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 14px;"><strong>Note :</strong> ${reviewNote}</p>`
            : ''

        const ctaBlock = isApproved
            ? `<p>Felicitations ! Vous pouvez maintenant proceder aux etapes suivantes d'inscription aupres de l'etablissement.</p>`
            : `<p>Nous vous encourageons a explorer d'autres etablissements sur notre plateforme.</p>`

        const content = `
            <p>Bonjour <strong>${studentName}</strong>,</p>
            <p>Votre candidature a <strong>${schoolName}</strong> pour <strong>${formTitle}</strong> a ete <span style="color: ${statusColor}; font-weight: 700;">${statusEmoji} ${statusText}</span>.</p>

            ${noteBlock}
            ${ctaBlock}

            <div style="text-align: center; margin: 24px 0;">
                <a href="${APP_URL}/student/inscriptions" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary}); color: ${COLORS.white}; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
                    Voir mes candidatures
                </a>
            </div>
        `

        await sendEmail({
            to: studentEmail,
            subject: `Candidature ${statusText} — ${schoolName}`,
            html: emailWrapper(`Candidature ${statusText}`, schoolName, content),
        })
    }
}
