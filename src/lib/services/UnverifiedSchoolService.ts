/**
 * UnverifiedSchoolService
 *
 * Service pour gérer le cycle de vie des écoles non vérifiées :
 *  - findOrCreate   : Trouver ou créer une école non vérifiée (avec déduplication)
 *  - validateSchool : Valider → crée une vraie School et migre les users
 *  - mergeToExistingSchool : Fusionner vers une School existante
 *  - rejectSchool   : Rejeter une déclaration d'école
 */

import mongoose from 'mongoose'
import UnverifiedSchool from '@/models/UnverifiedSchool'
import User from '@/models/User'
import School from '@/models/School'
import LearnerProfile from '@/models/LearnerProfile'
import { SchoolSearchService } from './SchoolSearchService'
import { SchoolStatus } from '@/models/enums'

export interface DeclaredSchoolData {
    name: string
    city?: string
    country?: string
    type?: string
}

export class UnverifiedSchoolService {

    // ─────────────────────────────────────────────────────────────────────────
    // Validation & Sanitization
    // ─────────────────────────────────────────────────────────────────────────

    private static sanitize(data: DeclaredSchoolData): DeclaredSchoolData {
        // Vérifier longueur
        if (data.name && data.name.length > 200) {
            throw new Error("Le nom de l'école ne peut pas dépasser 200 caractères")
        }

        // Détecter les injections NoSQL
        if (typeof data.name === 'object' || data.name === null) {
            throw new Error("Caractères invalides détectés")
        }

        // Détecter tentatives d'injection SQL-like
        if (/['";].*[-]{2}/.test(data.name)) {
            throw new Error("Caractères invalides détectés")
        }

        return {
            name: SchoolSearchService.normalizeSchoolName(data.name),
            city: data.city ? SchoolSearchService.normalizeSchoolName(data.city) : undefined,
            country: data.country ? SchoolSearchService.normalizeSchoolName(data.country) : undefined,
            type: data.type ? data.type.trim().slice(0, 50) : undefined
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // findOrCreate
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Trouve une UnverifiedSchool PENDING existante avec le même nom normalisé,
     * ou en crée une nouvelle.
     * Gère la déduplication et incrémente declaredCount si déjà existante.
     */
    static async findOrCreate(
        data: DeclaredSchoolData,
        userId: mongoose.Types.ObjectId
    ): Promise<any> {
        const sanitized = UnverifiedSchoolService.sanitize(data)

        const normalizedName = sanitized.name

        // Chercher une école non vérifiée PENDING avec le même nom
        const existing = await UnverifiedSchool.findOne({
            declaredName: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
            status: 'PENDING'
        })

        if (existing) {
            // Vérifier si l'utilisateur a déjà déclaré cette école
            const alreadyDeclared = existing.declaredBy.some(
                (id: mongoose.Types.ObjectId) => id.toString() === userId.toString()
            )

            if (!alreadyDeclared) {
                existing.declaredBy.push(userId)
                existing.declaredCount += 1
                await existing.save()
            }

            return existing
        }

        // Créer une nouvelle école non vérifiée
        const newSchool = await UnverifiedSchool.create({
            declaredName: normalizedName,
            declaredCity: sanitized.city,
            declaredCountry: sanitized.country,
            declaredType: sanitized.type,
            declaredBy: [userId],
            declaredCount: 1,
            status: 'PENDING'
        })

        return newSchool
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validateSchool
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ADMIN : Valide une école non vérifiée → crée une vraie School
     * et migre tous les utilisateurs liés vers cette école.
     */
    static async validateSchool(
        unverifiedSchoolId: string,
        adminId: string,
        schoolData: { name: string; type: string; city?: string; country?: string }
    ): Promise<{ success: boolean; schoolId: string }> {
        const unverifiedId = new mongoose.Types.ObjectId(unverifiedSchoolId)
        const ownerId = new mongoose.Types.ObjectId(adminId)

        // Préparer les données pour la nouvelle école
        const createData: any = {
            name: schoolData.name,
            type: schoolData.type,
            status: SchoolStatus.VALIDATED,
            isActive: true,
            owner: ownerId,
            admins: [ownerId],
            teachers: [],
            applicants: []
        }

        // city/country deben ser ObjectIds en el modelo School
        if (schoolData.city && mongoose.Types.ObjectId.isValid(schoolData.city)) {
            createData.city = new mongoose.Types.ObjectId(schoolData.city)
        }
        if (schoolData.country && mongoose.Types.ObjectId.isValid(schoolData.country)) {
            createData.country = new mongoose.Types.ObjectId(schoolData.country)
        }

        // Créer la nouvelle école officielle
        const officialSchool = await School.create(createData)

        const newSchoolId = officialSchool._id as mongoose.Types.ObjectId


        // Mettre à jour le statut de l'école non vérifiée
        await UnverifiedSchool.findByIdAndUpdate(
            unverifiedId,
            {
                status: 'VALIDATED',
                matchedSchool: newSchoolId
            },
            { new: true }
        )

        // Migrer tous les utilisateurs vers la nouvelle école
        await User.updateMany(
            { unverifiedSchool: unverifiedId },
            {
                $addToSet: { schools: newSchoolId },
                $unset: { unverifiedSchool: '' }
            }
        )

        // Mettre à jour les LearnerProfiles
        const affectedUsers = await User.find({ schools: newSchoolId }).select('_id')
        const userIds = affectedUsers.map(u => u._id)

        if (userIds.length > 0) {
            await LearnerProfile.updateMany(
                { user: { $in: userIds } },
                { awaitingSchoolValidation: false }
            )
        }

        return { success: true, schoolId: newSchoolId.toString() }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // mergeToExistingSchool
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ADMIN : Fusionne une école non vérifiée vers une école officielle existante.
     */
    static async mergeToExistingSchool(
        unverifiedSchoolId: string,
        targetSchoolId: string,
        adminId: string
    ): Promise<{ success: boolean; mergedCount: number }> {
        const unverifiedId = new mongoose.Types.ObjectId(unverifiedSchoolId)
        const targetId = new mongoose.Types.ObjectId(targetSchoolId)

        // Mettre à jour le statut de l'école non vérifiée
        await UnverifiedSchool.findByIdAndUpdate(
            unverifiedId,
            {
                status: 'MERGED',
                matchedSchool: targetId
            },
            { new: true }
        )

        // Migrer les utilisateurs vers l'école cible
        const result = await User.updateMany(
            { unverifiedSchool: unverifiedId },
            {
                $addToSet: { schools: targetId },
                $unset: { unverifiedSchool: '' }
            }
        )

        // Mettre à jour les LearnerProfiles
        const affectedUsers = await User.find({ schools: targetId }).select('_id')
        const userIds = affectedUsers.map(u => u._id)

        if (userIds.length > 0) {
            await LearnerProfile.updateMany(
                { user: { $in: userIds } },
                { awaitingSchoolValidation: false }
            )
        }

        return { success: true, mergedCount: result.modifiedCount }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // rejectSchool
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ADMIN : Rejette une déclaration d'école non vérifiée.
     */
    static async rejectSchool(
        unverifiedSchoolId: string,
        adminId: string,
        notes: string
    ): Promise<{ success: boolean }> {
        const unverifiedId = new mongoose.Types.ObjectId(unverifiedSchoolId)

        await UnverifiedSchool.findByIdAndUpdate(
            unverifiedId,
            {
                status: 'REJECTED',
                notes
            },
            { new: true }
        )

        return { success: true }
    }
}
