import mongoose from "mongoose"
import connectDB from "@/lib/mongodb"
import Specialty from "@/models/Specialty"
import SpecialtySkill from "@/models/SpecialtySkill"
import SpecialtyOutcome from "@/models/SpecialtyOutcome"
import SpecialtyScore from "@/models/SpecialtyScore"
import SchoolProgram from "@/models/SchoolProgram"
// Ces imports forcent l'enregistrement des modèles référencés par populate()
import "@/models/Skill"
import "@/models/CareerOutcome"
import "@/models/School"

export class SpecialtyRepository {
    async findById(id: string) {
        await connectDB()
        return Specialty.findById(id)
    }

    async findAllSpecialties() {
        await connectDB()
        return Specialty.find({}).lean()
    }

    async findSkillLinksBySpecialtyIds(ids: mongoose.Types.ObjectId[]) {
        await connectDB()
        return SpecialtySkill.find({ specialty: { $in: ids } })
            .populate({ path: "skill", select: "name skillType", options: { strictPopulate: false } })
            .lean()
    }

    async findOutcomeLinksBySpecialtyIds(ids: mongoose.Types.ObjectId[]) {
        await connectDB()
        return SpecialtyOutcome.find({ specialty: { $in: ids } })
            .populate({ path: "outcome", select: "name sector", options: { strictPopulate: false } })
            .lean()
    }

    async findProgramsBySpecialtyIds(ids: mongoose.Types.ObjectId[]) {
        await connectDB()
        return SchoolProgram.find({ specialty: { $in: ids } })
            .populate({ path: "school", select: "name", options: { strictPopulate: false } })
            .lean()
    }

    async findScoresBySpecialtyIds(ids: mongoose.Types.ObjectId[]) {
        await connectDB()
        return SpecialtyScore.find({ specialty: { $in: ids } }).lean()
    }
}
