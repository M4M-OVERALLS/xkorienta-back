/**
 * Migration : Ajout des matières manquantes — BTS Informatique / Commercial
 * Matières ajoutées :
 *   - Négociation Informatique
 *   - Programmation Évènementielle
 *   - Négociation Commerciale
 *   - Système d'Exploitation
 *   - Installation et Maintenance Matériels et Logiciels
 *
 * Ce script est idempotent (upsert) : peut être relancé sans risque de duplication.
 */
const mongoose = require('mongoose')
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/qcmapp'

// --- Schémas minimaux ---
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
  name: String,
  code: { type: String, unique: true },
  cycle: String,
  schoolType: String,
  subSystem: String,
  order: Number,
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

const Subject = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema)
const EducationLevel = mongoose.models.EducationLevel || mongoose.model('EducationLevel', EducationLevelSchema)

// --- Matières à ajouter ---
const NEW_SUBJECTS = [
  {
    name: 'Négociation Informatique',
    code: 'NEG_INFO_BTS',
    subSystem: 'BILINGUAL',
    subjectType: 'UE',
    cycle_filter: 'BTS_HND',
    metadata: {
      displayName: {
        fr: 'Négociation Informatique',
        en: 'IT Negotiation'
      },
      description: 'Techniques de négociation appliquées au domaine informatique',
      color: '#6366f1',
      coefficient: 3
    }
  },
  {
    name: 'Programmation Évènementielle',
    code: 'PROG_EVENT_BTS',
    subSystem: 'BILINGUAL',
    subjectType: 'UE',
    cycle_filter: 'BTS_HND',
    metadata: {
      displayName: {
        fr: 'Programmation Évènementielle',
        en: 'Event-Driven Programming'
      },
      description: 'Développement d\'applications basées sur la gestion des événements',
      color: '#8b5cf6',
      coefficient: 4
    }
  },
  {
    name: 'Négociation Commerciale',
    code: 'NEG_COM_BTS',
    subSystem: 'BILINGUAL',
    subjectType: 'UE',
    cycle_filter: 'BTS_HND',
    metadata: {
      displayName: {
        fr: 'Négociation Commerciale',
        en: 'Commercial Negotiation'
      },
      description: 'Techniques et stratégies de négociation commerciale',
      color: '#ec4899',
      coefficient: 3
    }
  },
  {
    name: "Système d'Exploitation",
    code: 'SYS_EXP_BTS',
    subSystem: 'BILINGUAL',
    subjectType: 'UE',
    cycle_filter: 'BTS_HND',
    metadata: {
      displayName: {
        fr: "Système d'Exploitation",
        en: 'Operating Systems'
      },
      description: "Principes et administration des systèmes d'exploitation",
      color: '#14b8a6',
      coefficient: 4
    }
  },
  {
    name: 'Installation et Maintenance Matériels et Logiciels',
    code: 'INSTALL_MAINT_BTS',
    subSystem: 'BILINGUAL',
    subjectType: 'UE',
    cycle_filter: 'BTS_HND',
    metadata: {
      displayName: {
        fr: 'Installation et Maintenance Matériels et Logiciels',
        en: 'Hardware and Software Installation & Maintenance'
      },
      description: 'Installation, configuration et maintenance des équipements informatiques',
      color: '#f59e0b',
      coefficient: 4
    }
  }
]

async function run() {
  console.log('Connexion à la base de données...')
  await mongoose.connect(DATABASE_URL)
  console.log('Connecté.')

  // Récupérer les IDs des niveaux BTS/HND
  const btsLevels = await EducationLevel.find({ cycle: 'BTS_HND' }, { _id: 1 })
  const btsLevelIds = btsLevels.map(l => l._id)
  console.log(`Niveaux BTS/HND trouvés : ${btsLevelIds.length}`)

  if (btsLevelIds.length === 0) {
    console.warn('Aucun niveau BTS_HND trouvé en base. Les matières seront ajoutées sans niveau associé.')
  }

  let added = 0
  let skipped = 0

  for (const subjectDef of NEW_SUBJECTS) {
    const { cycle_filter, ...data } = subjectDef
    const doc = {
      ...data,
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
      console.log(`  ✅ Ajoutée   : ${doc.name} (${doc.code})`)
      added++
    } else {
      console.log(`  ⏭️  Existante  : ${doc.name} (${doc.code}) — ignorée`)
      skipped++
    }
  }

  console.log(`\nTerminé. ${added} matière(s) ajoutée(s), ${skipped} déjà existante(s).`)
  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Erreur :', err.message)
  process.exit(1)
})
