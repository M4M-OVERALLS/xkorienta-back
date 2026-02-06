import mongoose from "mongoose"
import connectDB from "@/lib/mongodb"
import School, { SchoolType } from "@/models/School"
import SchoolProfile from "@/models/SchoolProfile"
import RegulatoryApproval, { ApprovalStatus } from "@/models/RegulatoryApproval"
import SchoolScore from "@/models/SchoolScore"
import InfrastructureMetric, { InternetQuality } from "@/models/InfrastructureMetric"
import Partner, { PartnerType } from "@/models/Partner"
import City from "@/models/City"
import Department from "@/models/Department"
import Region from "@/models/Region"
import Country from "@/models/Country"
import User from "@/models/User"
import { SchoolCreationForm } from "@/lib/types/SchoolCreationForm"
import { LanguageStatus, ModalityStatus } from "@/models/enums"

type CreatedSchoolPayload = {
    school: unknown
    profile: unknown
    regulatoryApproval?: unknown
    score?: unknown
    infrastructureMetric?: unknown
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const parseNumber = (value?: string) => {
    if (value === undefined || value === null || value === "") return undefined
    const normalized = String(value).replace(",", ".").replace(/[%\s]/g, "")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
}

const parseScore = (value?: string) => {
    const parsed = parseNumber(value)
    if (parsed === undefined) return undefined
    return Math.max(0, Math.min(100, parsed))
}

const parseBoolean = (value?: string) => {
    if (!value) return undefined
    const normalized = value.trim().toLowerCase()
    if (["oui", "yes", "true", "1"].includes(normalized)) return true
    if (["non", "no", "false", "0"].includes(normalized)) return false
    return undefined
}

const normalizeLabel = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")

const mapSchoolType = (value?: string) => {
    if (!value) return SchoolType.OTHER
    const match = Object.values(SchoolType).find((item) => item === value)
    return match || SchoolType.OTHER
}

const mapApprovalStatus = (value?: string) => {
    if (!value) return ApprovalStatus.NOT_ISSUED
    const normalized = value.trim().toLowerCase()
    if (normalized.includes("conforme") || normalized.includes("issued")) {
        return ApprovalStatus.ISSUED
    }
    if (normalized.includes("expired") || normalized.includes("expire")) {
        return ApprovalStatus.EXPIRED
    }
    return ApprovalStatus.NOT_ISSUED
}

const mapInternetQuality = (value?: string) => {
    if (!value) return undefined
    const normalized = value.trim().toLowerCase()
    if (["low", "faible", "bas"].includes(normalized)) return InternetQuality.LOW
    if (["medium", "moyen", "moyenne"].includes(normalized)) return InternetQuality.MEDIUM
    if (["high", "fort", "forte", "eleve", "elevee"].includes(normalized)) return InternetQuality.HIGH
    return undefined
}

const mapModality = (value?: string) => {
    if (!value) return undefined
    const normalized = normalizeLabel(value)
    if (normalized.includes("hybride") || normalized.includes("hybrid")) return ModalityStatus.HYBRIDE
    if (normalized.includes("distance") || normalized.includes("online")) return ModalityStatus.DISTANCE
    if (normalized.includes("presentiel") || normalized.includes("onsite")) return ModalityStatus.PRESENTIEL
    return undefined
}

const mapLanguage = (value?: string) => {
    if (!value) return undefined
    const normalized = normalizeLabel(value)
    if (normalized.includes("francais")) return LanguageStatus.FRANCAIS
    if (normalized.includes("anglais")) return LanguageStatus.ANGLAIS
    if (normalized.includes("chinois")) return LanguageStatus.CHINOIS
    if (normalized.includes("allemand")) return LanguageStatus.ALLEMAND
    if (normalized.includes("espagnol")) return LanguageStatus.ESPAGNOL
    return undefined
}

const resolveObjectId = async (value?: string, model?: mongoose.Model<any>) => {
    if (!value) return undefined
    if (mongoose.Types.ObjectId.isValid(value)) {
        return new mongoose.Types.ObjectId(value)
    }
    if (!model) return undefined
    const doc = await model.findOne({ name: new RegExp(`^${escapeRegex(value)}$`, "i") }).select("_id").lean()
    return doc?._id as mongoose.Types.ObjectId | undefined
}

export class SchoolCreationRepository {
    async createSchoolFromForm(form: SchoolCreationForm, ownerId: string): Promise<CreatedSchoolPayload> {
        await connectDB()

        // Validate ownerId
        if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
            throw new Error("Invalid owner ID")
        }

        const ownerObjectId = new mongoose.Types.ObjectId(ownerId)

        let createdSchool: any
        let createdProfile: any
        let createdApproval: any
        let createdScore: any
        let createdInfrastructure: any

        // Helper to create partner entries (without session for standalone MongoDB)
        const mapPartnerEntry = async (entry: { name?: string; sector?: string; country?: string; website?: string }, partnerType: PartnerType) => {
            if (!entry?.name || !entry?.sector) {
                return undefined
            }
            const existing = await Partner.findOne({
                name: new RegExp(`^${escapeRegex(entry.name)}$`, "i"),
                partnerType
            })
                .select("_id")
                .lean()

            if (existing?._id) {
                return existing._id as mongoose.Types.ObjectId
            }

            const partnerCountryId = await resolveObjectId(entry.country, Country)
            const created = await Partner.create({
                name: entry.name,
                sector: entry.sector,
                partnerType,
                country: partnerCountryId,
                website: entry.website
            })

            return created?._id as mongoose.Types.ObjectId | undefined
        }

        try {
            const identity = form.identity
            const schoolType = mapSchoolType(identity.type)
            const modality = mapModality(form.training?.modalities)
            const languages = (form.training?.teachingLanguages || [])
                .map((language) => mapLanguage(language))
                .filter(Boolean) as LanguageStatus[]

            const [cityId, departmentId, regionId, countryId] = await Promise.all([
                resolveObjectId(identity.city, City),
                resolveObjectId(identity.department, Department),
                resolveObjectId(identity.region, Region),
                resolveObjectId(identity.country, Country)
            ])

            const foundedYear = parseNumber(form.performance?.foundedYear)

            // Process partners
            const localPartnerIds = await Promise.all(
                (form.insertion?.localPartners || []).map((entry) => mapPartnerEntry(entry, PartnerType.LOCAL))
            )
            const internationalPartnerIds = await Promise.all(
                (form.insertion?.internationalPartners || []).map((entry) => mapPartnerEntry(entry, PartnerType.INTERNATIONAL))
            )
            const partnerIds = [...localPartnerIds, ...internationalPartnerIds].filter(Boolean) as mongoose.Types.ObjectId[]
            const uniquePartnerIds = Array.from(
                new Map(partnerIds.map((id) => [id.toString(), id])).values()
            )

            // 1. Create the School
            createdSchool = await School.create({
                name: identity.name,
                acronym: identity.acronym,
                type: schoolType,
                address: identity.address,
                city: cityId,
                department: departmentId,
                region: regionId,
                country: countryId,
                modality: modality,
                Languages: languages.length > 0 ? languages : undefined,
                partnerships: uniquePartnerIds.length > 0 ? uniquePartnerIds : undefined,
                contactInfo: {
                    email: identity.contactEmail,
                    phone: identity.contactPhone,
                    website: identity.website
                },
                foundedYear: foundedYear,
                owner: ownerObjectId,
                admins: [ownerObjectId],
                teachers: [ownerObjectId],
                applicants: []
            })

            // 2. Create the SchoolProfile
            const profilePayload = {
                school: createdSchool._id,
                identity: {
                    typeLabel: schoolType === SchoolType.OTHER ? identity.type : undefined,
                    cityName: identity.city,
                    departmentName: identity.department,
                    regionName: identity.region,
                    countryName: identity.country,
                    address: identity.address,
                    website: identity.website,
                    contactEmail: identity.contactEmail,
                    contactPhone: identity.contactPhone
                },
                training: form.training,
                performance: {
                    yearsOfExistence: form.performance?.yearsOfExistence,
                    successRates: form.performance?.successRates,
                    officialRanking: form.performance?.officialRanking,
                    accreditations: form.performance?.accreditations
                },
                insertion: form.insertion,
                infrastructure: form.infrastructure,
                financial: form.financial,
                studentExperience: form.studentExperience
            }

            createdProfile = await SchoolProfile.create(profilePayload)

            // 3. Create RegulatoryApproval if legal data is provided with accreditationNumber
            if (form.legal?.accreditationNumber) {
                const issuedById = await resolveObjectId(form.legal.mainSupervision, Partner)

                createdApproval = await RegulatoryApproval.create({
                    school: createdSchool._id,
                    approvalNumber: form.legal.accreditationNumber,
                    approvalStatus: mapApprovalStatus(form.legal.status),
                    approvalDate: form.legal.authorizationDate ? new Date(form.legal.authorizationDate) : undefined,
                    openingAuthorization: form.legal.openingAuthorization,
                    issuedBy: issuedById,
                    issuedByName: issuedById ? undefined : form.legal.mainSupervision,
                    secondarySupervisions: form.legal.secondarySupervisions,
                    documentsUrl: form.legal.verificationDocs?.[0],
                    verificationDocs: form.legal.verificationDocs,
                    foreignDiplomasNoAccreditation: form.legal.foreignDiplomasNoAccreditation,
                    foreignDiplomasWithAccreditation: form.legal.foreignDiplomasWithAccreditation
                })
            }

            // 4. Create SchoolScore if score data is provided
            if (form.score) {
                createdScore = await SchoolScore.create({
                    school: createdSchool._id,
                    legalScore: parseScore(form.score.legality) ?? 0,
                    academicScore: parseScore(form.score.performance) ?? 0,
                    employmentScore: parseScore(form.score.insertion) ?? 0,
                    infrastructureScore: parseScore(form.score.infrastructures) ?? 0,
                    affordabilityScore: parseScore(form.score.affordability) ?? 0,
                    globalScore: parseScore(form.score.global) ?? 0
                })
            }

            // 5. Create InfrastructureMetric if infrastructure data is provided
            const labsAvailable = parseBoolean(form.infrastructure?.labs)
            const accessibility = parseBoolean(form.infrastructure?.accessibility)
            const internetQuality = mapInternetQuality(form.infrastructure?.internetQuality)

            if (labsAvailable !== undefined || accessibility !== undefined || internetQuality !== undefined) {
                createdInfrastructure = await InfrastructureMetric.create({
                    school: createdSchool._id,
                    labsAvailable: labsAvailable ?? false,
                    internetQuality,
                    accessibilityDisability: accessibility ?? false
                })
            }

            // 6. Update the User to add the school to their schools array
            await User.findByIdAndUpdate(
                ownerObjectId,
                { $addToSet: { schools: createdSchool._id } }
            )

            return {
                school: createdSchool,
                profile: createdProfile,
                regulatoryApproval: createdApproval,
                score: createdScore,
                infrastructureMetric: createdInfrastructure
            }
        } catch (error) {
            // If school was created but subsequent operations failed, clean up
            if (createdSchool?._id) {
                console.error("[SchoolCreationRepository] Error during creation, attempting cleanup:", error)
                try {
                    await Promise.allSettled([
                        School.findByIdAndDelete(createdSchool._id),
                        SchoolProfile.deleteOne({ school: createdSchool._id }),
                        RegulatoryApproval.deleteOne({ school: createdSchool._id }),
                        SchoolScore.deleteOne({ school: createdSchool._id }),
                        InfrastructureMetric.deleteOne({ school: createdSchool._id })
                    ])
                } catch (cleanupError) {
                    console.error("[SchoolCreationRepository] Cleanup failed:", cleanupError)
                }
            }
            throw error
        }
    }
}
