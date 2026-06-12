/**
 * Audit Log Repository
 * Data access layer for immutable audit logs
 * All methods are append-only (no updates or deletes)
 */

import AuditLog, { IAuditLog } from '@/models/AuditLog';
import connectDB from "@/lib/mongodb";
import { AuditAction } from '@/models/enums';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export class AuditLogRepository {
    /**
     * Create an audit log entry
     * APPEND-ONLY: New records only, never modified
     *
     * @param data Audit information
     * @returns Created audit log record
     */
    async log(data: {
        actor: mongoose.Types.ObjectId;
        action: AuditAction;
        targetId: mongoose.Types.ObjectId;
        targetType: string;
        metadata?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<IAuditLog> {
        await connectDB();

        // Generate unique request ID for tracing
        const requestId = uuidv4();

        // Generate tamper-detection hash
        const timestamp = new Date().getTime();
        const hashInput = `${data.actor}${data.action}${data.targetId}${timestamp}`;
        const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

        // Create immutable record
        const auditLog = new AuditLog({
            requestId,
            actor: data.actor,
            action: data.action,
            targetId: data.targetId,
            targetType: data.targetType,
            metadata: data.metadata || {},
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            hash,
            isImmutable: true,
        });

        return await auditLog.save();
    }

    /**
     * Find audit logs by actor (who did what)
     */
    async findByActor(
        actorId: mongoose.Types.ObjectId,
        limit: number = 100
    ): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({ actor: actorId })
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Find audit logs by target (what happened to this entity)
     */
    async findByTarget(
        targetId: mongoose.Types.ObjectId,
        limit: number = 100
    ): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({ targetId })
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Find audit logs by action type
     */
    async findByAction(
        action: AuditAction,
        limit: number = 100
    ): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({ action })
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Find audit logs within date range (for compliance reports)
     */
    async findByDateRange(
        startDate: Date,
        endDate: Date,
        limit: number = 1000
    ): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({
            createdAt: { $gte: startDate, $lte: endDate },
        })
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Find logs by request ID (trace related operations)
     */
    async findByRequestId(requestId: string): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({ requestId }).sort({ createdAt: 1 });
    }

    /**
     * Get audit trail for a specific parent
     * Used for parent data export (GDPR right to access)
     */
    async getParentAuditTrail(parentId: mongoose.Types.ObjectId): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({
            $or: [{ actor: parentId }, { targetId: parentId }],
        })
            .sort({ createdAt: -1 })
            .limit(500);
    }

    /**
     * Get all actions on a parent-learner link
     */
    async getLinkAuditTrail(
        linkId: mongoose.Types.ObjectId
    ): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({
            targetId: linkId,
            targetType: 'ParentLearnerLink',
        }).sort({ createdAt: -1 });
    }

    /**
     * Get compliance report: all KYC actions within date range
     */
    async getKYCComplianceReport(
        startDate: Date,
        endDate: Date
    ): Promise<{
        totalKYCActions: number;
        verified: number;
        rejected: number;
        byAction: Record<string, number>;
    }> {
        await connectDB();

        const logs = await AuditLog.find({
            action: { $in: [AuditAction.KYC_L1_VERIFIED, AuditAction.KYC_L1_REJECTED, AuditAction.KYC_L2_VERIFIED] },
            createdAt: { $gte: startDate, $lte: endDate },
        });

        const byAction = {
            KYC_L1_VERIFIED: 0,
            KYC_L1_REJECTED: 0,
            KYC_L2_VERIFIED: 0,
        };

        for (const log of logs) {
            byAction[log.action as keyof typeof byAction]++;
        }

        return {
            totalKYCActions: logs.length,
            verified: byAction.KYC_L1_VERIFIED + byAction.KYC_L2_VERIFIED,
            rejected: byAction.KYC_L1_REJECTED,
            byAction,
        };
    }

    /**
     * Get SOS alert audit trail
     */
    async getSOSAuditTrail(sosAlertId: mongoose.Types.ObjectId): Promise<IAuditLog[]> {
        await connectDB();

        return await AuditLog.find({
            targetId: sosAlertId,
            action: { $in: [AuditAction.SOS_TRIGGERED, AuditAction.SOS_ACKNOWLEDGED] },
        }).sort({ createdAt: 1 });
    }

    /**
     * Verify integrity of audit logs
     * Check if any records have been tampered with
     */
    async verifyIntegrity(
        sampleSize: number = 100
    ): Promise<{
        checked: number;
        valid: number;
        corrupted: number;
        corruptedIds: string[];
    }> {
        await connectDB();

        const logs = await AuditLog.find()
            .sort({ createdAt: -1 })
            .limit(sampleSize);

        let valid = 0;
        const corruptedIds: string[] = [];

        for (const log of logs) {
            if (log.verifyHash(crypto)) {
                valid++;
            } else {
                corruptedIds.push(log._id.toString());
            }
        }

        return {
            checked: logs.length,
            valid,
            corrupted: corruptedIds.length,
            corruptedIds,
        };
    }

    /**
     * Get audit statistics
     */
    async getStatistics(days: number = 30): Promise<{
        totalRecords: number;
        recordsInPeriod: number;
        topActions: Array<{ action: string; count: number }>;
        topActors: Array<{ actorId: string; count: number }>;
    }> {
        await connectDB();

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [totalRecords, recentLogs] = await Promise.all([
            AuditLog.countDocuments(),
            AuditLog.find({ createdAt: { $gte: startDate } }),
        ]);

        // Count by action
        const actionCounts: Record<string, number> = {};
        const actorCounts: Record<string, number> = {};

        for (const log of recentLogs) {
            actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
            const actorId = log.actor.toString();
            actorCounts[actorId] = (actorCounts[actorId] || 0) + 1;
        }

        const topActions = Object.entries(actionCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([action, count]) => ({ action, count }));

        const topActors = Object.entries(actorCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([actorId, count]) => ({ actorId, count }));

        return {
            totalRecords,
            recordsInPeriod: recentLogs.length,
            topActions,
            topActors,
        };
    }

    /**
     * Export parent data for GDPR request
     * Returns all audit logs mentioning this parent
     */
    async exportParentData(parentId: mongoose.Types.ObjectId): Promise<{
        auditTrail: any[];
        exportedAt: Date;
    }> {
        await connectDB();

        const auditTrail = await this.getParentAuditTrail(parentId);

        return {
            auditTrail: auditTrail.map(log => ({
                action: log.action,
                targetType: log.targetType,
                metadata: log.metadata,
                timestamp: log.createdAt,
                description: log.getDescription(),
            })),
            exportedAt: new Date(),
        };
    }
}

// Export singleton instance
export const auditLogRepository = new AuditLogRepository();