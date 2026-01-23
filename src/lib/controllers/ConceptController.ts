import { NextResponse } from "next/server";
import { ConceptEvaluationService } from "@/lib/services/ConceptEvaluationService";

export class ConceptController {
    /**
     * POST /api/syllabus/concepts/evaluate
     * Submit a concept self-evaluation
     */
    static async evaluateConcept(req: Request, studentId: string) {
        try {
            const data = await req.json();
            const { conceptId, syllabusId, level, reflection } = data;

            // Validate required fields
            if (!conceptId || !syllabusId || !level) {
                return NextResponse.json(
                    { success: false, message: "Missing required fields: conceptId, syllabusId, and level are required" },
                    { status: 400 }
                );
            }

            const evaluation = await ConceptEvaluationService.createEvaluation(studentId, {
                conceptId,
                syllabusId,
                level,
                reflection
            });

            return NextResponse.json({ success: true, data: evaluation }, { status: 201 });
        } catch (error: any) {
            console.error("[Concept Controller] Evaluate Concept Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}
