import { ILateCode, LateCodeStatus } from "@/models/LateCode"
import { UserRole } from "@/models/enums"
import { publishEvent } from "@/lib/events/EventPublisher"
import { EventType } from "@/lib/events/types"
import mongoose from "mongoose"
import crypto from "crypto"
import { LateCodeRepository } from "@/lib/repositories/LateCodeRepository"
import { ExamRepository } from "@/lib/repositories/ExamRepository"
import { UserRepository } from "@/lib/repositories/UserRepository"

/**
 * Service pour gérer les codes d'accès tardif (Late Codes)
 * Permet aux enseignants de donner un accès après la date limite
 */
export class LateCodeService {
    /**
     * Génère un nouveau code d'accès tardif
     */
    static async generateLateCode(
        examId: string,
        generatedBy: string,
        options: {
            usagesRemaining?: number
            expiresAt?: Date
            assignedUserId?: string
            reason?: string
        } = {}
    ) {
        const examRepo = new ExamRepository();
        const userRepo = new UserRepository();
        const lateCodeRepo = new LateCodeRepository();

        // Vérifier que l'examen existe
        const exam = await examRepo.findById(examId);
        if (!exam) throw new Error("Exam not found");

        // Vérifier que l'utilisateur est enseignant ou admin
        const user = await userRepo.findById(generatedBy);
        if (!user) throw new Error("User not found");

        const allowedRoles = [
            UserRole.TEACHER,
            UserRole.INSPECTOR,
            UserRole.SURVEILLANT,
            UserRole.PREFET,
            UserRole.PRINCIPAL
        ];

        if (!allowedRoles.includes(user.role as UserRole)) {
            throw new Error("Unauthorized: Only teachers and admins can generate late codes");
        }

        // Vérifier que l'enseignant est le créateur de l'examen
        if (exam.createdById.toString() !== generatedBy && user.role !== UserRole.INSPECTOR) {
            throw new Error("Unauthorized: Only the exam creator or inspector can generate late codes");
        }

        // Générer un code unique (8 caractères alphanumériques)
        const code = this.generateUniqueCode();

        // Créer le late code
        const lateCode = await lateCodeRepo.create({
            code,
            examId: new mongoose.Types.ObjectId(examId),
            generatedBy: new mongoose.Types.ObjectId(generatedBy),
            assignedUserId: options.assignedUserId
                ? new mongoose.Types.ObjectId(options.assignedUserId)
                : undefined,
            maxUsages: options.usagesRemaining || 1,
            expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours par défaut
            reason: options.reason || "Late access granted",
            status: LateCodeStatus.ACTIVE
        });

        // Publier un événement
        await publishEvent({
            type: EventType.LATE_CODE_GENERATED,
            data: {
                lateCodeId: lateCode._id,
                code: lateCode.code,
                examId: exam._id,
                examTitle: (exam as any).title,
                assignedUserId: options.assignedUserId,
                expiresAt: lateCode.expiresAt
            },
            userId: new mongoose.Types.ObjectId(generatedBy),
            timestamp: new Date()
        });

        return lateCode;
    }

    /**
     * Valide et utilise un code d'accès tardif
     */
    static async validateLateCode(code: string, examId: string, userId: string) {
        const lateCodeRepo = new LateCodeRepository();

        // Rechercher le code
        const lateCode = await lateCodeRepo.findByCodeAndExamId(code, examId);

        if (!lateCode) {
            throw new Error("Invalid late code");
        }

        // Vérifier que le code est actif
        if (lateCode.status !== LateCodeStatus.ACTIVE) {
            throw new Error("Late code has been deactivated")
        }

        // Vérifier l'expiration
        if (lateCode.expiresAt && new Date() > lateCode.expiresAt) {
            throw new Error("Late code has expired")
        }

        // Vérifier les usages restants
        if (lateCode.usagesRemaining <= 0) {
            throw new Error("Late code has no remaining usages")
        }

        // Vérifier si le code est assigné à un utilisateur spécifique
        if (lateCode.assignedUserId && lateCode.assignedUserId.toString() !== userId) {
            throw new Error("This late code is assigned to another user")
        }

        // Vérifier que l'utilisateur n'a pas déjà utilisé ce code
        const alreadyUsed = lateCode.usageHistory.some(
            (usage) => usage.userId.toString() === userId
        )

        if (alreadyUsed) {
            throw new Error("You have already used this late code")
        }

        // Enregistrer l'utilisation
        lateCode.usageHistory.push({
            userId: new mongoose.Types.ObjectId(userId),
            usedAt: new Date(),
            attemptId: new mongoose.Types.ObjectId() // Sera mis à jour quand l'attempt est créé
        })

        // Le pre-save hook du modèle mettra à jour usagesRemaining et status automatiquement
        await lateCodeRepo.save(lateCode);

        // Publier un événement
        await publishEvent({
            type: EventType.LATE_CODE_USED,
            data: {
                lateCodeId: lateCode._id,
                code: lateCode.code,
                examId: examId,
                usagesRemaining: lateCode.usagesRemaining
            },
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: new Date()
        })

        return {
            success: true,
            lateCode,
            message: "Late code validated successfully. You can now access the exam."
        }
    }

    /**
     * Récupère tous les codes pour un examen
     */
    static async getLateCodesForExam(examId: string, userId: string) {
        const examRepo = new ExamRepository();
        const lateCodeRepo = new LateCodeRepository();

        // Vérifier que l'utilisateur est le créateur de l'examen
        const exam = await examRepo.findById(examId);
        if (!exam) throw new Error("Exam not found");

        if (exam.createdById.toString() !== userId) {
            throw new Error("Unauthorized: Only the exam creator can view late codes");
        }

        return await lateCodeRepo.findByExamId(examId);
    }

    /**
     * Désactive un code d'accès tardif
     */
    static async deactivateLateCode(lateCodeId: string, userId: string) {
        const lateCodeRepo = new LateCodeRepository();

        const lateCode = await lateCodeRepo.findById(lateCodeId);
        if (!lateCode) throw new Error("Late code not found");

        // Vérifier que l'utilisateur est le créateur
        if (lateCode.generatedBy.toString() !== userId) {
            throw new Error("Unauthorized: Only the code generator can deactivate it");
        }

        await lateCode.revoke(new mongoose.Types.ObjectId(userId));

        return { success: true, message: "Late code deactivated" };
    }

    /**
     * Génère un code unique de 8 caractères
     */
    private static generateUniqueCode(): string {
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Évite les caractères ambigus
        let code = ''

        for (let i = 0; i < 8; i++) {
            const randomIndex = crypto.randomInt(0, characters.length)
            code += characters[randomIndex]
        }

        return code
    }

    /**
     * Vérifie si un utilisateur a un accès tardif valide pour un examen
     */
    static async hasValidLateAccess(examId: string, userId: string): Promise<boolean> {
        const lateCodeRepo = new LateCodeRepository();
        const lateCode = await lateCodeRepo.findValidLateAccess(examId, userId);
        return !!lateCode;
    }
}
