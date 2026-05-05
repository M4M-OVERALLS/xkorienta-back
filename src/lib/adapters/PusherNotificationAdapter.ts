import type { INotificationAdapter } from '@xkorienta/payment-sdk'
import { getUserChannel, safeTrigger } from '@/lib/pusher'

/**
 * Wraps the existing Pusher `safeTrigger` helper to satisfy the
 * payment-SDK INotificationAdapter port.
 */
export class PusherNotificationAdapter implements INotificationAdapter {
    /**
     * Pushes a real-time event to the user's private channel.
     * Gracefully degrades if Pusher is not configured.
     */
    async notifyUser(userId: string, event: string, payload: unknown): Promise<void> {
        const channel = getUserChannel(userId)
        await safeTrigger(channel, event, payload)
    }
}
