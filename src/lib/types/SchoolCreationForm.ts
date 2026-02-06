export type SchoolCreationPartner = {
    name: string
    sector?: string
    type?: string
    proof?: string
    country?: string
    website?: string
}

export type SchoolCreationForm = {
    identity: {
        name: string
        acronym?: string
        type: string
        city?: string
        department?: string
        region?: string
        country?: string
        address?: string
        website?: string
        contactEmail?: string
        contactPhone?: string
    }
    training?: {
        dominantFields?: string[]
        dominantSpecialties?: string[]
        specialtiesOffered?: string[]
        diplomas?: string[]
        teachingLanguages?: string[]
        modalities?: string
    }
    legal?: {
        accreditationNumber?: string
        openingAuthorization?: string
        authorizationDate?: string
        mainSupervision?: string
        secondarySupervisions?: string[]
        verificationDocs?: string[]
        foreignDiplomasNoAccreditation?: string
        foreignDiplomasWithAccreditation?: string
        status?: string
    }
    performance?: {
        foundedYear?: string
        yearsOfExistence?: string
        successRates?: string
        officialRanking?: string
        accreditations?: string
    }
    insertion?: {
        localPartners?: SchoolCreationPartner[]
        internationalPartners?: SchoolCreationPartner[]
        internshipAgreements?: string
        internshipAgreementCount?: string
        alumniTracking?: string
        alumniExamples?: string
        topRecruiters?: string[]
        insertionRate6?: string
        insertionRate12?: string
    }
    infrastructure?: {
        campusCompliant?: string
        libraryResources?: string
        libraryQuality?: string
        labs?: string
        labEquipment?: string
        itPark?: string
        itParkVolume?: string
        internetQuality?: string
        accessibility?: string
        safetyNotes?: string
    }
    financial?: {
        annualCost?: string
        feeRegistration?: string
        feeTuition?: string
        feeExams?: string
        feeMaterials?: string
        otherFees?: string
        scholarships?: string
        cityCostOfLiving?: string
    }
    studentExperience?: {
        clubs?: string
        mentoring?: string
        satisfactionRate?: string
        mobility?: string
        discipline?: string
    }
    score?: {
        legality?: string
        performance?: string
        insertion?: string
        infrastructures?: string
        affordability?: string
        global?: string
    }
}
