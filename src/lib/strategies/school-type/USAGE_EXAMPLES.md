# 📘 Exemples d'Usage des Stratégies de Type d'École

Ce document présente tous les cas d'usage possibles des stratégies de type d'école, avec des exemples de code concrets.

---

## 🎯 Cas d'Usage Principaux

### 1. Professeur Affilié à une École

**Contexte** : Le professeur fait partie d'une école enregistrée dans le système.

```typescript
import { SchoolTypeStrategyContext } from '@/lib/strategies/school-type'

// Récupérer la stratégie depuis l'école du professeur
const teacherSchoolId = user.schoolId // ID de l'école MongoDB

const context = await SchoolTypeStrategyContext.fromSchoolId(teacherSchoolId)

// Obtenir la configuration par défaut
const config = context.getDefaultConfig()

console.log(config)
// {
//   defaultDuration: 90,
//   recommendedQuestionCount: 25,
//   passingScore: 50,
//   allowedEvaluationTypes: [QCM, OPEN_QUESTION, ADAPTIVE, EXAM_SIMULATION],
//   ...
// }
```

---

### 2. Professeur en Mode Classe Libre (Sans École)

**Contexte** : Le professeur n'est pas affilié à une école, mais sélectionne des niveaux éducatifs.

```typescript
import { SchoolTypeStrategyContext } from '@/lib/strategies/school-type'

// Le professeur sélectionne des niveaux (ex: 6ème, 5ème)
const targetLevelIds = ['level_6eme_id', 'level_5eme_id']

// Déduire automatiquement le type d'école depuis les niveaux
const context = await SchoolTypeStrategyContext.fromTargetLevels(targetLevelIds)

console.log(context.getSchoolType()) // "SECONDARY"
console.log(context.getLevelName()) // "École Secondaire"

// Obtenir la terminologie adaptée
const terminology = context.getTerminology()

console.log(terminology.examLabel) // "Examen"
console.log(terminology.studentLabel) // "Élève"
console.log(terminology.gradingScale) // "sur 20"
```

---

### 3. Détection Automatique selon le Contexte

**Contexte** : On ne sait pas à l'avance si le professeur a une école ou non.

```typescript
import { SchoolTypeStrategyContext } from '@/lib/strategies/school-type'

// Fonction générique qui gère tous les cas
async function getExamStrategy(user, targetLevelIds) {
    return await SchoolTypeStrategyContext.fromContext({
        schoolId: user.schoolId, // Peut être null/undefined
        targetLevelIds: targetLevelIds // Peut être vide
    })
}

// Cas 1 : Professeur avec école
const context1 = await getExamStrategy(
    { schoolId: 'school123' },
    []
)
// → Utilise le type de l'école

// Cas 2 : Professeur sans école, avec niveaux
const context2 = await getExamStrategy(
    { schoolId: null },
    ['cp1_id', 'ce1_id']
)
// → Déduit PRIMARY depuis les niveaux

// Cas 3 : Aucune information disponible
const context3 = await getExamStrategy(
    { schoolId: null },
    []
)
// → Utilise SECONDARY par défaut
```

---

### 4. Validation d'un Examen

**Contexte** : Valider un examen avant création.

```typescript
import { SchoolTypeStrategyContext } from '@/lib/strategies/school-type'
import { EvaluationType } from '@/models/enums'

const context = await SchoolTypeStrategyContext.fromTargetLevels([
    'cp1_id', 'ce1_id' // Primaire
])

const validation = context.validateExam({
    duration: 60,
    questionCount: 30,
    evaluationType: EvaluationType.ADAPTIVE, // ❌ Interdit en primaire
    passingScore: 50,
    targetLevelIds: ['cp1_id', 'ce1_id']
})

if (!validation.isValid) {
    console.error('Erreurs bloquantes:', validation.errors)
    // ["Les examens adaptatifs ne sont pas disponibles pour le primaire."]
}

if (validation.warnings.length > 0) {
    console.warn('Avertissements:', validation.warnings)
    // ["30 questions risquent de fatiguer les élèves. Nombre recommandé : 12 questions."]
}
```

---

### 5. Suggestions de Configuration

**Contexte** : Obtenir des suggestions selon le type d'évaluation.

```typescript
const context = await SchoolTypeStrategyContext.fromSchoolType(SchoolType.HIGHER_ED)

const suggestions = context.getConfigSuggestions(EvaluationType.OPEN_QUESTION)

console.log(suggestions)
// {
//   duration: 180,
//   questionCount: 6,
//   passingScore: 50,
//   rationale: "Questions ouvertes type dissertation universitaire : 6 questions en 3 heures. Les étudiants ont environ 30 minutes par question pour développer."
// }
```

---

### 6. Suggestion de Type d'École avec Confiance

**Contexte** : Afficher une suggestion au professeur dans l'UI.

```typescript
import { suggestSchoolType } from '@/lib/strategies/school-type'

// Le professeur a sélectionné des niveaux
const targetLevelIds = ['6eme_id', '5eme_id', 'cp1_id'] // Mix !

const suggestion = await suggestSchoolType(targetLevelIds)

console.log(suggestion)
// {
//   schoolType: "SECONDARY",
//   confidence: "MEDIUM",
//   explanation: "Mix de niveaux détecté. Type SECONDARY suggéré car 2/3 niveaux correspondent."
// }

// Afficher dans l'UI
if (suggestion.confidence === 'MEDIUM' || suggestion.confidence === 'LOW') {
    // Afficher un avertissement
    alert(`⚠️ ${suggestion.explanation}. Voulez-vous continuer ?`)
}
```

---

### 7. Vérifier la Compatibilité d'un Niveau

**Contexte** : S'assurer qu'un niveau éducatif est compatible avec le type d'examen.

```typescript
import { isSchoolTypeCompatibleWithLevels } from '@/lib/strategies/school-type'

const schoolType = SchoolType.PRIMARY
const targetLevelIds = ['6eme_id', '5eme_id'] // Secondaire

const isCompatible = await isSchoolTypeCompatibleWithLevels(
    schoolType,
    targetLevelIds
)

console.log(isCompatible) // false

if (!isCompatible) {
    throw new Error('Les niveaux sélectionnés ne correspondent pas au type d\'école PRIMARY.')
}
```

---

### 8. Calculer la Difficulté Recommandée

**Contexte** : Suggérer un score de difficulté selon le niveau et les concepts.

```typescript
const context = await SchoolTypeStrategyContext.fromSchoolType(SchoolType.SECONDARY)

const difficulty = context.calculateRecommendedDifficulty(
    ['6eme_id', '5eme_id'], // Niveaux ciblés
    8 // Nombre de concepts à évaluer
)

console.log(difficulty) // 87 (sur 100 - difficile)

// Mapper sur un label
function getDifficultyLabel(score: number): string {
    if (score < 40) return 'Facile'
    if (score < 60) return 'Moyen'
    if (score < 80) return 'Difficile'
    return 'Très difficile'
}

console.log(getDifficultyLabel(difficulty)) // "Très difficile"
```

---

### 9. Obtenir les Fonctionnalités Disponibles

**Contexte** : Adapter l'UI selon les fonctionnalités du niveau.

```typescript
const context = await SchoolTypeStrategyContext.fromSchoolType(SchoolType.HIGHER_ED)

const features = context.getFeatureAvailability()

console.log(features)
// {
//   qrCodeAccess: true,
//   preExamReview: true,
//   advancedStats: true,
//   conceptAnalysis: true,
//   classComparison: true,
//   personalizedRecommendations: true,
//   resultsExport: true,
//   gradingSystemIntegration: true,
//   certification: true,
//   plagiarismDetection: true,  ✅ Uniquement supérieur
//   proctoredSessions: true      ✅ Uniquement supérieur
// }

// Adapter l'UI
if (features.plagiarismDetection) {
    // Afficher l'option "Détection de plagiat"
}

if (!features.certification) {
    // Masquer l'option "Générer un certificat"
}
```

---

### 10. Exemple Complet : Service de Création d'Examen

**Contexte** : Service backend qui crée un examen avec stratégies.

```typescript
import { SchoolTypeStrategyContext, deduceSchoolTypeFromLevels } from '@/lib/strategies/school-type'
import Exam from '@/models/Exam'
import { EvaluationType } from '@/models/enums'

class ExamServiceV3 {
    /**
     * Créer un examen avec stratégies adaptées
     */
    async createExam(input: {
        title: string
        teacherId: string
        schoolId?: string // Peut être null pour mode classe libre
        targetLevelIds: string[]
        evaluationType: EvaluationType
        // ... autres champs
    }) {
        // 1. Obtenir la stratégie selon le contexte
        const context = await SchoolTypeStrategyContext.fromContext({
            schoolId: input.schoolId,
            targetLevelIds: input.targetLevelIds
        })

        // 2. Obtenir la configuration par défaut
        const defaultConfig = context.getDefaultConfig()

        // 3. Valider l'examen
        const validation = context.validateExam({
            duration: input.duration || defaultConfig.defaultDuration,
            questionCount: input.questionCount || defaultConfig.recommendedQuestionCount,
            evaluationType: input.evaluationType,
            passingScore: input.passingScore || defaultConfig.passingScore,
            targetLevelIds: input.targetLevelIds
        })

        if (!validation.isValid) {
            throw new Error(`Validation échouée: ${validation.errors.join(', ')}`)
        }

        // 4. Déduire et sauvegarder le schoolType
        const schoolType = await deduceSchoolTypeFromLevels(input.targetLevelIds)

        // 5. Créer l'examen avec la config adaptée
        const exam = await Exam.create({
            title: input.title,
            schoolType, // ✅ Sauvegardé automatiquement
            targetLevels: input.targetLevelIds,
            evaluationType: input.evaluationType,
            duration: input.duration || defaultConfig.defaultDuration,
            config: {
                shuffleQuestions: defaultConfig.shuffleByDefault,
                showResultsImmediately: defaultConfig.showResultsImmediately,
                passingScore: input.passingScore || defaultConfig.passingScore,
                // ... autres configs
            },
            createdById: input.teacherId,
            // ... autres champs
        })

        // 6. Logger les avertissements (non bloquants)
        if (validation.warnings.length > 0) {
            console.warn('Avertissements:', validation.warnings)
        }

        return exam
    }

    /**
     * Obtenir la configuration par défaut selon le contexte
     */
    async getDefaultConfig(schoolId?: string, targetLevelIds?: string[]) {
        const context = await SchoolTypeStrategyContext.fromContext({
            schoolId,
            targetLevelIds
        })

        return {
            ...context.getDefaultConfig(),
            terminology: context.getTerminology(),
            features: context.getFeatureAvailability()
        }
    }
}

export default new ExamServiceV3()
```

---

### 11. Exemple Frontend : Formulaire de Création d'Examen

**Contexte** : Adapter l'UI selon le type d'école détecté.

```typescript
// React Component
import { useState, useEffect } from 'react'
import { suggestSchoolType, getSchoolTypeLabel } from '@/lib/strategies/school-type'

export function ExamCreationForm({ user }) {
    const [targetLevels, setTargetLevels] = useState([])
    const [suggestion, setSuggestion] = useState(null)

    useEffect(() => {
        if (targetLevels.length > 0) {
            // Détecter automatiquement le type d'école
            suggestSchoolType(targetLevels).then(setSuggestion)
        }
    }, [targetLevels])

    return (
        <div>
            <h2>Créer un examen</h2>

            {/* Afficher la suggestion */}
            {suggestion && (
                <div className={`alert alert-${suggestion.confidence === 'HIGH' ? 'success' : 'warning'}`}>
                    <strong>{getSchoolTypeLabel(suggestion.schoolType)}</strong>
                    <p>{suggestion.explanation}</p>
                    {suggestion.confidence === 'MEDIUM' && (
                        <p>⚠️ Vérifiez que les niveaux sélectionnés correspondent bien à votre cible.</p>
                    )}
                </div>
            )}

            {/* Sélection des niveaux */}
            <EducationLevelSelector
                value={targetLevels}
                onChange={setTargetLevels}
            />

            {/* Adapter le formulaire selon le type détecté */}
            {suggestion?.schoolType === 'HIGHER_ED' && (
                <div>
                    {/* Options spécifiques au supérieur */}
                    <label>
                        <input type="checkbox" />
                        Activer la détection de plagiat
                    </label>
                    <label>
                        <input type="checkbox" />
                        Session surveillée à distance
                    </label>
                </div>
            )}

            {suggestion?.schoolType === 'PRIMARY' && (
                <div>
                    {/* Masquer les options complexes */}
                    <p className="info">
                        ℹ️ Pour les élèves de primaire, les examens adaptatifs ne sont pas disponibles.
                    </p>
                </div>
            )}
        </div>
    )
}
```

---

## 🔑 Points Clés

### 1. Ordre de Priorité

```typescript
SchoolTypeStrategyContext.fromContext({
    schoolId,      // Priorité 1 : École affiliée
    targetLevelIds // Priorité 2 : Déduction depuis niveaux
})
// Priorité 3 : SECONDARY par défaut si aucune information
```

### 2. Validation Automatique

Toutes les stratégies incluent des validations adaptées au niveau :
- **Primaire** : Examens courts, QCM simples, pas d'adaptatif
- **Secondaire** : Examens moyens à longs, tous types d'évaluation
- **Supérieur** : Examens longs, plagiat detection, sessions surveillées

### 3. Rétrocompatibilité

Les examens existants sans `schoolType` continueront de fonctionner :
- Le champ est **optionnel** dans le modèle
- Le service déduit automatiquement le type depuis les `targetLevels`
- Le script de migration peuple les données existantes

---

## 📚 Ressources

- **Interface** : `src/lib/strategies/school-type/ISchoolTypeStrategy.ts`
- **Stratégies** : `src/lib/strategies/school-type/{Primary,Secondary,HigherEd}ExamStrategy.ts`
- **Contexte** : `src/lib/strategies/school-type/SchoolTypeStrategyContext.ts`
- **Détecteur** : `src/lib/strategies/school-type/SchoolTypeDetector.ts`
- **Documentation** : `IMPLEMENTATION_SCHOOL_TYPE_STRATEGIES.md`

---

*Document généré le 2026-04-06 par Claude Code*
