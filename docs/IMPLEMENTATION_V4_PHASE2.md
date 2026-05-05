# ✅ Implémentation V4 - Phase 2 : Backend API

## 📋 Résumé

Phase 2 de la refonte du système de création d'examens. Cette phase implémente les services et routes API qui exposent l'infrastructure V4 créée en Phase 1.

---

## 🆕 Services créés

### 1. `ExamServiceV4`

**Fichier** : `/src/lib/services/ExamServiceV4.ts`

**Responsabilités** :
- Gestion des templates d'examens
- Workflow progressif de création (builder pattern)
- Gestion des brouillons avec auto-save
- Validation contextuelle à chaque étape
- Publication d'examens

**Méthodes principales** :

```typescript
// Templates
ExamServiceV4.listTemplates(options?)
ExamServiceV4.getTemplate(templateId)

// Workflow de création
ExamServiceV4.initialize(dto, createdById)
ExamServiceV4.updateContext(draftId, dto)
ExamServiceV4.updateTarget(draftId, dto)
ExamServiceV4.updateTiming(draftId, dto)
ExamServiceV4.updateMetadata(draftId, dto)
ExamServiceV4.validate(draftId)
ExamServiceV4.publish(draftId)

// Gestion brouillons
ExamServiceV4.saveDraft(draftId)
ExamServiceV4.resumeDraft(draftId, userId)
ExamServiceV4.deleteDraft(draftId, userId)
ExamServiceV4.listDrafts(userId)
ExamServiceV4.cleanupOldDrafts() // CRON job
```

**Fonctionnalités clés** :

1. **Cache en mémoire des brouillons**
   - État du builder conservé en RAM pour performance
   - À migrer vers Redis en production

2. **Auto-save automatique**
   - Sauvegarde après chaque modification
   - Méthode `autoSave()` privée appelée automatiquement

3. **Reprise de brouillons**
   - Reconstitution du builder depuis un examen sauvegardé
   - Validation de l'ownership (sécurité)

4. **Nettoyage automatique**
   - Suppression des brouillons >30 jours
   - À exécuter via CRON

### 2. `SelfAssessmentService`

**Fichier** : `/src/lib/services/SelfAssessmentService.ts`

**Responsabilités** :
- Soumission des auto-évaluations
- Génération des cartographies de compétences
- Calcul automatique des recommandations
- Suivi de progression dans le temps
- Analytics pour enseignants

**Méthodes principales** :

```typescript
// Soumission
SelfAssessmentService.submit(dto)

// Cartographie et recommandations
SelfAssessmentService.generateCompetencyMap(resultId)
SelfAssessmentService.generateRecommendations(resultId)

// Historique et profils
SelfAssessmentService.getConceptHistory(studentId, conceptId)
SelfAssessmentService.getStudentProfile(studentId, syllabusId)

// Analytics enseignants
SelfAssessmentService.getClassAnalytics(chapterId, studentIds)

// Comparaison
SelfAssessmentService.compareResults(previousResultId, currentResultId)
```

**Fonctionnalités clés** :

1. **Validation stricte**
   - Vérification que l'examen est de type SELF_ASSESSMENT
   - Vérification que tous les concepts requis sont évalués
   - Détermination automatique du numéro de tentative

2. **Cartographie automatique**
   - Groupement des concepts par niveau de maîtrise :
     - 🌟 Points forts (5-6)
     - ⚠️ En cours (3-4)
     - ❌ Lacunes (1-2)
     - ❓ Inconnus (0)

3. **Recommandations personnalisées**
   - Messages adaptatifs selon le score global
   - Identification des concepts à retravailler
   - Évaluation de la préparation pour le chapitre suivant
   - Critère : ≥70% des concepts au niveau 4+

4. **Analytics enseignants**
   - Distribution par concept pour toute la classe
   - Identification des concepts difficiles (moyenne <3.5)
   - Nombre d'élèves en difficulté par concept
   - Dernière tentative de chaque élève uniquement

5. **Comparaison de progression**
   - Évolution du score global
   - Progression concept par concept
   - Classification : amélioré, stagnant, régressé

---

## 🛣️ Routes API créées

### Templates

#### `GET /api/exams/v4/templates`

Lister tous les templates disponibles (avec filtrage optionnel par catégorie).

**Query params** :
- `category?`: 'DIAGNOSTIC' | 'FORMATIVE' | 'SUMMATIVE' | 'SPECIAL' | 'COMPETITION' | 'ADAPTIVE'

**Response** :
```json
{
  "success": true,
  "data": [
    {
      "id": "self-assessment",
      "examType": "SELF_ASSESSMENT",
      "name": "Auto-évaluation",
      "description": "...",
      "category": "FORMATIVE",
      "defaultConfig": { ... },
      "recommendations": { ... }
    }
  ],
  "count": 20
}
```

#### `GET /api/exams/v4/templates/:id`

Obtenir un template spécifique par ID.

**Response** :
```json
{
  "success": true,
  "data": { /* ExamTemplate */ }
}
```

### Workflow de création

#### `POST /api/exams/v4/initialize`

Initialiser un nouveau builder avec un template.

**Body** :
```json
{
  "templateId": "self-assessment",
  "title": "Auto-évaluation : Chapitre 3",
  "description": "..."
}
```

**Response** :
```json
{
  "success": true,
  "data": {
    "draftId": "64abc...",
    "template": { /* ExamTemplate */ }
  }
}
```

#### `PUT /api/exams/v4/:draftId/context`

Mettre à jour le contexte (école + niveaux).

**Body** :
```json
{
  "schoolId": "64def...",
  "classId": "64ghi...",
  "targetLevelIds": ["64jkl..."]
}
```

**Response** :
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": ["..."]
  }
}
```

#### `PUT /api/exams/v4/:draftId/target`

Mettre à jour la cible pédagogique.

**Body** :
```json
{
  "subjectId": "64mno...",
  "syllabusId": "64pqr...",
  "learningUnitIds": ["64stu...", "64vwx..."],
  "chapterWeights": [
    { "learningUnit": "64stu...", "weight": 50 },
    { "learningUnit": "64vwx...", "weight": 50 }
  ],
  "linkedConceptIds": ["64yza..."]
}
```

#### `PUT /api/exams/v4/:draftId/timing`

Mettre à jour le timing.

**Body** :
```json
{
  "startTime": "2026-04-10T08:00:00Z",
  "endTime": "2026-04-17T23:59:59Z",
  "duration": 15
}
```

#### `PUT /api/exams/v4/:draftId/metadata`

Mettre à jour les métadonnées.

**Body** :
```json
{
  "title": "Auto-évaluation : Chapitre 3",
  "description": "...",
  "imageUrl": "https://...",
  "tags": ["math", "integrales"]
}
```

#### `POST /api/exams/v4/:draftId/validate`

Valider un brouillon complet.

**Response** :
```json
{
  "success": true,
  "validation": {
    "valid": false,
    "errors": [
      "La date de fin doit être après la date de début"
    ],
    "warnings": [
      "La durée semble courte pour un Examen final"
    ]
  }
}
```

#### `POST /api/exams/v4/:draftId/publish`

Publier un examen (le rendre actif).

**Response** :
```json
{
  "success": true,
  "data": { /* IExam publié */ }
}
```

### Gestion des brouillons

#### `GET /api/exams/v4/drafts`

Lister les brouillons de l'utilisateur.

**Response** :
```json
{
  "success": true,
  "data": [ /* IExam[] */ ],
  "count": 3
}
```

#### `POST /api/exams/v4/:draftId/resume`

Reprendre un brouillon existant.

**Response** :
```json
{
  "success": true,
  "data": {
    "exam": { /* IExam */ },
    "validation": { /* ValidationResult */ }
  }
}
```

#### `DELETE /api/exams/v4/:draftId`

Supprimer un brouillon.

**Response** :
```json
{
  "success": true,
  "message": "Brouillon supprimé avec succès"
}
```

### Auto-évaluations

#### `POST /api/self-assessments/submit`

Soumettre une auto-évaluation.

**Body** :
```json
{
  "examId": "64abc...",
  "conceptAssessments": [
    { "conceptId": "64def...", "level": 6 },
    { "conceptId": "64ghi...", "level": 4 },
    { "conceptId": "64jkl...", "level": 3 },
    { "conceptId": "64mno...", "level": 2 }
  ]
}
```

**Response** :
```json
{
  "success": true,
  "data": {
    "result": {
      "_id": "64pqr...",
      "overallScore": 3.75,
      "masteredConcepts": 1,
      "inProgressConcepts": 2,
      "strugglingConcepts": 1,
      "unknownConcepts": 0
    },
    "competencyMap": {
      "strongConcepts": [
        { "concept": {...}, "level": 6 }
      ],
      "moderateConcepts": [
        { "concept": {...}, "level": 4 },
        { "concept": {...}, "level": 3 }
      ],
      "weakConcepts": [
        { "concept": {...}, "level": 2 }
      ],
      "unknownConcepts": []
    },
    "recommendations": {
      "conceptsToFocus": ["Théorème fondamental"],
      "nextChapterReady": true,
      "message": "🙂 Bien ! Vous êtes sur la bonne voie..."
    }
  }
}
```

#### `GET /api/self-assessments/profile`

Obtenir le profil global d'un élève.

**Query params** :
- `syllabusId`: string (requis)
- `studentId?`: string (optionnel)

**Response** :
```json
{
  "success": true,
  "data": {
    "student": "64stu...",
    "syllabus": "64vwx...",
    "chapterScores": [
      {
        "chapter": {...},
        "averageLevel": 4.5,
        "strongConcepts": 3,
        "moderateConcepts": 2,
        "weakConcepts": 1,
        "unknownConcepts": 0
      }
    ],
    "overallProgress": {
      "totalConcepts": 15,
      "masteredConcepts": 8,
      "inProgressConcepts": 5,
      "strugglingConcepts": 2,
      "unknownConcepts": 0
    }
  }
}
```

#### `GET /api/self-assessments/concept-history`

Historique de progression sur un concept.

**Query params** :
- `conceptId`: string (requis)
- `studentId?`: string (optionnel)

**Response** :
```json
{
  "success": true,
  "data": [
    { "date": "2026-04-01T...", "level": 2 },
    { "date": "2026-04-07T...", "level": 3 },
    { "date": "2026-04-14T...", "level": 4 }
  ]
}
```

#### `GET /api/self-assessments/class-analytics`

Analytics pour enseignants (vue classe).

**Query params** :
- `chapterId`: string (requis)
- `classId`: string (requis)

**Response** :
```json
{
  "success": true,
  "data": {
    "totalStudents": 25,
    "averageClassScore": 3.8,
    "conceptDifficulty": [
      {
        "concept": {...},
        "averageLevel": 2.5,
        "distribution": {
          "level0": 2,
          "level1": 5,
          "level2": 8,
          "level3": 6,
          "level4": 3,
          "level5": 1,
          "level6": 0
        },
        "studentsStruggling": 13,
        "totalStudents": 25
      }
    ],
    "conceptsNeedingReview": [
      {
        "concept": {...},
        "averageLevel": 2.5,
        "studentsStruggling": 13
      }
    ],
    "studentResults": [...]
  }
}
```

---

## 📊 Statistiques d'implémentation

### Fichiers créés : 17

**Services (2)** :
1. ✅ `/src/lib/services/ExamServiceV4.ts` - 567 lignes
2. ✅ `/src/lib/services/SelfAssessmentService.ts` - 452 lignes

**Routes Examens V4 (11)** :
3. ✅ `/src/app/api/exams/v4/templates/route.ts`
4. ✅ `/src/app/api/exams/v4/templates/[id]/route.ts`
5. ✅ `/src/app/api/exams/v4/initialize/route.ts`
6. ✅ `/src/app/api/exams/v4/[draftId]/context/route.ts`
7. ✅ `/src/app/api/exams/v4/[draftId]/target/route.ts`
8. ✅ `/src/app/api/exams/v4/[draftId]/timing/route.ts`
9. ✅ `/src/app/api/exams/v4/[draftId]/metadata/route.ts`
10. ✅ `/src/app/api/exams/v4/[draftId]/validate/route.ts`
11. ✅ `/src/app/api/exams/v4/[draftId]/publish/route.ts`
12. ✅ `/src/app/api/exams/v4/[draftId]/resume/route.ts`
13. ✅ `/src/app/api/exams/v4/[draftId]/route.ts` (DELETE)
14. ✅ `/src/app/api/exams/v4/drafts/route.ts`

**Routes Auto-évaluations (4)** :
15. ✅ `/src/app/api/self-assessments/submit/route.ts`
16. ✅ `/src/app/api/self-assessments/profile/route.ts`
17. ✅ `/src/app/api/self-assessments/concept-history/route.ts`
18. ✅ `/src/app/api/self-assessments/class-analytics/route.ts`

**Documentation (1)** :
19. ✅ `/docs/IMPLEMENTATION_V4_PHASE2.md` - Ce fichier

**Total** : ~2000+ lignes de code

---

## 🔒 Sécurité implémentée

### 1. Authentification

Toutes les routes nécessitent une authentification via `auth(request)`.

```typescript
const session = await auth(request)
if (!session?.user?.id) {
    return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
    )
}
```

### 2. Vérification d'ownership

Les brouillons ne peuvent être modifiés que par leur créateur.

```typescript
if (exam.createdById.toString() !== userId) {
    throw new Error('Non autorisé : vous n\'êtes pas le créateur de ce brouillon')
}
```

### 3. Validation des entrées

Chaque route valide les paramètres requis.

```typescript
if (!body.templateId) {
    return NextResponse.json(
        { success: false, error: 'Le templateId est requis' },
        { status: 400 }
    )
}
```

### 4. Gestion des erreurs

Catégorisation des erreurs avec codes HTTP appropriés :
- `400` - Validation échouée
- `401` - Non authentifié
- `403` - Permissions insuffisantes
- `404` - Ressource introuvable
- `500` - Erreur serveur

### TODO - Améliorations de sécurité

```typescript
// À implémenter en Phase 3
// 1. Vérification des rôles (TEACHER, SCHOOL_ADMIN)
// 2. Vérification de l'accès aux classes
// 3. Rate limiting
// 4. Sanitization des entrées (XSS, injection)
// 5. Validation des ObjectIds MongoDB
```

---

## ⚡ Performances

### 1. Cache en mémoire

État des builders conservé en RAM pour éviter reconstituions fréquentes.

**Production** : À migrer vers Redis pour supporter multi-instances.

### 2. Denormalization

Statistiques pré-calculées dans `SelfAssessmentResult` :
- `overallScore`
- `masteredConcepts`, `inProgressConcepts`, etc.
- Calcul automatique via pre-save hook

### 3. Index MongoDB

Tous les index nécessaires définis dans les modèles (Phase 1).

### 4. Auto-save intelligent

Sauvegarde après modification, mais sans bloquer l'utilisateur (erreurs loggées uniquement).

---

## 🧪 Exemples d'utilisation

### Workflow complet : Créer une auto-évaluation

```typescript
// 1. Lister les templates
GET /api/exams/v4/templates?category=FORMATIVE
// → Retourne self-assessment, formative-quiz, etc.

// 2. Initialiser avec le template
POST /api/exams/v4/initialize
Body: {
  "templateId": "self-assessment",
  "title": "Auto-évaluation : Chapitre 3"
}
// → Retourne { draftId: "64abc..." }

// 3. Définir le contexte
PUT /api/exams/v4/64abc.../context
Body: {
  "schoolId": "64def...",
  "targetLevelIds": ["64ghi..."]
}
// → Auto-save + validation

// 4. Définir la cible
PUT /api/exams/v4/64abc.../target
Body: {
  "subjectId": "64jkl...",
  "syllabusId": "64mno...",
  "learningUnitIds": ["64pqr..."],
  "linkedConceptIds": ["64stu...", "64vwx...", "64yza..."]
}

// 5. Définir le timing
PUT /api/exams/v4/64abc.../timing
Body: {
  "startTime": "2026-04-10T08:00:00Z",
  "endTime": "2026-04-17T23:59:59Z",
  "duration": 15
}

// 6. Validation finale
POST /api/exams/v4/64abc.../validate
// → Retourne { valid: true, errors: [], warnings: [] }

// 7. Publication
POST /api/exams/v4/64abc.../publish
// → Retourne l'examen publié

// 8. Élève soumet son auto-évaluation
POST /api/self-assessments/submit
Body: {
  "examId": "64abc...",
  "conceptAssessments": [
    { "conceptId": "64stu...", "level": 6 },
    { "conceptId": "64vwx...", "level": 4 },
    { "conceptId": "64yza...", "level": 2 }
  ]
}
// → Retourne cartographie + recommandations

// 9. Enseignant consulte les analytics
GET /api/self-assessments/class-analytics?chapterId=64pqr...&classId=64def...
// → Vue globale de la classe
```

### Reprendre un brouillon

```typescript
// 1. Lister ses brouillons
GET /api/exams/v4/drafts

// 2. Reprendre un brouillon spécifique
POST /api/exams/v4/64abc.../resume
// → Reconstitue le builder avec toutes les données

// 3. Continuer l'édition
PUT /api/exams/v4/64abc.../timing
// ...

// 4. Publier
POST /api/exams/v4/64abc.../publish
```

---

## 📝 Notes importantes

### Dépendances système d'authentification

Les routes utilisent `@/lib/auth` qui doit être fourni par le projet.

```typescript
import { auth } from '@/lib/auth'

const session = await auth(request)
// session.user.id
// session.user.role (TODO)
```

**À adapter selon votre système** : NextAuth, Supabase, JWT custom, etc.

### Migration des données V3 → V4

Les examens V3 existants **ne sont pas affectés**.

Pour migrer progressivement :
1. Flag `createdWithV4: boolean` identifie la version
2. Frontend détecte et utilise l'API appropriée
3. Option "Migrer vers V4" dans l'interface (Phase 3)

### CRON Job recommandé

```typescript
// Nettoyer les brouillons anciens
// Exécuter tous les jours à 2h du matin
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'

cron.schedule('0 2 * * *', async () => {
    const deleted = await ExamServiceV4.cleanupOldDrafts()
    console.log(`${deleted} brouillons supprimés`)
})
```

---

## 🎯 Prochaines étapes (Phase 3)

### Frontend
- [ ] Wizard UI avec 6 étapes
- [ ] Composant de sélection de template (cards)
- [ ] Auto-save indicator
- [ ] Validation temps réel avec affichage des erreurs
- [ ] Interface d'auto-évaluation (7 niveaux avec emojis)
- [ ] Dashboard analytics pour enseignants
- [ ] Graphiques de progression (Chart.js/Recharts)

### Tests
- [ ] Tests unitaires des services
  - `ExamServiceV4.spec.ts`
  - `SelfAssessmentService.spec.ts`
- [ ] Tests d'intégration des routes
  - Workflow complet de création
  - Soumission auto-évaluation
- [ ] Tests E2E (Playwright)
  - Parcours utilisateur complet

### Optimisations
- [ ] Migration cache vers Redis
- [ ] Pagination des listes (drafts, analytics)
- [ ] Compression des réponses API (gzip)
- [ ] Rate limiting par endpoint
- [ ] Monitoring et métriques (Prometheus)

---

**Date d'implémentation** : 2026-04-06
**Version** : V4 Phase 2
**Statut** : ✅ Complétée
