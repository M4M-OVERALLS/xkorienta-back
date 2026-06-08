/**
 * Backfill : génère les reçus d'inscription manquants pour les candidatures
 * déjà payées avant l'ajout de la génération automatique de factures.
 *
 * Run:
 *   npx tsx scripts/backfill-inscription-invoices.ts          # exécution réelle
 *   npx tsx scripts/backfill-inscription-invoices.ts --dry    # simulation (aucune écriture)
 *   npx tsx scripts/backfill-inscription-invoices.ts --email  # ré-envoie aussi les reçus par email
 *
 * Idempotent : InvoiceService.generateForInscription ne recrée pas une facture
 * si une facture SCHOOL_INSCRIPTION existe déjà pour la référence de paiement.
 * Le script peut donc être relancé sans risque de doublon.
 */

// Doit être le premier import : charge .env avant que mongodb.ts lise DATABASE_URL
import 'dotenv/config'

import mongoose from 'mongoose'
import connectDB from '../src/lib/mongodb'
import SchoolApplication from '../src/models/SchoolApplication'
import InscriptionForm from '../src/models/InscriptionForm'
import { InvoiceService } from '../src/lib/services/InvoiceService'
import { PaymentStatus } from '../src/models/enums'

const DRY_RUN = process.argv.includes('--dry')
const SEND_EMAIL = process.argv.includes('--email')

type PopulatedUser = { _id: { toString(): string }; name?: string; email?: string }

type BackfillApplication = {
    _id: { toString(): string }
    paymentRef?: string
    inscriptionFormId: unknown
    userId?: unknown
    guestEmail?: string
    candidateData?: Record<string, unknown>
}

type Outcome = 'created' | 'skipped' | 'failed'

/**
 * Traite une candidature : génère le reçu manquant et lie la facture.
 * Retourne l'issue pour la comptabilisation.
 */
async function processApplication(app: BackfillApplication, ref: string): Promise<Outcome> {
    const form = await InscriptionForm.findById(app.inscriptionFormId)
        .select('title price commissionRate')
        .lean()

    if (!form) {
        console.warn(`  ⚠️  [${ref}] Fiche d'inscription introuvable — ignorée`)
        return 'skipped'
    }

    const buyer = app.userId as PopulatedUser | null
    const candidate = app.candidateData ?? {}
    const buyerName =
        buyer?.name ??
        (typeof candidate.nom === 'string' ? candidate.nom : undefined) ??
        'Candidat'
    const buyerEmail = buyer?.email ?? app.guestEmail
    const recipientId = buyer?._id ? buyer._id.toString() : undefined

    if (DRY_RUN) {
        console.log(`  • [${ref}] → reçu pour "${buyerName}" (${buyerEmail ?? 'sans email'}) — ${form.price} XAF`)
        return 'created'
    }

    const invoice = await InvoiceService.generateForInscription({
        paymentReference: ref,
        recipientId,
        isGuest: !recipientId,
        buyerName,
        buyerEmail,
        formTitle: form.title,
        price: form.price,
        commissionRate: form.commissionRate ?? 5,
        currency: 'XAF',
        sendEmailReceipt: SEND_EMAIL,
    })

    await SchoolApplication.updateOne(
        { _id: app._id, invoiceId: { $exists: false } },
        { $set: { invoiceId: invoice._id } },
    )

    console.log(`  ✅ [${ref}] Facture ${invoice.invoiceNumber} → ${buyerName}`)
    return 'created'
}

async function backfill(): Promise<void> {
    await connectDB()
    console.log(`\n[Backfill] Démarrage ${DRY_RUN ? '(DRY RUN — aucune écriture)' : ''}`)
    console.log(`[Backfill] Envoi des emails : ${SEND_EMAIL ? 'OUI' : 'NON'}\n`)

    // Candidatures payées sans facture liée
    const applications = await SchoolApplication.find({
        paymentStatus: PaymentStatus.PAID,
        paymentRef: { $exists: true, $ne: null },
        invoiceId: { $exists: false },
    })
        .populate('userId', 'name email')
        .lean()

    console.log(`[Backfill] ${applications.length} candidature(s) payée(s) sans facture trouvée(s)\n`)

    const counts: Record<Outcome, number> = { created: 0, skipped: 0, failed: 0 }

    for (const app of applications as unknown as BackfillApplication[]) {
        const ref = app.paymentRef
        if (!ref) {
            counts.skipped++
            continue
        }
        try {
            const outcome = await processApplication(app, ref)
            counts[outcome]++
        } catch (err) {
            console.error(`  ❌ [${ref}] Échec :`, (err as Error).message)
            counts.failed++
        }
    }

    const { created, skipped, failed } = counts

    console.log(`\n[Backfill] Terminé.`)
    console.log(`  Factures ${DRY_RUN ? 'à créer' : 'créées'} : ${created}`)
    console.log(`  Ignorées               : ${skipped}`)
    console.log(`  Échecs                 : ${failed}\n`)

    await mongoose.disconnect()
    process.exit(failed > 0 ? 1 : 0)
}

backfill().catch((err) => {
    console.error('[Backfill] Erreur fatale :', err)
    process.exit(1)
})
