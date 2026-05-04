import type { IEmailAdapter } from '@xkorienta/payment-sdk'
import { sendEmail } from '@/lib/mail'

/**
 * Wraps the existing sendEmail helper from lib/mail to satisfy the
 * payment-SDK IEmailAdapter port.
 */
export class NodemailerAdapter implements IEmailAdapter {
    async send(to: string, subject: string, html: string): Promise<void> {
        await sendEmail({ to, subject, html })
    }
}
