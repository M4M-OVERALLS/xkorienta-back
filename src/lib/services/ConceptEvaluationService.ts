import { ConceptEvaluationRepository } from "@/lib/repositories/ConceptEvaluationRepository";
import { GamificationService, XPSource } from "@/lib/services/GamificationService";
import { MasteryLevel } from "@/models/ConceptEvaluation";

export interface CreateConceptEvaluationData {
    conceptId: string;
    syllabusId: string;
    level: MasteryLevel;
    reflection?: string;
}

export interface SaveSelfAssessmentData {
    conceptId: string;
    level: string;
    reflection?: string;
    syllabusId?: string;
}

export class ConceptEvaluationService {
    /**
     * Create a new concept evaluation
     */
    static async createEvaluation(
        studentId: string,
        data: CreateConceptEvaluationData
    ) {
        // Validate required fields
        if (!data.conceptId || !data.syllabusId || !data.level) {
            throw new Error("Missing required fields: conceptId, syllabusId, and level are required");
        }

        // Validate level is a valid MasteryLevel
        if (!Object.values(MasteryLevel).includes(data.level)) {
            throw new Error("Invalid mastery level");
        }

        const repo = new ConceptEvaluationRepository();
        return await repo.create({
            student: studentId,
            concept: data.conceptId,
            syllabus: data.syllabusId,
            level: data.level,
            reflection: data.reflection,
            evaluatedAt: new Date()
        });
    }

    /**
     * Get student's evaluations for a syllabus
     */
    static async getStudentEvaluations(studentId: string, syllabusId: string) {
        const repo = new ConceptEvaluationRepository();
        return await repo.findByStudentAndSyllabus(studentId, syllabusId);
    }

    /**
     * Save a student's self-assessment (create or update)
     */
    static async saveSelfAssessment(
        studentId: string,
        data: SaveSelfAssessmentData
    ) {
        if (!data.conceptId || !data.level) {
            throw new Error("conceptId and level are required");
        }

        const repo = new ConceptEvaluationRepository();

        // Check if evaluation already exists
        const existingEval = await repo.findByStudentAndConcept(studentId, data.conceptId);

        let evaluation;
        let isNew = false;

        if (existingEval) {
            // Update existing
            evaluation = await repo.update(existingEval, {
                level: data.level,
                reflection: data.reflection,
                evaluatedAt: new Date()
            });
        } else {
            // Create new
            isNew = true;
            evaluation = await repo.create({
                student: studentId,
                concept: data.conceptId,
                syllabus: data.syllabusId,
                level: data.level,
                reflection: data.reflection,
                evaluatedAt: new Date()
            });

            // Award XP for first self-evaluation of this concept
            await GamificationService.awardXP(studentId, XPSource.SELF_EVAL, {
                sourceId: data.conceptId,
                description: "Auto-évaluation d'un concept"
            });
        }

        return {
            id: evaluation._id,
            level: evaluation.level,
            evaluatedAt: evaluation.evaluatedAt,
            isNew
        };
    }

    /**
     * Get all self-assessments for a student (optionally filtered by syllabus)
     */
    static async getSelfAssessments(studentId: string, syllabusId?: string) {
        const repo = new ConceptEvaluationRepository();
        const evaluations = await repo.findByStudent(studentId, syllabusId);

        return evaluations.map(e => {
            const evalData = e as unknown as Record<string, unknown>;
            return {
                id: evalData._id,
                concept: evalData.concept,
                level: evalData.level,
                reflection: evalData.reflection,
                evaluatedAt: evalData.evaluatedAt
            };
        });
    }
}
