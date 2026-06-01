/**
 * Migration : Matières ISIMMA S2 — IGL / CMN / GLT
 * Source : tableau Enseignants_ISIMMA_S2 (préfixes de filière ignorés)
 *
 * Script idempotent (upsert $setOnInsert) — relançable sans risque.
 */
const mongoose = require('mongoose')
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/qcmapp'

const SubjectSchema = new mongoose.Schema({
  name: String,
  code: { type: String, unique: true },
  subSystem: String,
  applicableLevels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EducationLevel' }],
  applicableFields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }],
  isTransversal: { type: Boolean, default: false },
  subjectType: String,
  isActive: { type: Boolean, default: true },
  metadata: {
    displayName: { fr: String, en: String },
    description: String,
    icon: String,
    color: String,
    coefficient: Number
  },
  _cachedExamCount: { type: Number, default: 0 },
  _cachedLearningUnitCount: { type: Number, default: 0 }
}, { timestamps: true })

const EducationLevelSchema = new mongoose.Schema({
  name: String, code: { type: String, unique: true }, cycle: String,
  schoolType: String, subSystem: String, order: Number,
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

const Subject = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema)
const EducationLevel = mongoose.models.EducationLevel || mongoose.model('EducationLevel', EducationLevelSchema)

// ============================================================
// MATIÈRES ISIMMA S2 (communes IGL / CMN / GLT)
// ============================================================
const NEW_SUBJECTS = [

  // --- IGL — Informatique et Gestion des Logiciels ---
  {
    name: 'Outils mathématiques II',
    code: 'MATH2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Outils mathématiques II', en: 'Mathematical Tools II' },
      description: 'Mathématiques appliquées au second semestre : algèbre, analyse, probabilités',
      color: '#3b82f6',
      coefficient: 3
    }
  },
  {
    name: 'Economie et Gestion des entreprises',
    code: 'ECO_GEST_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Economie et Gestion des entreprises', en: 'Business Economics & Management' },
      description: 'Principes fondamentaux d\'économie et gestion d\'entreprise',
      color: '#22c55e',
      coefficient: 3
    }
  },
  {
    name: 'Programmation II',
    code: 'PROG2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Programmation II', en: 'Programming II' },
      description: 'Approfondissement des concepts de programmation',
      color: '#14b8a6',
      coefficient: 4
    }
  },
  {
    name: 'Maintenance et Négociation informatique',
    code: 'MAINT_NEG_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Maintenance et Négociation informatique', en: 'IT Maintenance & Negotiation' },
      description: 'Maintenance des systèmes informatiques et techniques de négociation en contexte IT',
      color: '#f59e0b',
      coefficient: 3
    }
  },
  {
    name: 'Base de données et MERISE I',
    code: 'BDD_MERISE1_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Base de données et MERISE I', en: 'Databases & MERISE I' },
      description: 'Conception de bases de données relationnelles avec la méthode MERISE',
      color: '#6366f1',
      coefficient: 4
    }
  },
  {
    name: 'Environnement de base II',
    code: 'ENV_BASE2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Environnement de base II', en: 'Computing Environment II' },
      description: 'Environnement matériel et logiciel de l\'informatique, second semestre',
      color: '#64748b',
      coefficient: 3
    }
  },
  {
    name: 'Programmation I',
    code: 'PROG1_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Programmation I', en: 'Programming I' },
      description: 'Introduction aux concepts fondamentaux de la programmation',
      color: '#0ea5e9',
      coefficient: 4
    }
  },
  {
    name: 'Formation bilingue',
    code: 'FORM_BILI_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Formation bilingue', en: 'Bilingual Training' },
      description: 'Renforcement des compétences en français et en anglais',
      color: '#ec4899',
      coefficient: 2
    }
  },

  // --- CMN — E-Commerce & Marketing Numérique ---
  {
    name: 'Programmation orientée objet (BTS)',
    code: 'POO_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Programmation orientée objet', en: 'Object-Oriented Programming' },
      description: 'Concepts de la POO : classes, héritage, polymorphisme, encapsulation',
      color: '#8b5cf6',
      coefficient: 4
    }
  },
  {
    name: 'Economie des TIC',
    code: 'ECO_TIC_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Economie des TIC', en: 'ICT Economics' },
      description: 'Économie numérique, marchés des technologies de l\'information et de la communication',
      color: '#22c55e',
      coefficient: 3
    }
  },
  {
    name: 'Réglementation juridique / Négociations',
    code: 'REGL_JUR_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Réglementation juridique / Négociations', en: 'Legal Regulations & Negotiations' },
      description: 'Cadre juridique du numérique et techniques de négociation',
      color: '#dc2626',
      coefficient: 3
    }
  },
  {
    name: 'Mathématiques pour l\'informatique II',
    code: 'MATH_INFO2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Mathématiques pour l\'informatique II', en: 'Mathematics for Computer Science II' },
      description: 'Mathématiques appliquées à l\'informatique : logique, graphes, combinatoire',
      color: '#3b82f6',
      coefficient: 3
    }
  },
  {
    name: 'Initiation à l\'outil informatique II',
    code: 'INIT_INFO2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Initiation à l\'outil informatique II', en: 'Introduction to Computing Tools II' },
      description: 'Maîtrise des outils bureautiques et informatiques de base, second semestre',
      color: '#14b8a6',
      coefficient: 2
    }
  },
  {
    name: 'Management et stratégie de l\'entreprise',
    code: 'MGMT_STRAT_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Management et stratégie de l\'entreprise', en: 'Business Management & Strategy' },
      description: 'Stratégie d\'entreprise, organisation, leadership et management des équipes',
      color: '#059669',
      coefficient: 3
    }
  },

  // --- GLT — Gestion Logistique et Transport ---
  {
    name: 'Mathématiques et informatique II',
    code: 'MATH_INFO_II_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Mathématiques et informatique II', en: 'Mathematics & IT II' },
      description: 'Mathématiques et outils informatiques appliqués à la logistique, second semestre',
      color: '#3b82f6',
      coefficient: 3
    }
  },
  {
    name: 'Techniques quantitatives de gestion II',
    code: 'TECH_QUANT2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Techniques quantitatives de gestion II', en: 'Quantitative Management Techniques II' },
      description: 'Statistiques appliquées, recherche opérationnelle et aide à la décision',
      color: '#6366f1',
      coefficient: 3
    }
  },
  {
    name: 'Méthodologie et Marketing II',
    code: 'METHOD_MKT2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Méthodologie et Marketing II', en: 'Methodology & Marketing II' },
      description: 'Méthodologie de travail et marketing appliqué au transport et à la logistique',
      color: '#f97316',
      coefficient: 3
    }
  },
  {
    name: 'Chaînes de transport ferroviaire et routier II',
    code: 'TRANSP_FER2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Chaînes de transport ferroviaire et routier II', en: 'Rail & Road Transport Chains II' },
      description: 'Organisation et gestion des chaînes de transport terrestre, second semestre',
      color: '#b45309',
      coefficient: 4
    }
  },
  {
    name: 'Initiation à la logistique et comptabilité II',
    code: 'INIT_LOG_COMPTA2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Initiation à la logistique et comptabilité II', en: 'Introduction to Logistics & Accounting II' },
      description: 'Principes de la logistique et comptabilité appliquée, second semestre',
      color: '#0891b2',
      coefficient: 4
    }
  },
  {
    name: 'Chaînes de transport aérien, maritime et fluvial II',
    code: 'TRANSP_AIR2_BTS',
    subjectType: 'UE',
    metadata: {
      displayName: { fr: 'Chaînes de transport aérien, maritime et fluvial II', en: 'Air, Sea & River Transport Chains II' },
      description: 'Organisation des chaînes de transport multimodal : aérien, maritime, fluvial',
      color: '#2563eb',
      coefficient: 4
    }
  },
]

async function run() {
  console.log('Connexion à la base de données...')
  await mongoose.connect(DATABASE_URL)
  console.log('Connecté.\n')

  // Récupérer les IDs BTS/HND
  const btsLevels = await EducationLevel.find({ cycle: 'BTS_HND' }, { _id: 1 })
  const btsLevelIds = btsLevels.map(l => l._id)
  console.log(`Niveaux BTS/HND trouvés : ${btsLevelIds.length}\n`)

  let added = 0
  let skipped = 0

  for (const subjectDef of NEW_SUBJECTS) {
    const doc = {
      ...subjectDef,
      subSystem: 'BILINGUAL',
      applicableLevels: btsLevelIds,
      applicableFields: [],
      isTransversal: false,
      isActive: true
    }

    const result = await Subject.findOneAndUpdate(
      { code: doc.code },
      { $setOnInsert: doc },
      { upsert: true, new: true, rawResult: true }
    )

    if (result.lastErrorObject?.updatedExisting === false) {
      console.log(`  ✅ Ajoutée   : ${doc.name}`)
      added++
    } else {
      console.log(`  ⏭️  Existante  : ${doc.name} — ignorée`)
      skipped++
    }
  }

  console.log(`\n─────────────────────────────────────`)
  console.log(`Résultat : ${added} ajoutée(s), ${skipped} déjà présente(s)`)
  console.log(`Total matières traitées : ${NEW_SUBJECTS.length}`)

  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Erreur :', err.message)
  process.exit(1)
})
