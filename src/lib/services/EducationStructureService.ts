import EducationLevel from "@/models/EducationLevel"
import Field from "@/models/Field"
import Subject from "@/models/Subject"
import LearningUnit from "@/models/LearningUnit"
import Competency from "@/models/Competency"
import { SubSystem, Cycle } from "@/models/enums"
import { EducationalComponentFactory } from "@/lib/patterns/EducationalHierarchy"
import { SubjectRepository } from "@/lib/repositories/SubjectRepository"
import { LearningUnitRepository } from "@/lib/repositories/LearningUnitRepository"
import { FieldRepository } from "@/lib/repositories/FieldRepository"

/**
 * Service pour gérer la structure éducative
 * Utilise le Composite Pattern pour la navigation hiérarchique
 */
export class EducationStructureService {
    /**
     * Récupère les niveaux d'éducation avec filtres optionnels
     */
    static async getEducationLevels(filters: {
        subSystem?: SubSystem
        cycle?: Cycle
        isActive?: boolean
    } = {}) {
        const query: any = {}

        if (filters.subSystem) query.subSystem = filters.subSystem
        if (filters.cycle) query.cycle = filters.cycle
        if (filters.isActive !== undefined) query.isActive = filters.isActive

        return await EducationLevel.find(query)
            .sort({ order: 1 })
            .lean()
    }

    /**
     * Récupère un niveau par ID avec sa hiérarchie
     */
    static async getEducationLevelById(id: string) {
        const level = await EducationLevel.findById(id).lean()
        if (!level) return null

        const component = EducationalComponentFactory.create('EducationLevel', level)
        const children = await component.getChildren()

        return {
            ...level,
            children: children.map(c => ({ _id: c._id, name: c.name, code: c.code }))
        }
    }

    /**
     * Récupère les filières avec filtres
     */
    static async getFields(filters: {
        level?: string | string[]
        cycle?: Cycle
        category?: string
        isActive?: boolean
        parentField?: string
    } = {}) {
        const repo = new FieldRepository()
        return await repo.find({
            level: filters.level,
            cycle: filters.cycle as string,
            category: filters.category,
            isActive: filters.isActive,
            parentField: filters.parentField
        })
    }

    /**
     * Récupère une filière par ID avec sa hiérarchie
     */
    static async getFieldById(id: string) {
        const repo = new FieldRepository()
        const field = await repo.findById(id)

        if (!field) return null

        const component = EducationalComponentFactory.create('Field', field)
        const children = await component.getChildren()

        return {
            ...field,
            children: children.map(c => ({ _id: c._id, name: c.name, code: c.code }))
        }
    }

    /**
     * Crée une nouvelle filière
     */
    static async createField(data: Partial<any>, createdBy: string) {
        const repo = new FieldRepository()
        // TODO: Add validation for data
        // Note: Field model doesn't have a createdBy field, so we just pass the data as-is
        return await repo.create(data)
    }

    /**
     * Met à jour une filière
     */
    static async updateField(id: string, data: Partial<any>, userId: string) {
        // TODO: Add authorization checks (e.g., only admin can update)
        // TODO: Add validation for data
        const repo = new FieldRepository()
        return await repo.updateById(id, data)
    }

    /**
     * Supprime (soft delete) une filière
     */
    static async deleteField(id: string, userId: string) {
        // TODO: Add authorization checks
        const repo = new FieldRepository()
        return await repo.softDelete(id)
    }

    /**
     * Récupère les matières avec filtres
     */
    static async getSubjects(filters: {
        level?: string | string[]
        field?: string
        subjectType?: string
        isActive?: boolean
    } = {}) {
        const query: any = {}

        if (filters.level) {
            if (Array.isArray(filters.level)) {
                query.applicableLevels = { $in: filters.level }
            } else {
                query.applicableLevels = filters.level
            }
        }
        if (filters.field) query.applicableFields = filters.field
        if (filters.subjectType) query.subjectType = filters.subjectType
        if (filters.isActive !== undefined) query.isActive = filters.isActive

        return await Subject.find(query)
            .populate('applicableLevels', 'name code')
            .populate('applicableFields', 'name code')
            .populate('parentSubject', 'name code')
            .lean()
    }

    /**
     * Récupère une matière par ID avec sa hiérarchie
     */
    static async getSubjectById(id: string) {
        const repo = new SubjectRepository();
        const subject = await repo.findById(id);

        if (!subject) return null;

        const component = EducationalComponentFactory.create('Subject', subject);
        const children = await component.getChildren();

        return {
            ...subject,
            children: children.map(c => ({ _id: c._id, name: c.name, code: c.code }))
        };
    }

    /**
     * Récupère les unités d'apprentissage avec filtres
     */
    static async getLearningUnits(filters: {
        subject?: string
        parentUnit?: string | null
        unitType?: string
        isActive?: boolean
    } = {}) {
        const repo = new LearningUnitRepository()
        return await repo.find(filters)
    }

    /**
     * Récupère une unité d'apprentissage par ID avec sa hiérarchie
     */
    static async getLearningUnitById(id: string) {
        const repo = new LearningUnitRepository()
        const unit = await repo.findById(id)

        if (!unit) return null

        const component = EducationalComponentFactory.create('LearningUnit', unit)
        const children = await component.getChildren()

        return {
            ...unit,
            children: children.map(c => ({ _id: c._id, name: c.name, code: c.code }))
        }
    }

    /**
     * Crée une nouvelle unité d'apprentissage
     */
    static async createLearningUnit(data: Partial<any>) {
        const repo = new LearningUnitRepository()
        return await repo.create(data)
    }

    /**
     * Met à jour une unité d'apprentissage
     */
    static async updateLearningUnit(id: string, data: Partial<any>) {
        const repo = new LearningUnitRepository()
        return await repo.updateById(id, data)
    }

    /**
     * Supprime (soft delete) une unité d'apprentissage
     */
    static async deleteLearningUnit(id: string) {
        const repo = new LearningUnitRepository()
        return await repo.softDelete(id)
    }

    /**
     * Récupère toutes les compétences
     */
    static async getCompetencies(filters: {
        type?: string
        isActive?: boolean
    } = {}) {
        const query: any = {}

        if (filters.type) query.type = filters.type
        if (filters.isActive !== undefined) query.isActive = filters.isActive

        return await Competency.find(query).lean()
    }

    /**
     * Récupère une compétence par ID
     */
    static async getCompetencyById(id: string) {
        return await Competency.findById(id).lean()
    }

    /**
     * Récupère le chemin complet d'un élément (breadcrumb)
     */
    static async getBreadcrumb(type: string, id: string) {
        const component = await EducationalComponentFactory.createFromId(type, id as any)
        if (!component) return []

        return await component.getPath()
    }
}
