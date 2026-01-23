import { NextResponse } from "next/server";
import { EducationStructureService } from "@/lib/services/EducationStructureService";
import { SubSystem, Cycle } from "@/models/enums";
import mongoose from "mongoose";

export class EducationStructureController {
    static async getEducationLevels(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const filters: any = {};

            if (searchParams.get('subSystem')) {
                filters.subSystem = searchParams.get('subSystem') as SubSystem;
            }
            if (searchParams.get('cycle')) {
                filters.cycle = searchParams.get('cycle') as Cycle;
            }
            if (searchParams.get('isActive')) {
                filters.isActive = searchParams.get('isActive') === 'true';
            }

            const levels = await EducationStructureService.getEducationLevels(filters);

            return NextResponse.json({
                success: true,
                count: levels.length,
                data: levels
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Get Levels Error:", error);
            return NextResponse.json(
                { success: false, message: "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getFields(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const filters: any = {};

            if (searchParams.get('level')) {
                const levelParam = searchParams.get('level');
                if (levelParam?.includes(',')) {
                    filters.level = levelParam.split(',');
                } else {
                    filters.level = levelParam;
                }
            }
            if (searchParams.get('cycle')) {
                filters.cycle = searchParams.get('cycle') as Cycle;
            }
            if (searchParams.get('category')) {
                filters.category = searchParams.get('category');
            }
            if (searchParams.get('isActive')) {
                filters.isActive = searchParams.get('isActive') === 'true';
            }
            if (searchParams.get('parentField')) {
                filters.parentField = searchParams.get('parentField');
            }

            const fields = await EducationStructureService.getFields(filters);

            return NextResponse.json({
                success: true,
                count: fields.length,
                data: fields
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Get Fields Error:", error);
            return NextResponse.json(
                { success: false, message: "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getFieldById(id: string) {
        try {
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return NextResponse.json(
                    { success: false, message: "Invalid field ID" },
                    { status: 400 }
                );
            }

            const field = await EducationStructureService.getFieldById(id);

            if (!field) {
                return NextResponse.json(
                    { success: false, message: "Field not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                data: field
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Get Field By ID Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async createField(req: Request, userId: string) {
        try {
            const body = await req.json();
            // TODO: Add Zod validation for body
            const field = await EducationStructureService.createField(body, userId);

            return NextResponse.json({
                success: true,
                data: field
            }, { status: 201 });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Create Field Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async updateField(req: Request, id: string, userId: string) {
        try {
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return NextResponse.json(
                    { success: false, message: "Invalid field ID" },
                    { status: 400 }
                );
            }

            const body = await req.json();
            // TODO: Add Zod validation for body
            const updatedField = await EducationStructureService.updateField(id, body, userId);

            if (!updatedField) {
                return NextResponse.json(
                    { success: false, message: "Field not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                data: updatedField
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Update Field Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async deleteField(id: string, userId: string) {
        try {
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return NextResponse.json(
                    { success: false, message: "Invalid field ID" },
                    { status: 400 }
                );
            }

            const deletedField = await EducationStructureService.deleteField(id, userId);

            if (!deletedField) {
                return NextResponse.json(
                    { success: false, message: "Field not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                message: "Field soft-deleted successfully"
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Delete Field Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getSubjectById(req: Request, subjectId: string) {
        try {
            const subject = await EducationStructureService.getSubjectById(subjectId);

            if (!subject) {
                return NextResponse.json(
                    { success: false, message: "Subject not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                data: subject
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Get Subject By ID Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getLearningUnits(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const filters: any = {};

            if (searchParams.get('subject')) {
                filters.subject = searchParams.get('subject');
            }
            if (searchParams.has('parentUnit')) {
                const parentUnit = searchParams.get('parentUnit');
                filters.parentUnit = parentUnit === 'null' ? null : parentUnit;
            }
            if (searchParams.get('unitType')) {
                filters.unitType = searchParams.get('unitType');
            }
            if (searchParams.get('isActive')) {
                filters.isActive = searchParams.get('isActive') === 'true';
            }

            const units = await EducationStructureService.getLearningUnits(filters);

            return NextResponse.json({
                success: true,
                count: units.length,
                data: units
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Get Learning Units Error:", error);
            return NextResponse.json(
                { success: false, message: "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async getLearningUnitById(learningUnitId: string) {
        try {
            if (!learningUnitId || learningUnitId === 'undefined' || !mongoose.Types.ObjectId.isValid(learningUnitId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid learning unit ID" },
                    { status: 400 }
                );
            }

            const unit = await EducationStructureService.getLearningUnitById(learningUnitId);

            if (!unit) {
                return NextResponse.json(
                    { success: false, message: "Learning unit not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                data: unit
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Get Learning Unit By ID Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async createLearningUnit(req: Request) {
        try {
            const body = await req.json();
            const unit = await EducationStructureService.createLearningUnit(body);

            return NextResponse.json({
                success: true,
                data: unit
            }, { status: 201 });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Create Learning Unit Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async updateLearningUnit(req: Request, learningUnitId: string) {
        try {
            if (!learningUnitId || learningUnitId === 'undefined' || !mongoose.Types.ObjectId.isValid(learningUnitId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid learning unit ID" },
                    { status: 400 }
                );
            }

            const body = await req.json();
            const unit = await EducationStructureService.updateLearningUnit(learningUnitId, body);

            if (!unit) {
                return NextResponse.json(
                    { success: false, message: "Learning unit not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                data: unit
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Update Learning Unit Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }

    static async deleteLearningUnit(learningUnitId: string) {
        try {
            if (!learningUnitId || learningUnitId === 'undefined' || !mongoose.Types.ObjectId.isValid(learningUnitId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid learning unit ID" },
                    { status: 400 }
                );
            }

            const unit = await EducationStructureService.deleteLearningUnit(learningUnitId);

            if (!unit) {
                return NextResponse.json(
                    { success: false, message: "Learning unit not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                message: "Learning unit deleted successfully"
            });
        } catch (error: any) {
            console.error("[EducationStructure Controller] Delete Learning Unit Error:", error);
            return NextResponse.json(
                { success: false, message: error.message || "Internal server error" },
                { status: 500 }
            );
        }
    }
}
