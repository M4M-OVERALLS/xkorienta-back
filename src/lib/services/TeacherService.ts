import { TeacherRepository } from "@/lib/repositories/TeacherRepository";

export interface TeacherStudent {
    _id: string;
    name: string;
    email: string;
    image?: string;
    studentCode?: string;
    classes: Array<{
        _id: string;
        name: string;
    }>;
}

export interface ClassOption {
    _id: string;
    name: string;
    studentCount: number;
}

export interface TeacherStudentsResult {
    students: TeacherStudent[];
    classes: ClassOption[];
}

export class TeacherService {
    /**
     * Get all students from teacher's classes (for messaging)
     * Includes students from:
     * - Classes where teacher is mainTeacher
     * - Classes from teacher's syllabuses
     */
    static async getTeacherStudents(
        teacherId: string,
        search?: string,
        classId?: string
    ): Promise<TeacherStudentsResult> {
        const repo = new TeacherRepository();

        // 1. Get classes where teacher is mainTeacher
        const mainTeacherClassIds = await repo.findMainTeacherClassIds(teacherId);

        // 2. Get classes from teacher's syllabuses
        const syllabusClassIds = await repo.findSyllabusClassIds(teacherId);

        // 3. Combine and deduplicate
        const allClassIds = [...new Set([
            ...mainTeacherClassIds,
            ...syllabusClassIds
        ])];

        if (allClassIds.length === 0) {
            return { students: [], classes: [] };
        }

        // 4. Fetch classes with students
        const classes = await repo.findClassesWithStudents(allClassIds, classId);

        // 5. Build students list with class info
        const studentsMap = new Map<string, TeacherStudent>();

        for (const cls of classes) {
            const classStudents = (cls.students || []) as any[];
            for (const student of classStudents) {
                const studentId = student._id?.toString();
                if (!studentId) continue;

                // Apply search filter
                if (search) {
                    const searchLower = search.toLowerCase();
                    const matchName = student.name?.toLowerCase().includes(searchLower);
                    const matchEmail = student.email?.toLowerCase().includes(searchLower);
                    const matchCode = student.studentCode?.toLowerCase().includes(searchLower);
                    if (!matchName && !matchEmail && !matchCode) continue;
                }

                if (!studentsMap.has(studentId)) {
                    studentsMap.set(studentId, {
                        _id: studentId,
                        name: student.name,
                        email: student.email,
                        image: student.image,
                        studentCode: student.studentCode,
                        classes: []
                    });
                }

                studentsMap.get(studentId)!.classes.push({
                    _id: cls._id?.toString(),
                    name: cls.name
                });
            }
        }

        const students = Array.from(studentsMap.values());

        // 6. Build class options for filter dropdown
        const classOptions: ClassOption[] = classes.map(c => ({
            _id: c._id?.toString(),
            name: c.name,
            studentCount: ((c.students || []) as any[]).length
        }));

        return {
            students,
            classes: classOptions
        };
    }
}
