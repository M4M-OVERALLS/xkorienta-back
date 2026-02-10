export type SpecialtySkillDTO = {
    skill_id: string
    name: string
    skill_type: string
}

export type SpecialtyCareerOutcomeDTO = {
    outcome_id: string
    name: string
    sector: string
    average_salary?: number
    demand?: 'high' | 'medium' | 'low' | string
}

export type SpecialtySchoolOfferingDTO = {
    school_id: string
    school_name: string
    tuition_fee?: {
        min: number
        max: number
        currency: string
    }
}

export type SpecialtySalaryRangeDTO = {
    min: number
    max: number
    currency: string
}

export type SpecialtyDTO = {
    _id: string
    specialty_id: string
    domain: string
    field: string
    specialty_name: string
    level: string
    degree_awarded: string
    duration_years: number
    language: string[]
    mode: string
    prerequisites?: string[]
    general_objective?: string
    specific_objectives?: string[]
    value_proposition?: string
    exit_profile?: string
    created_at: string
    skills: SpecialtySkillDTO[]
    career_outcomes: SpecialtyCareerOutcomeDTO[]
    schools_offering: SpecialtySchoolOfferingDTO[]
    average_salary?: SpecialtySalaryRangeDTO
    employment_rate?: number
    popularity_score?: number
}
