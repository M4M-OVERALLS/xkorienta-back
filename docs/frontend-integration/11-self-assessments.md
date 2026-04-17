# Module 11 — Self-Assessment (Auto-Évaluation)

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token` (Rôles : `STUDENT`, `TEACHER`)

---

## Vue d'ensemble

L'auto-évaluation permet à l'élève, à la fin d'un examen, d'évaluer son niveau de maîtrise sur les concepts liés à ce chapitre. Le système va ainsi mapper ses compétences (Fort, Modéré, Faible, Inconnu) et lui donner des recommandations. Les enseignants peuvent également consulter les statistiques de la classe.

### Niveaux de Maîtrise (`SelfAssessmentLevel` : 0 à 6)

| Niveau | Mapping | Description probable |
|--------|---------|----------------------|
| `0` | Inconnu | Je ne sais pas |
| `1` | Faible | Totalement incapable |
| `2` | Faible | Incapable même avec de l'aide |
| `3` | Modéré | Incapable sans aide |
| `4` | Modéré | Capable avec aide |
| `5` | Fort | Capable seul |
| `6` | Fort | Parfaitement capable |

---

## Endpoints Étudiant

### 1. Soumettre une auto-évaluation (Examen)

```
POST /api/self-assessments/submit
```

**Auth requise** : Oui (`STUDENT`)

> Enregistre l'auto-évaluation globale pour un examen de type `SELF_ASSESSMENT`. Génère une carte de compétences et des recommandations.

#### Corps de la requête

```json
{
  "examId": "507f1f77bcf86cd799447000",
  "conceptAssessments": [
    {
      "conceptId": "507f1f77bcf86cd799447001",
      "level": 4
    },
    {
      "conceptId": "507f1f77bcf86cd799447002",
      "level": 1
    }
  ]
}
```

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "result": {
      "_id": "...",
      "exam": "507f1f77bcf86cd799447000",
      "attemptNumber": 1,
      "overallScore": 3.4
    },
    "competencyMap": {
      "strongConcepts": [],
      "moderateConcepts": [
        { "concept": { "_id": "...", "title": "Lois de Newton" }, "level": 4 }
      ],
      "weakConcepts": [
        { "concept": { "_id": "...", "title": "Frottements" }, "level": 1 }
      ],
      "unknownConcepts": []
    },
    "recommendations": {
      "conceptsToFocus": ["Frottements"],
      "nextChapterReady": false,
      "message": "🙂 Bien ! Vous êtes sur la bonne voie. Focalisez-vous sur les concepts identifiés ci-dessous."
    }
  }
}
```

#### Erreurs

- **400** : `"L'examId est requis"` ou `"Vous devez évaluer tous les concepts. Manquants : X"` ou `"Cet examen n'est pas une auto-évaluation"`.
- **404** : `"Examen introuvable"`.

### 2. Soumettre une réflexion guidée post-examen

```
POST /api/self-assessment/reflection
```

**Auth requise** : Oui (`STUDENT`)

> L'élève rédige une réflexion guidée (feedback textuel général) après un examen. Lui accorde de l'XP.

#### Corps de la requête

```json
{
  "examTitle": "Physique : Cinématique",
  "reflection": "J'ai eu beaucoup de mal sur l'application de la seconde loi...",
  "syllabusId": "507f..."
}
```

#### Réponse 200

```json
{
  "success": true,
  "message": "Reflection saved successfully"
}
```

### 3. Profil d'auto-évaluation d'une matière (Syllabus)

```
GET /api/self-assessments/profile?syllabusId=xxx
```

**Auth requise** : Oui (`STUDENT` ou `TEACHER` pour un étudiant cible)

> Récupère le profil complet de l'élève sur le syllabus donné : progression globale et scores par chapitre.

#### Paramètres

| Paramètre | Description |
|-----------|-------------|
| `syllabusId` | ID du syllabus (Requis) |
| `studentId`  | ID de l'étudiant (Optionnel - défaut = soi-même) |

#### Réponse 200

> Retourne `data` avec le profil global.

---

### 4. Historique de progression sur un concept

```
GET /api/self-assessments/concept-history?conceptId=xxx
```

**Auth requise** : Oui (`STUDENT` ou `TEACHER` pour un étudiant cible)

> Comment le niveau de maîtrise d'un élève a évolué sur ce concept unique dans le temps. Utile pour les graphiques de progression.

#### Paramètres

| Paramètre | Description |
|-----------|-------------|
| `conceptId` | ID du concept (Requis) |
| `studentId` | ID de l'étudiant (Optionnel - défaut = soi-même) |

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-01T10:00:00Z",
      "level": 2
    },
    {
      "date": "2024-01-15T10:00:00Z",
      "level": 4
    }
  ]
}
```

---

## Endpoints Enseignant

### 5. Analytics de Classe (Self-assessment par chapitre)

```
GET /api/self-assessments/class-analytics?classId=xxx&chapterId=yyy
```

**Auth requise** : Oui (`TEACHER`)

> Permet au professeur de voir d'un coup d'oeil où la classe entière bloque sur un chapitre donné (distingue la "santé" des concepts).

#### Paramètres

| Paramètre | Description |
|-----------|-------------|
| `classId` | ID de la classe (Requis) |
| `chapterId` | ID du chapitre / module (Requis) |

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "totalStudents": 24,
    "averageClassScore": 3.8,
    "conceptDifficulty": [
      {
        "concept": { "_id": "...", "title": "Calcul de la vitesse" },
        "averageLevel": 4.1,
        "distribution": {
           "level0": 0, "level1": 1, "level2": 2, "level3": 5, "level4": 12, "level5": 2, "level6": 2
        },
        "studentsStruggling": 3,
        "totalStudents": 24
      }
    ],
    "conceptsNeedingReview": [
      {
         "concept": { "title": "Frottement visqueux" },
         "averageLevel": 2.1,
         "studentsStruggling": 18
      }
    ],
    "studentResults": [
      {
        "student": { "firstName": "Alice", "lastName": "Mballa" },
        "overallScore": 4.5,
        "masteredConcepts": 3,
        "strugglingConcepts": 0,
        "completedAt": "2024-01-20T..."
      }
    ]
  }
}
```

---

## Anciens Endpoints (Legacy)

Ces endpoints existent encore mais leur logique a été supplantée par la soumission via `/api/self-assessments/submit`.  
> *Fournis à titre informatif, utiliser la nouvelle version (submit) de préférence.*

### 6. Soumission Unitaire (Concept simple)

```
POST /api/self-assessment
```

```json
{
  "conceptId": "xxx",
  "syllabusId": "yyy",
  "level": "ABLE_WITH_HELP", 
  "reflection": "Ok mais dur"
}
```
*(Attention : L'ancien model utilisait des strings pour le `level` : `UNKNOWN`, `TOTALLY_UNABLE`, etc.)*

### 7. Obtenir Évaluations Simples

```
GET /api/self-assessment?syllabusId=yyy
```
Retourne toutes les fiches unitaires de l'étudiant.
