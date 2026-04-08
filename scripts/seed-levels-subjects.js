/**
 * Seed - Niveaux d'éducation & Matières (Système Camerounais)
 * Couvre : Primaire, Secondaire (Collège + Lycée), Universitaire
 * Sous-systèmes : FRANCOPHONE & ANGLOPHONE
 */
const mongoose = require('mongoose')
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/xkorienta'

const SubSystem = Object.freeze({
  FRANCOPHONE: "FRANCOPHONE",
  ANGLOPHONE: "ANGLOPHONE",
  BILINGUAL: "BILINGUAL",
});

const SchoolType = Object.freeze({
  PRESCHOOL: "PRESCHOOL",
  PRIMARY: "PRIMARY",
  SECONDARY_GENERAL: "SECONDARY_GENERAL",
  SECONDARY_TECHNICAL: "SECONDARY_TECHNICAL",
  TEACHER_TRAINING: "TEACHER_TRAINING",
  HIGHER_ED: "HIGHER_ED",
  NON_FORMAL: "NON_FORMAL",
});

const Cycle = Object.freeze({
  PRESCOLAIRE: "PRESCOLAIRE",
  PRIMAIRE: "PRIMAIRE",
  SECONDAIRE_PREMIER_CYCLE: "SECONDAIRE_PREMIER_CYCLE",
  SECONDAIRE_SECOND_CYCLE: "SECONDAIRE_SECOND_CYCLE",
  TECHNIQUE_PREMIER_CYCLE: "TECHNIQUE_PREMIER_CYCLE",
  TECHNIQUE_SECOND_CYCLE: "TECHNIQUE_SECOND_CYCLE",
  NORMAL: "NORMAL",
  BTS_HND: "BTS_HND",
  LICENCE: "LICENCE",
  MASTER: "MASTER",
  DOCTORAT: "DOCTORAT",
  ALPHABETISATION: "ALPHABETISATION",
  EDUCATION_NON_FORMELLE: "EDUCATION_NON_FORMELLE",
});

const FieldCategory = Object.freeze({
  SERIE: "SERIE",
  SPECIALITY: "SPECIALITY",
  FAMILY: "FAMILY",
});

const SubjectType = Object.freeze({
  DISCIPLINE: "DISCIPLINE",
  UE: "UE",
  MODULE: "MODULE",
});

const StageFilter = Object.freeze({
  PRESCO_FR: "PRESCO_FR",
  PRESCO_EN: "PRESCO_EN",
  PRIMAIRE_FR: "PRIMAIRE_FR",
  PRIMAIRE_EN: "PRIMAIRE_EN",

  SEC_GEN_1_FR: "SEC_GEN_1_FR",
  SEC_GEN_2_FR: "SEC_GEN_2_FR",
  SEC_GEN_1_EN: "SEC_GEN_1_EN",
  SEC_GEN_2_EN: "SEC_GEN_2_EN",

  TECH_1_FR: "TECH_1_FR",
  TECH_2_FR: "TECH_2_FR",
  TECH_1_EN: "TECH_1_EN",
  TECH_2_EN: "TECH_2_EN",

  NORMAL_FR: "NORMAL_FR",
  NORMAL_EN: "NORMAL_EN",

  BTS_HND: "BTS_HND",
  LICENCE: "LICENCE",
  MASTER: "MASTER",
  DOCTORAT: "DOCTORAT",

  ALPHA_NON_FORMAL: "ALPHA_NON_FORMAL",
});

// --- SCHEMAS (minimal, pour le seed) ---
const EducationLevelSchema = new mongoose.Schema({
    name: String, code: { type: String, unique: true }, cycle: String, schoolType: String,
    subSystem: String, order: Number, isActive: { type: Boolean, default: true },
    metadata: { displayName: { fr: String, en: String }, description: String }
}, { timestamps: true })

const SubjectSchema = new mongoose.Schema({
    name: String, code: { type: String, unique: true }, subSystem: String,
    applicableLevels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EducationLevel' }],
    applicableFields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }],
    isTransversal: { type: Boolean, default: false },
    subjectType: String, isActive: { type: Boolean, default: true },
    metadata: { displayName: { fr: String, en: String }, description: String, icon: String, color: String, coefficient: Number },
    _cachedExamCount: { type: Number, default: 0 }, _cachedLearningUnitCount: { type: Number, default: 0 }
}, { timestamps: true })

const FieldSchema = new mongoose.Schema({
    name: String, code: { type: String, unique: true }, category: String, cycle: String,
    subSystem: String, applicableLevels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EducationLevel' }],
    isActive: { type: Boolean, default: true },
    metadata: { displayName: { fr: String, en: String }, description: String, icon: String, color: String },
    _cachedSubjectCount: { type: Number, default: 0 }
}, { timestamps: true })

const EducationLevel = mongoose.models.EducationLevel || mongoose.model('EducationLevel', EducationLevelSchema)
const Subject = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema)
const Field = mongoose.models.Field || mongoose.model('Field', FieldSchema)

// ============================================================
// NIVEAUX D'ÉDUCATION
// ============================================================
const educationLevels = [
  // ----------------------------
  // PRESCOLAIRE FRANCOPHONE
  // ----------------------------
  {
    name: "Petite Section",
    code: "PS_FR",
    cycle: Cycle.PRESCOLAIRE,
    schoolType: SchoolType.PRESCHOOL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRESCO_FR,
    order: 1,
    metadata: { displayName: { fr: "Petite Section", en: "Petite Section" } },
  },
  {
    name: "Moyenne Section",
    code: "MS_FR",
    cycle: Cycle.PRESCOLAIRE,
    schoolType: SchoolType.PRESCHOOL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRESCO_FR,
    order: 2,
    metadata: { displayName: { fr: "Moyenne Section", en: "Moyenne Section" } },
  },
  {
    name: "Grande Section",
    code: "GS_FR",
    cycle: Cycle.PRESCOLAIRE,
    schoolType: SchoolType.PRESCHOOL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRESCO_FR,
    order: 3,
    metadata: { displayName: { fr: "Grande Section", en: "Grande Section" } },
  },

  // ----------------------------
  // PRESCOLAIRE ANGLOPHONE
  // ----------------------------
  {
    name: "Nursery 1",
    code: "NUR1_EN",
    cycle: Cycle.PRESCOLAIRE,
    schoolType: SchoolType.PRESCHOOL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRESCO_EN,
    order: 1,
    metadata: { displayName: { fr: "Nursery 1", en: "Nursery 1" } },
  },
  {
    name: "Nursery 2",
    code: "NUR2_EN",
    cycle: Cycle.PRESCOLAIRE,
    schoolType: SchoolType.PRESCHOOL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRESCO_EN,
    order: 2,
    metadata: { displayName: { fr: "Nursery 2", en: "Nursery 2" } },
  },

  // ----------------------------
  // PRIMAIRE FRANCOPHONE
  // ----------------------------
  {
    name: "SIL",
    code: "SIL_FR",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRIMAIRE_FR,
    order: 1,
    metadata: { displayName: { fr: "SIL", en: "SIL" } },
  },
  {
    name: "CP",
    code: "CP_FR",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRIMAIRE_FR,
    order: 2,
    metadata: { displayName: { fr: "CP", en: "CP" } },
  },
  {
    name: "CE1",
    code: "CE1_FR",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRIMAIRE_FR,
    order: 3,
    metadata: { displayName: { fr: "CE1", en: "CE1" } },
  },
  {
    name: "CE2",
    code: "CE2_FR",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRIMAIRE_FR,
    order: 4,
    metadata: { displayName: { fr: "CE2", en: "CE2" } },
  },
  {
    name: "CM1",
    code: "CM1_FR",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRIMAIRE_FR,
    order: 5,
    metadata: { displayName: { fr: "CM1", en: "CM1" } },
  },
  {
    name: "CM2",
    code: "CM2_FR",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.PRIMAIRE_FR,
    order: 6,
    metadata: {
      displayName: { fr: "CM2", en: "CM2" },
      certification: "CEP",
    },
  },

  // ----------------------------
  // PRIMAIRE ANGLOPHONE
  // ----------------------------
  {
    name: "Class 1",
    code: "CLS1_EN",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRIMAIRE_EN,
    order: 1,
    metadata: { displayName: { fr: "Class 1", en: "Class 1" } },
  },
  {
    name: "Class 2",
    code: "CLS2_EN",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRIMAIRE_EN,
    order: 2,
    metadata: { displayName: { fr: "Class 2", en: "Class 2" } },
  },
  {
    name: "Class 3",
    code: "CLS3_EN",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRIMAIRE_EN,
    order: 3,
    metadata: { displayName: { fr: "Class 3", en: "Class 3" } },
  },
  {
    name: "Class 4",
    code: "CLS4_EN",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRIMAIRE_EN,
    order: 4,
    metadata: { displayName: { fr: "Class 4", en: "Class 4" } },
  },
  {
    name: "Class 5",
    code: "CLS5_EN",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRIMAIRE_EN,
    order: 5,
    metadata: { displayName: { fr: "Class 5", en: "Class 5" } },
  },
  {
    name: "Class 6",
    code: "CLS6_EN",
    cycle: Cycle.PRIMAIRE,
    schoolType: SchoolType.PRIMARY,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.PRIMAIRE_EN,
    order: 6,
    metadata: {
      displayName: { fr: "Class 6", en: "Class 6" },
      certification: "FSLC",
    },
  },

  // ----------------------------
  // SECONDAIRE GENERAL FRANCOPHONE - 1ER CYCLE
  // ----------------------------
  {
    name: "6ème",
    code: "6EME_FR",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_1_FR,
    order: 1,
    metadata: { displayName: { fr: "6ème", en: "6ème" } },
  },
  {
    name: "5ème",
    code: "5EME_FR",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_1_FR,
    order: 2,
    metadata: { displayName: { fr: "5ème", en: "5ème" } },
  },
  {
    name: "4ème",
    code: "4EME_FR",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_1_FR,
    order: 3,
    metadata: { displayName: { fr: "4ème", en: "4ème" } },
  },
  {
    name: "3ème",
    code: "3EME_FR",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_1_FR,
    order: 4,
    metadata: {
      displayName: { fr: "3ème", en: "3ème" },
      certification: "BEPC",
    },
  },

  // ----------------------------
  // SECONDAIRE GENERAL FRANCOPHONE - 2ND CYCLE
  // ----------------------------
  {
    name: "2nde",
    code: "2NDE_FR",
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    order: 1,
    metadata: { displayName: { fr: "Seconde", en: "Seconde" } },
  },
  {
    name: "1ère",
    code: "1ERE_FR",
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    order: 2,
    metadata: {
      displayName: { fr: "Première", en: "Première" },
      certification: "Probatoire",
    },
  },
  {
    name: "Terminale",
    code: "TLE_FR",
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    order: 3,
    metadata: {
      displayName: { fr: "Terminale", en: "Terminale" },
      certification: "Baccalauréat",
    },
  },

  // ----------------------------
  // SECONDAIRE GENERAL ANGLOPHONE - 1ER CYCLE
  // ----------------------------
  {
    name: "Form 1",
    code: "FORM1_EN",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_1_EN,
    order: 1,
    metadata: { displayName: { fr: "Form 1", en: "Form 1" } },
  },
  {
    name: "Form 2",
    code: "FORM2_EN",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_1_EN,
    order: 2,
    metadata: { displayName: { fr: "Form 2", en: "Form 2" } },
  },
  {
    name: "Form 3",
    code: "FORM3_EN",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_1_EN,
    order: 3,
    metadata: { displayName: { fr: "Form 3", en: "Form 3" } },
  },
  {
    name: "Form 4",
    code: "FORM4_EN",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_1_EN,
    order: 4,
    metadata: { displayName: { fr: "Form 4", en: "Form 4" } },
  },
  {
    name: "Form 5",
    code: "FORM5_EN",
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_1_EN,
    order: 5,
    metadata: {
      displayName: { fr: "Form 5", en: "Form 5" },
      certification: "GCE O/L",
    },
  },

  // ----------------------------
  // SECONDAIRE GENERAL ANGLOPHONE - 2ND CYCLE
  // ----------------------------
  {
    name: "Lower Sixth",
    code: "L6_EN",
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_2_EN,
    order: 1,
    metadata: { displayName: { fr: "Lower Sixth", en: "Lower Sixth" } },
  },
  {
    name: "Upper Sixth",
    code: "U6_EN",
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_GENERAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_2_EN,
    order: 2,
    metadata: {
      displayName: { fr: "Upper Sixth", en: "Upper Sixth" },
      certification: "GCE A/L",
    },
  },

  // ----------------------------
  // ENSEIGNEMENT TECHNIQUE & PROFESSIONNEL FRANCOPHONE
  // ----------------------------
  {
    name: "1ère Année Technique",
    code: "TECH1_FR",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_1_FR,
    order: 1,
    metadata: { displayName: { fr: "1ère Année Technique", en: "1st Technical Year" } },
  },
  {
    name: "2ème Année Technique",
    code: "TECH2_FR",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_1_FR,
    order: 2,
    metadata: { displayName: { fr: "2ème Année Technique", en: "2nd Technical Year" } },
  },
  {
    name: "3ème Année Technique",
    code: "TECH3_FR",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_1_FR,
    order: 3,
    metadata: { displayName: { fr: "3ème Année Technique", en: "3rd Technical Year" } },
  },
  {
    name: "4ème Année Technique",
    code: "TECH4_FR",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_1_FR,
    order: 4,
    metadata: {
      displayName: { fr: "4ème Année Technique", en: "4th Technical Year" },
      certification: "CAP",
    },
  },
  {
    name: "2nde Technique",
    code: "2NDE_TECH_FR",
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    order: 1,
    metadata: { displayName: { fr: "2nde Technique", en: "Seconde Technique" } },
  },
  {
    name: "1ère Technique",
    code: "1ERE_TECH_FR",
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    order: 2,
    metadata: { displayName: { fr: "1ère Technique", en: "Première Technique" } },
  },
  {
    name: "Terminale Technique",
    code: "TLE_TECH_FR",
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    order: 3,
    metadata: { displayName: { fr: "Terminale Technique", en: "Terminale Technique" } },
  },

  // ----------------------------
  // ENSEIGNEMENT TECHNIQUE & PROFESSIONNEL ANGLOPHONE
  // ----------------------------
  {
    name: "Technical Form 1",
    code: "TFORM1_EN",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_1_EN,
    order: 1,
    metadata: { displayName: { fr: "Technical Form 1", en: "Technical Form 1" } },
  },
  {
    name: "Technical Form 2",
    code: "TFORM2_EN",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_1_EN,
    order: 2,
    metadata: { displayName: { fr: "Technical Form 2", en: "Technical Form 2" } },
  },
  {
    name: "Technical Form 3",
    code: "TFORM3_EN",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_1_EN,
    order: 3,
    metadata: { displayName: { fr: "Technical Form 3", en: "Technical Form 3" } },
  },
  {
    name: "Technical Form 4",
    code: "TFORM4_EN",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_1_EN,
    order: 4,
    metadata: { displayName: { fr: "Technical Form 4", en: "Technical Form 4" } },
  },
  {
    name: "Technical Form 5",
    code: "TFORM5_EN",
    cycle: Cycle.TECHNIQUE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_1_EN,
    order: 5,
    metadata: { displayName: { fr: "Technical Form 5", en: "Technical Form 5" } },
  },
  {
    name: "Technical Lower Sixth",
    code: "TL6_EN",
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_2_EN,
    order: 1,
    metadata: { displayName: { fr: "Technical Lower Sixth", en: "Technical Lower Sixth" } },
  },
  {
    name: "Technical Upper Sixth",
    code: "TU6_EN",
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    schoolType: SchoolType.SECONDARY_TECHNICAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_2_EN,
    order: 2,
    metadata: { displayName: { fr: "Technical Upper Sixth", en: "Technical Upper Sixth" } },
  },

  // ----------------------------
  // ENSEIGNEMENT NORMAL
  // ----------------------------
  {
    name: "Normal Year 1 FR",
    code: "NORMAL1_FR",
    cycle: Cycle.NORMAL,
    schoolType: SchoolType.TEACHER_TRAINING,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.NORMAL_FR,
    order: 1,
    metadata: { displayName: { fr: "Année 1 Normal", en: "Normal Year 1" } },
  },
  {
    name: "Normal Year 2 FR",
    code: "NORMAL2_FR",
    cycle: Cycle.NORMAL,
    schoolType: SchoolType.TEACHER_TRAINING,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.NORMAL_FR,
    order: 2,
    metadata: { displayName: { fr: "Année 2 Normal", en: "Normal Year 2" } },
  },
  {
    name: "Normal Year 3 FR",
    code: "NORMAL3_FR",
    cycle: Cycle.NORMAL,
    schoolType: SchoolType.TEACHER_TRAINING,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.NORMAL_FR,
    order: 3,
    metadata: { displayName: { fr: "Année 3 Normal", en: "Normal Year 3" } },
  },
  {
    name: "Normal Year 1 EN",
    code: "NORMAL1_EN",
    cycle: Cycle.NORMAL,
    schoolType: SchoolType.TEACHER_TRAINING,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.NORMAL_EN,
    order: 1,
    metadata: { displayName: { fr: "Normal Year 1", en: "Normal Year 1" } },
  },
  {
    name: "Normal Year 2 EN",
    code: "NORMAL2_EN",
    cycle: Cycle.NORMAL,
    schoolType: SchoolType.TEACHER_TRAINING,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.NORMAL_EN,
    order: 2,
    metadata: { displayName: { fr: "Normal Year 2", en: "Normal Year 2" } },
  },
  {
    name: "Normal Year 3 EN",
    code: "NORMAL3_EN",
    cycle: Cycle.NORMAL,
    schoolType: SchoolType.TEACHER_TRAINING,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.NORMAL_EN,
    order: 3,
    metadata: { displayName: { fr: "Normal Year 3", en: "Normal Year 3" } },
  },

  // ----------------------------
  // SUPERIEUR - BTS / HND
  // ----------------------------
  {
    name: "BTS 1",
    code: "BTS1",
    cycle: Cycle.BTS_HND,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.BTS_HND,
    order: 1,
    metadata: { displayName: { fr: "BTS 1", en: "BTS Year 1" } },
  },
  {
    name: "BTS 2",
    code: "BTS2",
    cycle: Cycle.BTS_HND,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.BTS_HND,
    order: 2,
    metadata: { displayName: { fr: "BTS 2", en: "BTS Year 2" } },
  },
  {
    name: "HND 1",
    code: "HND1",
    cycle: Cycle.BTS_HND,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.BTS_HND,
    order: 1,
    metadata: { displayName: { fr: "HND 1", en: "HND Year 1" } },
  },
  {
    name: "HND 2",
    code: "HND2",
    cycle: Cycle.BTS_HND,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.BTS_HND,
    order: 2,
    metadata: { displayName: { fr: "HND 2", en: "HND Year 2" } },
  },

  // ----------------------------
  // SUPERIEUR - LMD
  // ----------------------------
  {
    name: "L1",
    code: "L1",
    cycle: Cycle.LICENCE,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    order: 1,
    metadata: { displayName: { fr: "Licence 1", en: "Level 1" } },
  },
  {
    name: "L2",
    code: "L2",
    cycle: Cycle.LICENCE,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    order: 2,
    metadata: { displayName: { fr: "Licence 2", en: "Level 2" } },
  },
  {
    name: "L3",
    code: "L3",
    cycle: Cycle.LICENCE,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    order: 3,
    metadata: { displayName: { fr: "Licence 3", en: "Level 3" } },
  },
  {
    name: "M1",
    code: "M1",
    cycle: Cycle.MASTER,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.MASTER,
    order: 1,
    metadata: { displayName: { fr: "Master 1", en: "Master 1" } },
  },
  {
    name: "M2",
    code: "M2",
    cycle: Cycle.MASTER,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.MASTER,
    order: 2,
    metadata: { displayName: { fr: "Master 2", en: "Master 2" } },
  },
  {
    name: "D1",
    code: "D1",
    cycle: Cycle.DOCTORAT,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.DOCTORAT,
    order: 1,
    metadata: { displayName: { fr: "Doctorat 1", en: "PhD Year 1" } },
  },
  {
    name: "D2",
    code: "D2",
    cycle: Cycle.DOCTORAT,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.DOCTORAT,
    order: 2,
    metadata: { displayName: { fr: "Doctorat 2", en: "PhD Year 2" } },
  },
  {
    name: "D3+",
    code: "D3_PLUS",
    cycle: Cycle.DOCTORAT,
    schoolType: SchoolType.HIGHER_ED,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.DOCTORAT,
    order: 3,
    metadata: { displayName: { fr: "Doctorat 3+", en: "PhD Year 3+" } },
  },

  // ----------------------------
  // ALPHABETISATION / NON FORMEL
  // ----------------------------
  {
    name: "Alphabétisation Niveau 1",
    code: "ALPHA1",
    cycle: Cycle.ALPHABETISATION,
    schoolType: SchoolType.NON_FORMAL,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.ALPHA_NON_FORMAL,
    order: 1,
    metadata: { displayName: { fr: "Alphabétisation Niveau 1", en: "Literacy Level 1" } },
  },
  {
    name: "Alphabétisation Niveau 2",
    code: "ALPHA2",
    cycle: Cycle.ALPHABETISATION,
    schoolType: SchoolType.NON_FORMAL,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.ALPHA_NON_FORMAL,
    order: 2,
    metadata: { displayName: { fr: "Alphabétisation Niveau 2", en: "Literacy Level 2" } },
  },
  {
    name: "Éducation Non Formelle Niveau 1",
    code: "ENF1",
    cycle: Cycle.EDUCATION_NON_FORMELLE,
    schoolType: SchoolType.NON_FORMAL,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.ALPHA_NON_FORMAL,
    order: 3,
    metadata: { displayName: { fr: "Éducation Non Formelle 1", en: "Non Formal Education 1" } },
  },
  {
    name: "Éducation Non Formelle Niveau 2",
    code: "ENF2",
    cycle: Cycle.EDUCATION_NON_FORMELLE,
    schoolType: SchoolType.NON_FORMAL,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.ALPHA_NON_FORMAL,
    order: 4,
    metadata: { displayName: { fr: "Éducation Non Formelle 2", en: "Non Formal Education 2" } },
  },
]

// ============================================================
// MATIÈRES / DISCIPLINES
// ============================================================
// Format: { name, code, subSystem, subjectType, cycle_filter, metadata, (isTransversal?) }
// cycle_filter: 'PRIMAIRE' | 'COLLEGE' | 'LYCEE' | 'COLLEGE_LYCEE' | 'SUPERIEUR' | 'ALL_FR' | 'ALL_EN'
const subjectsData = [

    // ========================
    // PRESCOLAIRE FRANCOPHONE
    // ========================
    { name: "Langage Oral", code: "LANG_ORAL_PRESCO_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_FR', metadata: { displayName: { fr: "Langage et Expression Orale", en: "Language & Oral Expression" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Pré-calcul", code: "PRE_CALC_PRESCO_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_FR', metadata: { displayName: { fr: "Activités Pré-mathématiques", en: "Pre-Math Activities" }, color: "#3b82f6", coefficient: 2 } },
    { name: "Motricité", code: "MOTR_PRESCO_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_FR', metadata: { displayName: { fr: "Éducation Motrice", en: "Motor Education" }, color: "#84cc16", coefficient: 2 } },
    { name: "Éveil Artistique", code: "ART_PRESCO_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_FR', metadata: { displayName: { fr: "Activités Artistiques", en: "Creative Arts" }, color: "#f43f5e", coefficient: 2 } },
    { name: "Socialisation", code: "SOC_PRESCO_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_FR', metadata: { displayName: { fr: "Socialisation et Vivre Ensemble", en: "Socialization" }, color: "#06b6d4", coefficient: 2 } },

    // ========================
    // PRESCOLAIRE ANGLOPHONE
    // ========================
    { name: "Language Skills", code: "LANG_PRESCO_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_EN', metadata: { displayName: { fr: "Compétences Langagières", en: "Language Skills" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Number Work", code: "NUM_PRESCO_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_EN', metadata: { displayName: { fr: "Activités Numériques", en: "Number Work" }, color: "#3b82f6", coefficient: 2 } },
    { name: "Psychomotor Activities", code: "PSYCH_PRESCO_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_EN', metadata: { displayName: { fr: "Activités Psychomotrices", en: "Psychomotor Activities" }, color: "#84cc16", coefficient: 2 } },
    { name: "Creative Activities", code: "CREAT_PRESCO_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_EN', metadata: { displayName: { fr: "Activités Créatives", en: "Creative Activities" }, color: "#f43f5e", coefficient: 2 } },
    { name: "Social Development", code: "SOC_DEV_PRESCO_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRESCO_EN', metadata: { displayName: { fr: "Développement Social", en: "Social Development" }, color: "#06b6d4", coefficient: 2 } },

    // ========================
    // PRIMAIRE FRANCOPHONE
    // ========================
    { name: "Calcul / Arithmétique",   code: "CAL_PRIM_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Calcul (Arithmétique)", en: "Arithmetic" }, color: "#3b82f6", coefficient: 3 } },
    { name: "Langage",                  code: "LAN_PRIM_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Langage", en: "Language" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Français (Lecture/Écriture)", code: "FRA_PRIM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Français (Lecture & Expression)", en: "French Literacy" }, color: "#ec4899", coefficient: 3 } },
    { name: "Sciences d'Éveil",         code: "SCI_PRIM_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Sciences d'Éveil (SNV)", en: "Environmental Science" }, color: "#22c55e", coefficient: 2 } },
    { name: "Histoire & Géographie (Primaire)", code: "HG_PRIM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Histoire & Géographie", en: "History & Geography" }, color: "#f59e0b", coefficient: 1 } },
    { name: "Éducation Civique et Morale (Primaire)", code: "ECM_PRIM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Éducation Civique et Morale", en: "Civic & Moral Education" }, color: "#06b6d4", coefficient: 1 } },
    { name: "Dessin / Arts Plastiques", code: "ART_PRIM_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Arts Plastiques & Travaux Manuels", en: "Arts & Crafts" }, color: "#f43f5e", coefficient: 1 } },
    { name: "Éducation Physique et Sportive (Primaire)", code: "EPS_PRIM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "EPS (Primaire)", en: "Physical Education (Primary)" }, color: "#84cc16", coefficient: 1 } },
    { name: "Anglais (Primaire Francophone)", code: "ANG_PRIM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Anglais (Langue 2)", en: "English (2nd Language)" }, color: "#6366f1", coefficient: 1 } },
    { name: "Religion / Éducation Religieuse (Primaire)", code: "REL_PRIM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_FR', metadata: { displayName: { fr: "Éducation Religieuse", en: "Religious Education (Primary)" }, color: "#d97706", coefficient: 1 } },

    // ========================
    // PRIMAIRE ANGLOPHONE
    // ========================
    { name: "Mathematics (Primary EN)", code: "MATH_PRIM_EN",  subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_EN', metadata: { displayName: { fr: "Mathématiques (Primaire AN)", en: "Mathematics (Primary)" }, color: "#3b82f6", coefficient: 3 } },
    { name: "English Language (Primary)", code: "ENG_PRIM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_EN', metadata: { displayName: { fr: "Langue Anglaise (Primaire)", en: "English Language (Primary)" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "General Science (Primary)", code: "SCI_PRIM_EN",  subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_EN', metadata: { displayName: { fr: "Sciences Générales (Primaire AN)", en: "General Science (Primary)" }, color: "#22c55e", coefficient: 2 } },
    { name: "Social Studies (Primary)",  code: "SS_PRIM_EN",   subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_EN', metadata: { displayName: { fr: "Études Sociales (Primaire AN)", en: "Social Studies (Primary)" }, color: "#f59e0b", coefficient: 1 } },
    { name: "Religious Studies (Primary EN)", code: "REL_PRIM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_EN', metadata: { displayName: { fr: "Éducation Religieuse (Primaire AN)", en: "Religious Studies (Primary)" }, color: "#d97706", coefficient: 1 } },
    { name: "French (Primary EN)",       code: "FRA_PRIM_EN",  subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'PRIMAIRE_EN', metadata: { displayName: { fr: "Français Langue 2 (Primaire AN)", en: "French (2nd Language)" }, color: "#ec4899", coefficient: 1 } },

    // ========================
    // COLLÈGE FRANCOPHONE (6ème → 3ème)
    // ========================
    { name: "Mathématiques (Collège)",  code: "MATH_COL_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Mathématiques", en: "Mathematics" }, color: "#3b82f6", coefficient: 4 } },
    { name: "Français (Collège)",       code: "FRA_COL_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Langue Française", en: "French Language" }, color: "#ec4899", coefficient: 4 } },
    { name: "Anglais (Collège)",        code: "ANG_COL_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Langue Anglaise", en: "English Language" }, color: "#6366f1", coefficient: 3 } },
    { name: "Sciences Naturelles / SVT (Collège)", code: "SVT_COL_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "SVT (Sciences de la Vie et de la Terre)", en: "Biology / Earth Sciences" }, color: "#22c55e", coefficient: 3 } },
    { name: "Physique-Chimie (Collège)", code: "PC_COL_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Sciences Physiques & Chimiques", en: "Physics & Chemistry" }, color: "#06b6d4", coefficient: 3 } },
    { name: "Histoire-Géographie (Collège)", code: "HG_COL_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Histoire-Géographie", en: "History-Geography" }, color: "#f59e0b", coefficient: 2 } },
    { name: "Éducation Civique (Collège)", code: "EDC_COL_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Éducation Civique & Morale", en: "Civic Education" }, color: "#f97316", coefficient: 1 } },
    { name: "Économie Familiale & Sociale", code: "EFS_COL_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Economie Familiale & Sociale (EFS)", en: "Home Economics" }, color: "#d946ef", coefficient: 2 } },
    { name: "Technologie (Collège)",    code: "TECH_COL_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Technologie", en: "Technology" }, color: "#64748b", coefficient: 2 } },
    { name: "Informatique (Collège)",   code: "INFO_COL_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Informatique", en: "Computer Science" }, color: "#14b8a6", coefficient: 2 } },
    { name: "Arts Plastiques (Collège)", code: "ART_COL_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Arts Plastiques", en: "Visual Arts" }, color: "#f43f5e", coefficient: 1 } },
    { name: "Musique (Collège)",        code: "MUS_COL_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Éducation Musicale", en: "Music" }, color: "#a855f7", coefficient: 1 } },
    { name: "EPS (Collège)",            code: "EPS_COL_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Éducation Physique et Sportive", en: "Physical Education" }, color: "#84cc16", coefficient: 1 } },
    { name: "Religion (Collège)",       code: "REL_COL_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Éducation Religieuse / Éthique", en: "Religious / Ethics Education" }, color: "#d97706", coefficient: 1 } },
    { name: "Latin (Collège)",          code: "LAT_COL_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Latin (optionnel)", en: "Latin (Optional)" }, color: "#a16207", coefficient: 1 } },
    { name: "Espagnol / Arabe (LV3 Collège)", code: "LV3_COL_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'COLLEGE_FR', metadata: { displayName: { fr: "Langue Vivante 3 (Espagnol / Arabe)", en: "3rd Modern Language" }, color: "#7c3aed", coefficient: 1 } },

    // ========================
    // LYCÉE FRANCOPHONE (2nde → Terminale)
    // ========================
    { name: "Mathématiques (Lycée)",    code: "MATH_LYC_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Mathématiques", en: "Mathematics" }, color: "#3b82f6", coefficient: 5 } },
    { name: "Français / Littérature (Lycée)", code: "FRA_LYC_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Français & Littérature", en: "French & Literature" }, color: "#ec4899", coefficient: 4 } },
    { name: "Anglais (Lycée)",          code: "ANG_LYC_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Anglais (LV1)", en: "English (LV1)" }, color: "#6366f1", coefficient: 3 } },
    { name: "Physique-Chimie (Lycée)",  code: "PC_LYC_FR",     subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Physique-Chimie", en: "Physics & Chemistry" }, color: "#06b6d4", coefficient: 5 } },
    { name: "SVT (Lycée)",              code: "SVT_LYC_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Sciences de la Vie et de la Terre (SVT)", en: "Biology & Earth Sciences" }, color: "#22c55e", coefficient: 4 } },
    { name: "Histoire-Géographie (Lycée)", code: "HG_LYC_FR",  subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Histoire-Géographie", en: "History-Geography" }, color: "#f59e0b", coefficient: 3 } },
    { name: "Philosophie",              code: "PHILO_LYC_FR",  subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Philosophie", en: "Philosophy" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Économie (Lycée)",         code: "ECO_LYC_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Économie Générale", en: "General Economics" }, color: "#fb923c", coefficient: 3 } },
    { name: "Comptabilité",             code: "COMPTA_LYC_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Comptabilité & Gestion", en: "Accounting" }, color: "#0ea5e9", coefficient: 3 } },
    { name: "Informatique (Lycée)",     code: "INFO_LYC_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Informatique / TIC", en: "Computer Science" }, color: "#14b8a6", coefficient: 2 } },
    { name: "Éducation Civique (Lycée)", code: "EDC_LYC_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Éducation Civique", en: "Civic Education" }, color: "#f97316", coefficient: 1 } },
    { name: "EPS (Lycée)",              code: "EPS_LYC_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Éducation Physique & Sportive", en: "Physical Education" }, color: "#84cc16", coefficient: 1 } },
    { name: "Espagnol / Arabe (Lycée)", code: "LV2_LYC_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Langue Vivante 2 (Espagnol / Allemand / Arabe)", en: "Modern Language LV2" }, color: "#7c3aed", coefficient: 2 } },
    { name: "Arts & Culture (Lycée)",   code: "ART_LYC_FR",    subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Arts Plastiques & Culture", en: "Arts & Culture" }, color: "#f43f5e", coefficient: 1 } },
    { name: "Chimie (Lycée)",           code: "CHIM_LYC_FR",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'LYCEE_FR', metadata: { displayName: { fr: "Chimie (approf. Série C)", en: "Chemistry" }, color: "#10b981", coefficient: 3 } },

    // ========================
    // SECONDAIRE ANGLOPHONE (Form 1 → Upper Sixth)
    // ========================
    { name: "Mathematics (Secondary EN)", code: "MATH_SEC_EN",  subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Mathématiques (Secondaire AN)", en: "Mathematics" }, color: "#3b82f6", coefficient: 5 } },
    { name: "English Language (Secondary)", code: "ENG_SEC_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Anglais (Secondaire AN)", en: "English Language" }, color: "#6366f1", coefficient: 4 } },
    { name: "French (Secondary EN)",    code: "FRA_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Français LV2 (Secondaire AN)", en: "French Language" }, color: "#ec4899", coefficient: 3 } },
    { name: "Physics (Secondary EN)",   code: "PHY_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Physique (Secondaire AN)", en: "Physics" }, color: "#06b6d4", coefficient: 4 } },
    { name: "Chemistry (Secondary EN)", code: "CHE_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Chimie (Secondaire AN)", en: "Chemistry" }, color: "#10b981", coefficient: 4 } },
    { name: "Biology (Secondary EN)",   code: "BIO_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Biologie (Secondaire AN)", en: "Biology" }, color: "#22c55e", coefficient: 4 } },
    { name: "Geography (Secondary EN)", code: "GEO_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Géographie (Secondaire AN)", en: "Geography" }, color: "#f59e0b", coefficient: 3 } },
    { name: "History (Secondary EN)",   code: "HIS_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Histoire (Secondaire AN)", en: "History" }, color: "#d97706", coefficient: 3 } },
    { name: "Economics (Secondary EN)", code: "ECO_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Economie (Secondaire AN)", en: "Economics" }, color: "#fb923c", coefficient: 3 } },
    { name: "Computer Science (Secondary EN)", code: "CS_SEC_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Informatique (Secondaire AN)", en: "Computer Science" }, color: "#14b8a6", coefficient: 2 } },
    { name: "Literature in English",    code: "LIT_SEC_EN",     subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Littérature en Anglais", en: "Literature in English" }, color: "#a855f7", coefficient: 3 } },
    { name: "Religious Studies (Secondary EN)", code: "REL_SEC_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "Études Religieuses (Secondaire AN)", en: "Religious Studies" }, color: "#d97706", coefficient: 1 } },
    { name: "P.E. (Secondary EN)",      code: "PE_SEC_EN",      subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'SEC_EN', metadata: { displayName: { fr: "EPS (Secondaire AN)", en: "Physical Education" }, color: "#84cc16", coefficient: 1 } },

    // ========================
    // UNIVERSITAIRE — INFORMATIQUE / GÉNIE LOGICIEL
    // ========================
    { name: "Algorithmique & Structures de Données", code: "ALGO_UNI",  subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Algorithmique & Structures de Données", en: "Algorithms & Data Structures" }, color: "#3b82f6", coefficient: 4 } },
    { name: "Bases de Données",         code: "DB_UNI",         subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Systèmes de Gestion de Bases de Données", en: "Database Systems" }, color: "#6366f1", coefficient: 4 } },
    { name: "Programmation Orientée Objet", code: "POO_UNI",   subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Programmation Orientée Objet (Java/C++)", en: "Object Oriented Programming" }, color: "#f59e0b", coefficient: 4 } },
    { name: "Développement Web",        code: "WEBDEV_UNI",     subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Développement Web (HTML/CSS/JS)", en: "Web Development" }, color: "#22c55e", coefficient: 3 } },
    { name: "Réseaux & Télécommunications", code: "NET_UNI",   subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Réseaux & Télécommunications", en: "Computer Networks" }, color: "#06b6d4", coefficient: 4 } },
    { name: "Architecture des Ordinateurs", code: "ARCHI_UNI", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Architecture des Ordinateurs", en: "Computer Architecture" }, color: "#64748b", coefficient: 3 } },
    { name: "Génie Logiciel",           code: "GL_UNI",         subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Génie Logiciel", en: "Software Engineering" }, color: "#8b5cf6", coefficient: 4 } },
    { name: "Intelligence Artificielle & ML", code: "AI_UNI",  subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "IA & Machine Learning", en: "AI & Machine Learning" }, color: "#ec4899", coefficient: 4 } },
    { name: "Cybersécurité",            code: "CYBER_UNI",      subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Cybersécurité", en: "Cybersecurity" }, color: "#ef4444", coefficient: 3 } },
    { name: "Systèmes d'Information",   code: "SI_UNI",         subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Systèmes d'Information", en: "Information Systems" }, color: "#14b8a6", coefficient: 3 } },
    { name: "Mathématiques Appliquées (Univ)", code: "MATH_UNI", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Mathématiques Appliquées", en: "Applied Mathematics" }, color: "#3b82f6", coefficient: 4 } },

    // ========================
    // UNIVERSITAIRE — ÉCONOMIE / GESTION
    // ========================
    { name: "Comptabilité Générale",    code: "COMPTA_UNI",     subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Comptabilité Générale", en: "Financial Accounting" }, color: "#0ea5e9", coefficient: 4 } },
    { name: "Marketing Fondamental",    code: "MKT_UNI",        subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Marketing Fondamental", en: "Marketing Fundamentals" }, color: "#f97316", coefficient: 3 } },
    { name: "Management des Organisations", code: "MGT_UNI",   subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Management des Organisations", en: "Management" }, color: "#fb923c", coefficient: 4 } },
    { name: "Droit des Sociétés",       code: "DROIT_UNI",      subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Droit des Sociétés & Droit Commercial", en: "Corporate Law" }, color: "#a16207", coefficient: 3 } },
    { name: "Finance d'Entreprise",     code: "FIN_UNI",        subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Finance d'Entreprise", en: "Corporate Finance" }, color: "#0ea5e9", coefficient: 4 } },
    { name: "Statistiques & Probabilités (Univ)", code: "STAT_UNI", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Statistiques & Probabilités", en: "Statistics & Probability" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Économétrie",              code: "ECON_UNI",       subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Économétrie", en: "Econometrics" }, color: "#d946ef", coefficient: 3 } },
    { name: "Macroéconomie",            code: "MACRO_UNI",      subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Macroéconomie", en: "Macroeconomics" }, color: "#fb923c", coefficient: 4 } },
    { name: "Microéconomie",            code: "MICRO_UNI",      subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Microéconomie", en: "Microeconomics" }, color: "#f59e0b", coefficient: 4 } },

    // ========================
    // UNIVERSITAIRE — SCIENCES / MÉDECINE
    // ========================
    { name: "Biochimie",                code: "BIOCH_UNI",      subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Biochimie", en: "Biochemistry" }, color: "#22c55e", coefficient: 4 } },
    { name: "Anatomie",                 code: "ANAT_UNI",       subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Anatomie Humaine", en: "Human Anatomy" }, color: "#ef4444", coefficient: 4 } },
    { name: "Physiologie",              code: "PHYS_UNI",       subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Physiologie Humaine", en: "Physiology" }, color: "#f43f5e", coefficient: 4 } },
    { name: "Pharmacologie",            code: "PHARMA_UNI",     subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Pharmacologie", en: "Pharmacology" }, color: "#10b981", coefficient: 4 } },
    { name: "Physique Générale (Univ)", code: "PHYGENE_UNI",    subSystem: SubSystem.BILINGUAL,   subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Physique Générale", en: "General Physics" }, color: "#06b6d4", coefficient: 4 } },
    { name: "Chimie Générale (Univ)",   code: "CHGENE_UNI",     subSystem: SubSystem.BILINGUAL,   subjectType: SubjectType.UE, cycle_filter: 'UNIV', metadata: { displayName: { fr: "Chimie Générale", en: "General Chemistry" }, color: "#14b8a6", coefficient: 4 } },

    // ========================
    // ENSEIGNEMENT TECHNIQUE - PREMIER CYCLE FRANCOPHONE
    // ========================
    { name: "Français Technique", code: "FRA_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Français Technique", en: "Technical French" }, color: "#ec4899", coefficient: 2 } },
    { name: "Anglais Technique", code: "ANG_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Anglais Technique", en: "Technical English" }, color: "#6366f1", coefficient: 2 } },
    { name: "Mathématiques (Technique)", code: "MATH_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Mathématiques", en: "Mathematics" }, color: "#3b82f6", coefficient: 3 } },
    { name: "Technologie", code: "TECH_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Technologie", en: "Technology" }, color: "#64748b", coefficient: 4 } },
    { name: "Dessin Technique", code: "DT_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Dessin Technique", en: "Technical Drawing" }, color: "#f59e0b", coefficient: 3 } },
    { name: "Atelier / Pratique", code: "ATEL_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Travaux Pratiques d'Atelier", en: "Workshop Practice" }, color: "#10b981", coefficient: 5 } },
    { name: "Physique-Chimie (Technique)", code: "PC_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Physique-Chimie", en: "Physics & Chemistry" }, color: "#06b6d4", coefficient: 2 } },
    { name: "Informatique (Technique)", code: "INFO_TECH1_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_FR', metadata: { displayName: { fr: "Informatique", en: "Computer Science" }, color: "#14b8a6", coefficient: 2 } },

    // ========================
    // ENSEIGNEMENT TECHNIQUE - SECOND CYCLE FRANCOPHONE
    // ========================
    { name: "Mathématiques Appliquées", code: "MATH_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Mathématiques Appliquées", en: "Applied Mathematics" }, color: "#3b82f6", coefficient: 4 } },
    { name: "Dessin Technique Avancé", code: "DT_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Dessin Technique et DAO", en: "Technical Drawing & CAD" }, color: "#f59e0b", coefficient: 3 } },
    { name: "Atelier / Laboratoire", code: "ATEL_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Travaux Pratiques", en: "Laboratory Work" }, color: "#10b981", coefficient: 6 } },
    { name: "Économie d'Entreprise", code: "ECO_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Économie d'Entreprise", en: "Business Economics" }, color: "#fb923c", coefficient: 2 } },
    { name: "Comptabilité (Technique)", code: "COMPTA_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Comptabilité", en: "Accounting" }, color: "#0ea5e9", coefficient: 3 } },
    { name: "Technologie Professionnelle", code: "TECH_PRO_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Technologie Professionnelle", en: "Professional Technology" }, color: "#64748b", coefficient: 5 } },
    { name: "Informatique Appliquée", code: "INFO_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Informatique Appliquée", en: "Applied Computing" }, color: "#14b8a6", coefficient: 3 } },
    { name: "Communication Professionnelle", code: "COMM_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Communication Professionnelle", en: "Professional Communication" }, color: "#8b5cf6", coefficient: 2 } },
    { name: "Gestion Commerciale", code: "GEST_COMM_TECH2_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_FR', metadata: { displayName: { fr: "Gestion Commerciale", en: "Commercial Management" }, color: "#d946ef", coefficient: 3 } },

    // ========================
    // ENSEIGNEMENT TECHNIQUE ANGLOPHONE
    // ========================
    { name: "English Language (Technical)", code: "ENG_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_EN', metadata: { displayName: { fr: "Anglais Technique", en: "Technical English" }, color: "#6366f1", coefficient: 2 } },
    { name: "Mathematics (Technical)", code: "MATH_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_EN', metadata: { displayName: { fr: "Mathématiques", en: "Mathematics" }, color: "#3b82f6", coefficient: 3 } },
    { name: "Technical Drawing", code: "TD_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_EN', metadata: { displayName: { fr: "Dessin Technique", en: "Technical Drawing" }, color: "#f59e0b", coefficient: 3 } },
    { name: "Workshop Technology", code: "WORK_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_EN', metadata: { displayName: { fr: "Technologie d'Atelier", en: "Workshop Technology" }, color: "#10b981", coefficient: 5 } },
    { name: "Physics (Technical)", code: "PHY_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_EN', metadata: { displayName: { fr: "Physique", en: "Physics" }, color: "#06b6d4", coefficient: 2 } },
    { name: "Chemistry (Technical)", code: "CHE_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_EN', metadata: { displayName: { fr: "Chimie", en: "Chemistry" }, color: "#10b981", coefficient: 2 } },
    { name: "Computer Studies (Technical)", code: "CS_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_1_EN', metadata: { displayName: { fr: "Informatique", en: "Computer Studies" }, color: "#14b8a6", coefficient: 2 } },

    // Second cycle technique anglophone
    { name: "General Paper (Technical)", code: "GP_TECH2_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_EN', metadata: { displayName: { fr: "Culture Générale", en: "General Paper" }, color: "#8b5cf6", coefficient: 2 } },
    { name: "Advanced Mathematics (Technical)", code: "MATH_ADV_TECH2_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_EN', metadata: { displayName: { fr: "Mathématiques Avancées", en: "Advanced Mathematics" }, color: "#3b82f6", coefficient: 4 } },
    { name: "Advanced Technical Drawing", code: "TD_ADV_TECH2_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_EN', metadata: { displayName: { fr: "Dessin Technique Avancé", en: "Advanced Technical Drawing" }, color: "#f59e0b", coefficient: 3 } },
    { name: "Specialized Technology", code: "SPEC_TECH_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_EN', metadata: { displayName: { fr: "Technologie Spécialisée", en: "Specialized Technology" }, color: "#64748b", coefficient: 5 } },
    { name: "Accounts / Economics", code: "ACC_ECO_TECH2_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_EN', metadata: { displayName: { fr: "Comptabilité / Économie", en: "Accounts / Economics" }, color: "#0ea5e9", coefficient: 3 } },
    { name: "Computer Studies Advanced", code: "CS_ADV_TECH2_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_EN', metadata: { displayName: { fr: "Informatique Avancée", en: "Advanced Computer Studies" }, color: "#14b8a6", coefficient: 3 } },
    { name: "Practical Work", code: "PRACT_TECH2_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'TECH_2_EN', metadata: { displayName: { fr: "Travaux Pratiques", en: "Practical Work" }, color: "#10b981", coefficient: 6 } },

    // ========================
    // ENSEIGNEMENT NORMAL - FRANCOPHONE
    // ========================
    { name: "Pédagogie Générale", code: "PEDAG_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Pédagogie Générale", en: "General Pedagogy" }, color: "#8b5cf6", coefficient: 4 } },
    { name: "Psychologie de l'Enfant", code: "PSYCH_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Psychologie de l'Enfant et de l'Adolescent", en: "Child & Adolescent Psychology" }, color: "#ec4899", coefficient: 3 } },
    { name: "Didactique", code: "DIDACT_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Didactique des Disciplines", en: "Subject Didactics" }, color: "#f59e0b", coefficient: 4 } },
    { name: "Français (Enseignement Normal)", code: "FRA_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Français", en: "French" }, color: "#ec4899", coefficient: 3 } },
    { name: "Anglais (Enseignement Normal)", code: "ANG_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Anglais", en: "English" }, color: "#6366f1", coefficient: 2 } },
    { name: "TIC Éducatives", code: "TIC_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Technologies Éducatives", en: "Educational ICT" }, color: "#14b8a6", coefficient: 3 } },
    { name: "Pratique Professionnelle", code: "STAGE_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Stages et Pratique Professionnelle", en: "Teaching Practice" }, color: "#10b981", coefficient: 5 } },
    { name: "Méthodologie de l'Enseignement", code: "METHOD_NORM_FR", subSystem: SubSystem.FRANCOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_FR', metadata: { displayName: { fr: "Méthodologie de l'Enseignement", en: "Teaching Methodology" }, color: "#06b6d4", coefficient: 4 } },

    // ========================
    // ENSEIGNEMENT NORMAL - ANGLOPHONE
    // ========================
    { name: "Pedagogy", code: "PEDAG_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "Pédagogie", en: "Pedagogy" }, color: "#8b5cf6", coefficient: 4 } },
    { name: "Child Psychology", code: "PSYCH_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "Psychologie de l'Enfant", en: "Child Psychology" }, color: "#ec4899", coefficient: 3 } },
    { name: "Didactics", code: "DIDACT_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "Didactique", en: "Didactics" }, color: "#f59e0b", coefficient: 4 } },
    { name: "English (Teacher Training)", code: "ENG_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "Anglais", en: "English" }, color: "#6366f1", coefficient: 3 } },
    { name: "French (Teacher Training)", code: "FRA_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "Français", en: "French" }, color: "#ec4899", coefficient: 2 } },
    { name: "Educational ICT", code: "ICT_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "TIC Éducatives", en: "Educational ICT" }, color: "#14b8a6", coefficient: 3 } },
    { name: "Teaching Practice", code: "TP_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "Pratique Professionnelle", en: "Teaching Practice" }, color: "#10b981", coefficient: 5 } },
    { name: "Teaching Methodology", code: "METHOD_NORM_EN", subSystem: SubSystem.ANGLOPHONE, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'NORMAL_EN', metadata: { displayName: { fr: "Méthodologie", en: "Teaching Methodology" }, color: "#06b6d4", coefficient: 4 } },

    // ========================
    // BTS / HND
    // ========================
    { name: "Méthodologie du Travail Universitaire", code: "MTU_BTS", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'BTS_HND', metadata: { displayName: { fr: "Méthodologie du Travail Universitaire", en: "Study Skills" }, color: "#8b5cf6", coefficient: 2 } },
    { name: "Communication Professionnelle (BTS)", code: "COMM_BTS", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'BTS_HND', metadata: { displayName: { fr: "Communication Professionnelle", en: "Professional Communication" }, color: "#ec4899", coefficient: 3 } },
    { name: "Informatique (BTS)", code: "INFO_BTS", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'BTS_HND', metadata: { displayName: { fr: "Informatique", en: "Computer Science" }, color: "#14b8a6", coefficient: 3 } },
    { name: "UE de Spécialité", code: "UE_SPEC_BTS", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'BTS_HND', metadata: { displayName: { fr: "Unités d'Enseignement de Spécialité", en: "Specialized Courses" }, color: "#3b82f6", coefficient: 6 } },
    { name: "Projet Tutoré", code: "PROJ_BTS", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'BTS_HND', metadata: { displayName: { fr: "Projet Tutoré", en: "Supervised Project" }, color: "#10b981", coefficient: 4 } },
    { name: "Stage Professionnel", code: "STAGE_BTS", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'BTS_HND', metadata: { displayName: { fr: "Stage en Entreprise", en: "Professional Internship" }, color: "#f59e0b", coefficient: 5 } },

    // ========================
    // LICENCE / MASTER / DOCTORAT
    // ========================
    { name: "UE Fondamentales", code: "UE_FOND_LIC", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'LICENCE', metadata: { displayName: { fr: "Unités d'Enseignement Fondamentales", en: "Core Courses" }, color: "#3b82f6", coefficient: 5 } },
    { name: "UE Complémentaires", code: "UE_COMP_LIC", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'LICENCE', metadata: { displayName: { fr: "Unités d'Enseignement Complémentaires", en: "Complementary Courses" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Méthodologie de la Recherche", code: "METHOD_LIC", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'LICENCE', metadata: { displayName: { fr: "Méthodologie de la Recherche", en: "Research Methodology" }, color: "#ec4899", coefficient: 3 } },
    { name: "Informatique / Outils Numériques", code: "INFO_NUM_LIC", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'LICENCE', metadata: { displayName: { fr: "Informatique et Outils Numériques", en: "Digital Tools" }, color: "#14b8a6", coefficient: 2 } },
    { name: "Projet (Licence)", code: "PROJ_LIC", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'LICENCE', metadata: { displayName: { fr: "Projet de Fin d'Études", en: "Final Year Project" }, color: "#10b981", coefficient: 4 } },
    { name: "Stage (Licence)", code: "STAGE_LIC", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'LICENCE', metadata: { displayName: { fr: "Stage", en: "Internship" }, color: "#f59e0b", coefficient: 3 } },

    { name: "Séminaires (Master)", code: "SEM_MAST", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'MASTER', metadata: { displayName: { fr: "Séminaires de Spécialisation", en: "Specialized Seminars" }, color: "#8b5cf6", coefficient: 4 } },
    { name: "UE de Spécialisation", code: "UE_SPEC_MAST", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'MASTER', metadata: { displayName: { fr: "Unités de Spécialisation", en: "Specialization Courses" }, color: "#3b82f6", coefficient: 5 } },
    { name: "Méthodologie de Recherche Avancée", code: "METHOD_ADV_MAST", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'MASTER', metadata: { displayName: { fr: "Méthodologie de Recherche Avancée", en: "Advanced Research Methodology" }, color: "#ec4899", coefficient: 3 } },
    { name: "Mémoire de Master", code: "MEM_MAST", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'MASTER', metadata: { displayName: { fr: "Mémoire de Master", en: "Master's Thesis" }, color: "#10b981", coefficient: 8 } },
    { name: "Stage / Projet (Master)", code: "STAGE_PROJ_MAST", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'MASTER', metadata: { displayName: { fr: "Stage ou Projet de Recherche", en: "Internship or Research Project" }, color: "#f59e0b", coefficient: 5 } },

    { name: "Séminaires Doctoraux", code: "SEM_DOCT", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'DOCTORAT', metadata: { displayName: { fr: "Séminaires Doctoraux", en: "Doctoral Seminars" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Méthodologie de Recherche Doctorale", code: "METHOD_DOCT", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'DOCTORAT', metadata: { displayName: { fr: "Méthodologie de Recherche Doctorale", en: "Doctoral Research Methodology" }, color: "#ec4899", coefficient: 2 } },
    { name: "Publications Scientifiques", code: "PUB_DOCT", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'DOCTORAT', metadata: { displayName: { fr: "Publications et Communications", en: "Publications & Conferences" }, color: "#14b8a6", coefficient: 5 } },
    { name: "Thèse de Doctorat", code: "THESE_DOCT", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.UE, cycle_filter: 'DOCTORAT', metadata: { displayName: { fr: "Thèse de Doctorat", en: "Doctoral Thesis" }, color: "#10b981", coefficient: 15 } },

    // ========================
    // ALPHABETISATION / NON FORMEL
    // ========================
    { name: "Lecture", code: "LECT_ALPHA", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'ALPHA_NON_FORMAL', metadata: { displayName: { fr: "Apprentissage de la Lecture", en: "Reading Skills" }, color: "#ec4899", coefficient: 3 } },
    { name: "Écriture", code: "ECR_ALPHA", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'ALPHA_NON_FORMAL', metadata: { displayName: { fr: "Apprentissage de l'Écriture", en: "Writing Skills" }, color: "#8b5cf6", coefficient: 3 } },
    { name: "Calcul de Base", code: "CALC_ALPHA", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'ALPHA_NON_FORMAL', metadata: { displayName: { fr: "Calcul et Numération", en: "Basic Arithmetic" }, color: "#3b82f6", coefficient: 3 } },
    { name: "Vie Pratique", code: "VIE_ALPHA", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'ALPHA_NON_FORMAL', metadata: { displayName: { fr: "Compétences de Vie Pratique", en: "Life Skills" }, color: "#22c55e", coefficient: 2 } },
    { name: "Citoyenneté", code: "CIT_ALPHA", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'ALPHA_NON_FORMAL', metadata: { displayName: { fr: "Éducation Citoyenne", en: "Citizenship Education" }, color: "#f59e0b", coefficient: 2 } },
    { name: "Compétences de Base", code: "COMP_ALPHA", subSystem: SubSystem.BILINGUAL, subjectType: SubjectType.DISCIPLINE, cycle_filter: 'ALPHA_NON_FORMAL', metadata: { displayName: { fr: "Compétences de Base", en: "Basic Skills" }, color: "#06b6d4", coefficient: 2 } },
]

// ============================================================
// SERIES / FAMILLES / FILIERES
// ============================================================
const seriesDefinitions = [
  // Général francophone
  {
    name: "Série A",
    code: "SER_A_FR",
    category: FieldCategory.FAMILY,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série A - Lettres", en: "Series A - Arts" } },
  },
  {
    name: "Série A4",
    code: "SER_A4_FR",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série A4", en: "Series A4" } },
  },
  {
    name: "Série C",
    code: "SER_C_FR",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série C", en: "Series C" } },
  },
  {
    name: "Série D",
    code: "SER_D_FR",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série D", en: "Series D" } },
  },
  {
    name: "Série E",
    code: "SER_E_FR",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série E - Techniques Mathématiques", en: "Series E - Math & Technology" } },
  },
  {
    name: "Série F",
    code: "SER_F_FR",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série F - Électrotechnique", en: "Series F - Electrotechnics" } },
  },
  {
    name: "Série G",
    code: "SER_G_FR",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série G - Sciences Économiques et Sociales", en: "Series G - Economics & Social Sciences" } },
  },
  {
    name: "Série TI",
    code: "SER_TI_FR",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.SEC_GEN_2_FR,
    metadata: { displayName: { fr: "Série TI - Techniques Industrielles", en: "Series TI - Industrial Technology" } },
  },

  // Général anglophone
  {
    name: "Arts",
    code: "ARTS_EN",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_2_EN,
    metadata: { displayName: { fr: "Arts", en: "Arts" } },
  },
  {
    name: "Sciences",
    code: "SCI_EN",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_2_EN,
    metadata: { displayName: { fr: "Sciences", en: "Sciences" } },
  },
  {
    name: "Commerce",
    code: "COMM_EN",
    category: FieldCategory.SERIE,
    cycle: Cycle.SECONDAIRE_SECOND_CYCLE,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.SEC_GEN_2_EN,
    metadata: { displayName: { fr: "Commerce", en: "Commerce" } },
  },

  // Technique francophone
  {
    name: "STT",
    code: "STT_FR",
    category: FieldCategory.FAMILY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Sciences et Technologies du Tertiaire", en: "Tertiary Sciences and Technology" } },
  },
  {
    name: "IND",
    code: "IND_FR",
    category: FieldCategory.FAMILY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Sciences et Techniques Industrielles", en: "Industrial Techniques" } },
  },
  {
    name: "Comptabilité et Gestion",
    code: "CG_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Comptabilité et Gestion", en: "Accounting and Management" } },
  },
  {
    name: "Techniques Industrielles",
    code: "TI_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Techniques Industrielles", en: "Industrial Technology" } },
  },

  // Technique anglophone
  {
    name: "Technical Commercial",
    code: "TECH_COMM_EN",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_2_EN,
    metadata: { displayName: { fr: "Technique Commerciale", en: "Technical Commercial" } },
  },
  {
    name: "Technical Industrial",
    code: "TECH_IND_EN",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.TECH_2_EN,
    metadata: { displayName: { fr: "Technique Industrielle", en: "Technical Industrial" } },
  },

  // Enseignement normal
  {
    name: "ENIEG",
    code: "ENIEG",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.NORMAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.NORMAL_FR,
    metadata: { displayName: { fr: "École Normale d'Instituteurs", en: "Teacher Training College" } },
  },
  {
    name: "ENIET",
    code: "ENIET",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.NORMAL,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.NORMAL_FR,
    metadata: { displayName: { fr: "École Normale d'Instituteurs de l'Enseignement Technique", en: "Technical Teacher Training College" } },
  },
  {
    name: "Teacher Training",
    code: "TTC_EN",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.NORMAL,
    subSystem: SubSystem.ANGLOPHONE,
    filter: StageFilter.NORMAL_EN,
    metadata: { displayName: { fr: "Formation des Enseignants", en: "Teacher Training" } },
  },

  // Technique - Spécialités détaillées
  {
    name: "Électricité",
    code: "ELEC_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Électricité", en: "Electrical Engineering" } },
  },
  {
    name: "Électronique",
    code: "ELECTRON_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Électronique", en: "Electronics" } },
  },
  {
    name: "Génie Civil",
    code: "GC_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Génie Civil", en: "Civil Engineering" } },
  },
  {
    name: "Mécanique Automobile",
    code: "MECA_AUTO_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Mécanique Automobile", en: "Automotive Mechanics" } },
  },
  {
    name: "Fabrication Mécanique",
    code: "FAB_MECA_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Fabrication Mécanique", en: "Mechanical Manufacturing" } },
  },
  {
    name: "Action et Communication Commerciale",
    code: "ACC_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Action et Communication Commerciale", en: "Business & Commercial Communication" } },
  },
  {
    name: "Secrétariat Bureautique",
    code: "SEC_BUR_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Secrétariat Bureautique", en: "Office Management & Secretarial" } },
  },
  {
    name: "Hôtellerie et Restauration",
    code: "HR_FR",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.TECHNIQUE_SECOND_CYCLE,
    subSystem: SubSystem.FRANCOPHONE,
    filter: StageFilter.TECH_2_FR,
    metadata: { displayName: { fr: "Hôtellerie et Restauration", en: "Hospitality & Catering" } },
  },

  // Supérieur - Filières complètes
  {
    name: "Génie Informatique",
    code: "FIL_INFO",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Génie Informatique", en: "Computer Engineering" } },
  },
  {
    name: "Mathématiques",
    code: "FIL_MATH",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Mathématiques", en: "Mathematics" } },
  },
  {
    name: "Physique",
    code: "FIL_PHYS",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Physique", en: "Physics" } },
  },
  {
    name: "Chimie",
    code: "FIL_CHEM",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Chimie", en: "Chemistry" } },
  },
  {
    name: "Biologie",
    code: "FIL_BIO",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Biologie", en: "Biology" } },
  },
  {
    name: "Géologie",
    code: "FIL_GEO",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Géologie", en: "Geology" } },
  },
  {
    name: "Économie et Gestion",
    code: "FIL_ECO",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Économie et Gestion", en: "Economics and Management" } },
  },
  {
    name: "Gestion",
    code: "FIL_GEST",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Sciences de Gestion", en: "Management Sciences" } },
  },
  {
    name: "Comptabilité",
    code: "FIL_COMPTA",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Comptabilité", en: "Accounting" } },
  },
  {
    name: "Finance",
    code: "FIL_FIN",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Finance", en: "Finance" } },
  },
  {
    name: "Marketing",
    code: "FIL_MKT",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Marketing", en: "Marketing" } },
  },
  {
    name: "Droit",
    code: "FIL_LAW",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Droit", en: "Law" } },
  },
  {
    name: "Sciences Politiques",
    code: "FIL_POLSCI",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Sciences Politiques", en: "Political Science" } },
  },
  {
    name: "Sociologie",
    code: "FIL_SOCIO",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Sociologie", en: "Sociology" } },
  },
  {
    name: "Psychologie",
    code: "FIL_PSYCH",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Psychologie", en: "Psychology" } },
  },
  {
    name: "Philosophie",
    code: "FIL_PHILO",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Philosophie", en: "Philosophy" } },
  },
  {
    name: "Lettres Modernes",
    code: "FIL_LETTRES",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Lettres Modernes", en: "Modern Languages & Literature" } },
  },
  {
    name: "Langues Étrangères Appliquées",
    code: "FIL_LEA",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Langues Étrangères Appliquées", en: "Applied Foreign Languages" } },
  },
  {
    name: "Histoire",
    code: "FIL_HIST",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Histoire", en: "History" } },
  },
  {
    name: "Géographie",
    code: "FIL_GEOG",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Géographie", en: "Geography" } },
  },
  {
    name: "Sciences de la Santé",
    code: "FIL_HEALTH",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Sciences de la Santé", en: "Health Sciences" } },
  },
  {
    name: "Médecine",
    code: "FIL_MED",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Médecine", en: "Medicine" } },
  },
  {
    name: "Pharmacie",
    code: "FIL_PHARMA",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Pharmacie", en: "Pharmacy" } },
  },
  {
    name: "Sciences Infirmières",
    code: "FIL_NURSING",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Sciences Infirmières", en: "Nursing Sciences" } },
  },
  {
    name: "Architecture",
    code: "FIL_ARCHI",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Architecture", en: "Architecture" } },
  },
  {
    name: "Génie Civil",
    code: "FIL_CIVIL",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Génie Civil", en: "Civil Engineering" } },
  },
  {
    name: "Génie Électrique",
    code: "FIL_ELEC",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Génie Électrique", en: "Electrical Engineering" } },
  },
  {
    name: "Génie Mécanique",
    code: "FIL_MECA",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Génie Mécanique", en: "Mechanical Engineering" } },
  },
  {
    name: "Télécommunications",
    code: "FIL_TELECOM",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Télécommunications", en: "Telecommunications" } },
  },
  {
    name: "Agronomie",
    code: "FIL_AGRO",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Agronomie", en: "Agronomy" } },
  },
  {
    name: "Foresterie",
    code: "FIL_FOREST",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Foresterie", en: "Forestry" } },
  },
  {
    name: "Sciences de l'Éducation",
    code: "FIL_EDU",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Sciences de l'Éducation", en: "Educational Sciences" } },
  },
  {
    name: "Communication",
    code: "FIL_COMM",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Communication", en: "Communication" } },
  },
  {
    name: "Journalisme",
    code: "FIL_JOURN",
    category: FieldCategory.SPECIALITY,
    cycle: Cycle.LICENCE,
    subSystem: SubSystem.BILINGUAL,
    filter: StageFilter.LICENCE,
    metadata: { displayName: { fr: "Journalisme", en: "Journalism" } },
  },
]

// ============================================================
// MATIERES DE BASE PAR FILTRE
// ============================================================
const coreSubjectsByFilter = {
  [StageFilter.PRESCO_FR]: [
    "Langage",
    "Pré-calcul",
    "Motricité",
    "Éveil artistique",
    "Socialisation",
  ],
  [StageFilter.PRESCO_EN]: [
    "Language Skills",
    "Number Work",
    "Psychomotor Activities",
    "Creative Activities",
    "Social Development",
  ],

  [StageFilter.PRIMAIRE_FR]: [
    "Français",
    "Mathématiques",
    "Sciences et Technologie",
    "Histoire-Géographie",
    "Éducation Civique et Morale",
    "TIC",
    "Anglais",
    "EPS",
    "Éducation Religieuse",
  ],
  [StageFilter.PRIMAIRE_EN]: [
    "English Language",
    "Mathematics",
    "Science and Technology",
    "Social Studies",
    "ICT",
    "French",
    "Religious Studies",
    "Physical Education",
  ],

  [StageFilter.SEC_GEN_1_FR]: [
    "Français",
    "Anglais",
    "Mathématiques",
    "SVT",
    "Physique-Chimie",
    "Histoire-Géographie",
    "Éducation Civique",
    "Informatique",
    "Technologie",
    "Arts",
    "EPS",
  ],
  [StageFilter.SEC_GEN_2_FR]: [
    "Français / Littérature",
    "Anglais",
    "Mathématiques",
    "SVT",
    "Physique-Chimie",
    "Histoire-Géographie",
    "Philosophie",
    "Économie",
    "Informatique",
    "EPS",
  ],

  [StageFilter.SEC_GEN_1_EN]: [
    "English Language",
    "French",
    "Mathematics",
    "Biology",
    "Physics",
    "Chemistry",
    "Geography",
    "History",
    "Computer Science",
    "Religious Studies",
    "Physical Education",
  ],
  [StageFilter.SEC_GEN_2_EN]: [
    "General Paper",
    "English Language",
    "French",
    "Mathematics",
    "Biology",
    "Physics",
    "Chemistry",
    "Economics",
    "Geography",
    "Literature in English",
    "Computer Science",
  ],

  [StageFilter.TECH_1_FR]: [
    "Français Technique",
    "Anglais Technique",
    "Mathématiques",
    "Technologie",
    "Dessin Technique",
    "Atelier / Pratique",
    "Physique-Chimie",
    "Informatique",
  ],
  [StageFilter.TECH_2_FR]: [
    "Mathématiques Appliquées",
    "Dessin Technique",
    "Atelier / Laboratoire",
    "Économie / Comptabilité",
    "Technologie Professionnelle",
    "Informatique",
    "Communication Professionnelle",
  ],

  [StageFilter.TECH_1_EN]: [
    "English Language",
    "Mathematics",
    "Technical Drawing",
    "Workshop Technology",
    "Physics",
    "Chemistry",
    "Computer Studies",
  ],
  [StageFilter.TECH_2_EN]: [
    "General Paper",
    "Mathematics",
    "Technical Drawing",
    "Specialized Technology",
    "Accounts / Economics",
    "Computer Studies",
    "Practical Work",
  ],

  [StageFilter.NORMAL_FR]: [
    "Pédagogie",
    "Psychologie de l'enfant",
    "Didactique",
    "Français",
    "Anglais",
    "TIC éducatives",
    "Pratique professionnelle",
  ],
  [StageFilter.NORMAL_EN]: [
    "Pedagogy",
    "Child Psychology",
    "Didactics",
    "English",
    "French",
    "Educational ICT",
    "Teaching Practice",
  ],

  [StageFilter.BTS_HND]: [
    "Méthodologie",
    "Communication professionnelle",
    "Informatique",
    "UE de spécialité",
    "Projet tutoré",
    "Stage",
  ],
  [StageFilter.LICENCE]: [
    "UE fondamentales",
    "UE complémentaires",
    "Méthodologie de recherche",
    "Informatique / Outils numériques",
    "Projet",
    "Stage",
  ],
  [StageFilter.MASTER]: [
    "Séminaires",
    "UE de spécialisation",
    "Méthodologie de recherche",
    "Mémoire",
    "Stage / Projet",
  ],
  [StageFilter.DOCTORAT]: [
    "Séminaires doctoraux",
    "Méthodologie avancée",
    "Publications",
    "Thèse",
  ],

  [StageFilter.ALPHA_NON_FORMAL]: [
    "Lecture",
    "Écriture",
    "Calcul",
    "Vie pratique",
    "Citoyenneté",
    "Compétences de base",
  ],
};

// ============================================================
// EXPORT DU MODELE
// ============================================================
const educationModelCM = {
  country: "CM",
  label: "Système éducatif camerounais",
  enums: {
    SubSystem,
    SchoolType,
    Cycle,
    FieldCategory,
    SubjectType,
    StageFilter,
  },
  educationLevels,
  seriesDefinitions,
  coreSubjectsByFilter,
};

async function seed() {
    await mongoose.connect(DATABASE_URL)
    console.log('✅ Connecté à MongoDB')

    // Clean
    console.log('🗑️  Nettoyage des collections...')
    await EducationLevel.deleteMany({})
    await Subject.deleteMany({})
    await Field.deleteMany({})

    // Insert levels
    console.log('📚 Création des niveaux scolaires...')
    const levels = await EducationLevel.insertMany(educationLevels)
    console.log(`   ✅ ${levels.length} niveaux insérés`)

    // Helper functions to get level IDs by filter
    const byFilter = {
        'PRESCO_FR': levels.filter(l => l.cycle === Cycle.PRESCOLAIRE && l.subSystem === SubSystem.FRANCOPHONE).map(l => l._id),
        'PRESCO_EN': levels.filter(l => l.cycle === Cycle.PRESCOLAIRE && l.subSystem === SubSystem.ANGLOPHONE).map(l => l._id),
        'PRIMAIRE_FR': levels.filter(l => l.cycle === Cycle.PRIMAIRE && l.subSystem === SubSystem.FRANCOPHONE).map(l => l._id),
        'PRIMAIRE_EN': levels.filter(l => l.cycle === Cycle.PRIMAIRE && l.subSystem === SubSystem.ANGLOPHONE).map(l => l._id),
        'COLLEGE_FR':  levels.filter(l => l.cycle === Cycle.SECONDAIRE_PREMIER_CYCLE && l.subSystem === SubSystem.FRANCOPHONE && l.schoolType === SchoolType.SECONDARY_GENERAL).map(l => l._id),
        'SEC_GEN_1_FR': levels.filter(l => l.cycle === Cycle.SECONDAIRE_PREMIER_CYCLE && l.subSystem === SubSystem.FRANCOPHONE && l.schoolType === SchoolType.SECONDARY_GENERAL).map(l => l._id),
        'SEC_GEN_2_FR': levels.filter(l => l.cycle === Cycle.SECONDAIRE_SECOND_CYCLE && l.subSystem === SubSystem.FRANCOPHONE && l.schoolType === SchoolType.SECONDARY_GENERAL).map(l => l._id),
        'LYCEE_FR':    levels.filter(l => l.cycle === Cycle.SECONDAIRE_SECOND_CYCLE && l.subSystem === SubSystem.FRANCOPHONE && l.schoolType === SchoolType.SECONDARY_GENERAL).map(l => l._id),
        'SEC_GEN_1_EN': levels.filter(l => l.cycle === Cycle.SECONDAIRE_PREMIER_CYCLE && l.subSystem === SubSystem.ANGLOPHONE && l.schoolType === SchoolType.SECONDARY_GENERAL).map(l => l._id),
        'SEC_GEN_2_EN': levels.filter(l => l.cycle === Cycle.SECONDAIRE_SECOND_CYCLE && l.subSystem === SubSystem.ANGLOPHONE && l.schoolType === SchoolType.SECONDARY_GENERAL).map(l => l._id),
        'LYCEE_EN':    levels.filter(l => l.cycle === Cycle.SECONDAIRE_SECOND_CYCLE && l.subSystem === SubSystem.ANGLOPHONE && l.schoolType === SchoolType.SECONDARY_GENERAL).map(l => l._id),
        'SEC_EN':      levels.filter(l => l.schoolType === SchoolType.SECONDARY_GENERAL && l.subSystem === SubSystem.ANGLOPHONE).map(l => l._id),
        'TECH_1_FR':   levels.filter(l => l.cycle === Cycle.TECHNIQUE_PREMIER_CYCLE && l.subSystem === SubSystem.FRANCOPHONE).map(l => l._id),
        'TECH_2_FR':   levels.filter(l => l.cycle === Cycle.TECHNIQUE_SECOND_CYCLE && l.subSystem === SubSystem.FRANCOPHONE).map(l => l._id),
        'TECH_1_EN':   levels.filter(l => l.cycle === Cycle.TECHNIQUE_PREMIER_CYCLE && l.subSystem === SubSystem.ANGLOPHONE).map(l => l._id),
        'TECH_2_EN':   levels.filter(l => l.cycle === Cycle.TECHNIQUE_SECOND_CYCLE && l.subSystem === SubSystem.ANGLOPHONE).map(l => l._id),
        'NORMAL_FR':   levels.filter(l => l.cycle === Cycle.NORMAL && l.subSystem === SubSystem.FRANCOPHONE).map(l => l._id),
        'NORMAL_EN':   levels.filter(l => l.cycle === Cycle.NORMAL && l.subSystem === SubSystem.ANGLOPHONE).map(l => l._id),
        'BTS_HND':     levels.filter(l => l.cycle === Cycle.BTS_HND).map(l => l._id),
        'LICENCE':     levels.filter(l => l.cycle === Cycle.LICENCE).map(l => l._id),
        'MASTER':      levels.filter(l => l.cycle === Cycle.MASTER).map(l => l._id),
        'DOCTORAT':    levels.filter(l => l.cycle === Cycle.DOCTORAT).map(l => l._id),
        'ALPHA_NON_FORMAL': levels.filter(l => [Cycle.ALPHABETISATION, Cycle.EDUCATION_NON_FORMELLE].includes(l.cycle)).map(l => l._id),
        'UNIV':        levels.filter(l => l.schoolType === SchoolType.HIGHER_ED).map(l => l._id),
    }

    // Map subjects with their applicable levels
    const subjectsWithLevels = subjectsData.map(s => {
        const { cycle_filter, ...rest } = s
        return { ...rest, applicableLevels: byFilter[cycle_filter] || [] }
    })

    console.log('📖 Création des matières & UE...')
    const createdSubjects = await Subject.insertMany(subjectsWithLevels)
    console.log(`   ✅ ${createdSubjects.length} matières insérées`)

    // Insert Fields/Séries/Filières with level IDs
    const fieldsWithLevels = seriesDefinitions.map(s => {
        const { filter, ...rest } = s
        return { ...rest, applicableLevels: byFilter[filter] || [] }
    })

    console.log('🎭 Création des Séries & Filières...')
    const createdFields = await Field.insertMany(fieldsWithLevels)
    console.log(`   ✅ ${createdFields.length} séries/filières insérées`)

    // Summary
    console.log('\n========================================')
    console.log('🎉 SEED TERMINÉ AVEC SUCCÈS !')
    console.log('========================================')
    console.log(`📊 Résumé :`)
    console.log(`   • ${levels.length} Niveaux (Primaire FR+EN, Collège FR+EN, Lycée FR+EN, Université)`)
    console.log(`   • ${createdSubjects.length} Matières/UE (10 primaire, 16 collège, 15 lycée, 14 univ-info, 9 univ-eco, 6 univ-santé)`)
    console.log(`   • ${createdFields.length} Séries/Filières (Lycée + Université)`)

    await mongoose.connection.close()
    process.exit(0)
}

seed().catch(err => {
    console.error('❌ Erreur seed:', err.message)
    process.exit(1)
})
