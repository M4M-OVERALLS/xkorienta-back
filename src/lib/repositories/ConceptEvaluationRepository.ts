import ConceptEvaluation, { IConceptEvaluation } from "@/models/ConceptEvaluation";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class ConceptEvaluationRepository {
    /**
     * Create a new concept evaluation
     */
    async create(data: {
        student: string;
        concept: string;
        syllabus?: string;
        level: string;
        reflection?: string;
        evaluatedAt?: Date;
    }): Promise<IConceptEvaluation> {
        await connectDB();
        return ConceptEvaluation.create({
            student: new mongoose.Types.ObjectId(data.student),
            concept: new mongoose.Types.ObjectId(data.concept),
            syllabus: data.syllabus ? new mongoose.Types.ObjectId(data.syllabus) : undefined,
            level: data.level,
            reflection: data.reflection,
            evaluatedAt: data.evaluatedAt || new Date()
        });
    }

    /**
     * Find evaluation by student and concept
     */
    async findByStudentAndConcept(studentId: string, conceptId: string) {
        await connectDB();
        return ConceptEvaluation.findOne({
            student: new mongoose.Types.ObjectId(studentId),
            concept: new mongoose.Types.ObjectId(conceptId)
        });
    }

    /**
     * Update an existing evaluation
     */
    async update(evaluation: IConceptEvaluation, data: {
        level: string;
        reflection?: string;
        evaluatedAt?: Date;
    }): Promise<IConceptEvaluation> {
        await connectDB();
        evaluation.level = data.level;
        if (data.reflection !== undefined) {
            evaluation.reflection = data.reflection;
        }
        evaluation.evaluatedAt = data.evaluatedAt || new Date();
        return evaluation.save();
    }

    /**
     * Find evaluations by student and syllabus
     */
    async findByStudentAndSyllabus(studentId: string, syllabusId: string) {
        await connectDB();
        return ConceptEvaluation.find({
            student: new mongoose.Types.ObjectId(studentId),
            syllabus: new mongoose.Types.ObjectId(syllabusId)
        })
            .populate('concept', 'title')
            .sort({ evaluatedAt: -1 })
            .lean();
    }

    /**
     * Find all evaluations by student (optionally filtered by syllabus)
     */
    async findByStudent(studentId: string, syllabusId?: string) {
        await connectDB();
        const query: Record<string, unknown> = {
            student: new mongoose.Types.ObjectId(studentId)
        };
        
        if (syllabusId) {
            query.syllabus = new mongoose.Types.ObjectId(syllabusId);
        }

        return ConceptEvaluation.find(query)
            .populate('concept', 'title name description')
            .sort({ evaluatedAt: -1 })
            .lean();
    }
}
