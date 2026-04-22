import { safeTrigger, getUserChannel } from '@/lib/pusher'
import { sendEmail } from '@/lib/mail'
import { ITransaction } from '@/models/Transaction'
import { ISubscription } from '@/models/Subscription'
import { TransactionStatus, TransactionType } from '@/models/enums'

export interface PaymentStatusPayload {
    reference: string
    status: TransactionStatus
    type: TransactionType
    productName?: string
    amount: number
    currency: string
    message: string
}

export interface SubscriptionPayload {
    planName: string
    interval: string
    expiresAt: Date
    daysLeft?: number
}

export class PaymentNotificationService {
    /**
     * Notify user of payment status change via Pusher.
     */
    static async notifyPaymentStatus(transaction: ITransaction): Promise<void> {
        const userId = transaction.userId.toString()
        const channel = getUserChannel(userId)

        const payload: PaymentStatusPayload = {
            reference: transaction.paymentReference,
            status: transaction.status,
            type: transaction.type,
            amount: transaction.finalAmount,
            currency: transaction.paymentCurrency,
            message: this.getStatusMessage(transaction.status, transaction.type),
        }

        await safeTrigger(channel, 'payment-status', payload)

        // Send email for completed or failed payments
        if (
            transaction.status === TransactionStatus.COMPLETED ||
            transaction.status === TransactionStatus.FAILED
        ) {
            await this.sendPaymentEmail(transaction)
        }
    }

    /**
     * Get user-friendly status message.
     */
    private static getStatusMessage(status: TransactionStatus, type: TransactionType): string {
        const typeLabel = this.getTypeLabel(type)

        switch (status) {
            case TransactionStatus.COMPLETED:
                return `Votre ${typeLabel} a été effectué avec succès !`
            case TransactionStatus.FAILED:
                return `Votre ${typeLabel} a échoué. Veuillez réessayer.`
            case TransactionStatus.PROCESSING:
                return `Votre ${typeLabel} est en cours de traitement...`
            case TransactionStatus.REFUNDED:
                return `Votre ${typeLabel} a été remboursé.`
            case TransactionStatus.EXPIRED:
                return `Votre ${typeLabel} a expiré.`
            default:
                return `Statut de ${typeLabel}: ${status}`
        }
    }

    /**
     * Get type label in French.
     */
    private static getTypeLabel(type: TransactionType): string {
        switch (type) {
            case TransactionType.BOOK_PURCHASE:
                return 'achat de livre'
            case TransactionType.SUBSCRIPTION:
                return 'abonnement'
            case TransactionType.COURSE:
                return 'achat de cours'
            case TransactionType.TOP_UP:
                return 'recharge'
            default:
                return 'paiement'
        }
    }

    /**
     * Send payment confirmation/failure email.
     */
    private static async sendPaymentEmail(transaction: ITransaction): Promise<void> {
        const user = transaction.userId as unknown as { email?: string; name?: string }
        if (!user?.email) return

        const typeLabel = this.getTypeLabel(transaction.type)

        if (transaction.status === TransactionStatus.COMPLETED) {
            await sendEmail({
                to: user.email,
                subject: `Paiement confirmé - ${typeLabel}`,
                html: this.getSuccessEmailHtml(transaction, user.name ?? 'Utilisateur'),
            })
        } else if (transaction.status === TransactionStatus.FAILED) {
            await sendEmail({
                to: user.email,
                subject: `Paiement échoué - ${typeLabel}`,
                html: this.getFailureEmailHtml(transaction, user.name ?? 'Utilisateur'),
            })
        }
    }

    /**
     * Generate success email HTML.
     */
    private static getSuccessEmailHtml(transaction: ITransaction, userName: string): string {
        const typeLabel = this.getTypeLabel(transaction.type)
        const formattedAmount = new Intl.NumberFormat('fr-FR').format(transaction.finalAmount)

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .amount { font-size: 24px; font-weight: bold; color: #4CAF50; }
        .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Paiement Confirmé</h1>
        </div>
        <div class="content">
            <p>Bonjour ${userName},</p>
            <p>Votre ${typeLabel} a été effectué avec succès !</p>
            
            <div class="details">
                <p><strong>Référence :</strong> ${transaction.paymentReference}</p>
                <p><strong>Montant :</strong> <span class="amount">${formattedAmount} ${transaction.paymentCurrency}</span></p>
                <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            
            <p>Vous pouvez maintenant accéder à votre contenu depuis votre espace personnel.</p>
            
            <p>Merci pour votre confiance !</p>
        </div>
        <div class="footer">
            <p>QuizLock - Votre plateforme d'apprentissage</p>
        </div>
    </div>
</body>
</html>`
    }

    /**
     * Generate failure email HTML.
     */
    private static getFailureEmailHtml(transaction: ITransaction, userName: string): string {
        const typeLabel = this.getTypeLabel(transaction.type)

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .retry-btn { display: inline-block; background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✗ Paiement Échoué</h1>
        </div>
        <div class="content">
            <p>Bonjour ${userName},</p>
            <p>Malheureusement, votre ${typeLabel} n'a pas pu être traité.</p>
            
            <div class="details">
                <p><strong>Référence :</strong> ${transaction.paymentReference}</p>
                <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            
            <p>Cela peut être dû à :</p>
            <ul>
                <li>Solde insuffisant</li>
                <li>Problème de connexion</li>
                <li>Transaction annulée</li>
            </ul>
            
            <p>Vous pouvez réessayer le paiement depuis votre espace personnel.</p>
            
            <p>Si le problème persiste, contactez notre support.</p>
        </div>
        <div class="footer">
            <p>QuizLock - Votre plateforme d'apprentissage</p>
        </div>
    </div>
</body>
</html>`
    }

    /**
     * Notify user when subscription is activated.
     */
    static async notifySubscriptionActivated(
        userId: string,
        subscription: ISubscription,
        planName: string
    ): Promise<void> {
        const channel = getUserChannel(userId)

        const payload: SubscriptionPayload = {
            planName,
            interval: subscription.interval,
            expiresAt: subscription.currentPeriodEnd,
        }

        await safeTrigger(channel, 'subscription-activated', payload)
    }

    /**
     * Notify user about upcoming subscription renewal.
     */
    static async notifySubscriptionExpiring(
        userId: string,
        planName: string,
        daysLeft: number,
        expiresAt: Date
    ): Promise<void> {
        const channel = getUserChannel(userId)

        const payload: SubscriptionPayload = {
            planName,
            interval: '',
            expiresAt,
            daysLeft,
        }

        await safeTrigger(channel, 'subscription-expiring', payload)
    }

    /**
     * Notify user when subscription expires.
     */
    static async notifySubscriptionExpired(userId: string, planName: string): Promise<void> {
        const channel = getUserChannel(userId)

        await safeTrigger(channel, 'subscription-expired', {
            planName,
            message: `Votre abonnement ${planName} a expiré.`,
        })
    }
}
