import Class from "@/models/Class";
import Syllabus from "@/models/Syllabus";
import Exam from "@/models/Exam";
import Attempt from "@/models/Attempt";
import Concept from "@/models/Concept";
import ConceptEvaluation from "@/models/ConceptEvaluation";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export class StudentRepository {
    /**
     * Find all active classes where student is enrolled
     */
    async findStudentClasses(studentId: string) {
        await connectDB();
        return Class.find({
            students: new mongoose.Types.ObjectId(studentId),
            isActive: true
        }).lean();
    }

    /**
     * Find syllabi for given class IDs
     */
    async findSyllabiByClasses(classIds: mongoose.Types.ObjectId[]) {
        await connectDB();
        return Syllabus.find({
            classes: { $in: classIds }
        }).populate('subject').lean();
    }

    /**
     * Find published exams for a subject
     */
    async findPublishedExamsBySubject(subjectId: string) {
        await connectDB();
        return Exam.find({
            subject: subjectId,
            isPublished: true
        }).lean();
    }

    /**
     * Find completed attempts for a student on given exams
     */
    async findCompletedAttempts(studentId: string, examIds: mongoose.Types.ObjectId[]) {
        await connectDB();
        return Attempt.find({
            userId: new mongoose.Types.ObjectId(studentId),
            examId: { $in: examIds },
            status: 'COMPLETED'
        }).lean();
    }

    /**
     * Find concepts for given syllabi
     */
    async findConceptsBySyllabi(syllabusIds: mongoose.Types.ObjectId[]) {
        await connectDB();
        return Concept.find({
            syllabus: { $in: syllabusIds }
        }).lean();
    }

    /**
     * Find concept evaluations for a student on given syllabi
     */
    async findConceptEvaluations(studentId: string, syllabusIds: mongoose.Types.ObjectId[]) {
        await connectDB();
        return ConceptEvaluation.find({
            student: new mongoose.Types.ObjectId(studentId),
            syllabus: { $in: syllabusIds }
        }).lean();
    }

    /**
     * Find syllabi by teachers (Fallback)
     */
    async findSyllabiByTeachers(teacherIds: mongoose.Types.ObjectId[], schoolId?: mongoose.Types.ObjectId) {
        await connectDB();
        const query: any = {
            teacher: { $in: teacherIds },
            status: 'ACTIVE'
        };
        if (schoolId) {
            query.school = schoolId;
        }
        return Syllabus.find(query).populate('subject').lean();
    }
}
