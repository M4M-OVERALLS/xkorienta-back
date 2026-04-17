# Module 09 — Students (Espace Étudiant)

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie de session `next-auth.session-token` (obtenu après login)

---

## Vue d'ensemble

Le module Students regroupe tous les endpoints du **tableau de bord étudiant** : classes, syllabuses, gamification, leaderboard, challenges, analytics, profil apprenant et orientation scolaire.

### Rôles concernés

| Rôle | Accès |
|------|-------|
| `STUDENT` | Tous les endpoints de ce module |

> Les endpoints de prise d'examen (start, answer, submit) sont dans le **Module 08 — Attempts**.

### Pages frontend concernées

| Page | URL frontend | Endpoint(s) |
|------|-------------|-------------|
| Dashboard étudiant | `/student` | `GET /api/student/classes`, `GET /api/student/exams` |
| Mes classes | `/student/classes` | `GET /api/student/classes` |
| Détail d'une classe | `/student/classes/:id` | `GET /api/student/classes/:classId` |
| Mes syllabuses | `/student/syllabuses` | `GET /api/student/syllabuses` |
| Mes sujets | `/student/subjects` | `GET /api/student/subjects` |
| Gamification/Badges | `/student/gamification` | `GET /api/student/gamification` |
| Leaderboard | `/student/leaderboard` | `GET /api/student/leaderboard?type=CLASS` |
| Mes classements | `/student/rankings` | `GET /api/student/rankings` |
| Challenges | `/student/challenges` | `GET /api/student/challenges` |
| Analytics / Stats | `/student/analytics` | `GET /api/student/analytics` |
| Profil apprenant | `/student/profile` | `GET /api/student/profile` |
| Orientation scolaire | `/student/schools` | `GET /api/student/schools` |
| Orientation — écoles | `/student/orientation` | `GET /api/student/orientation/schools` |

---

## Endpoints

### 1. Lister mes classes

```
GET /api/student/classes
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne toutes les classes actives dans lesquelles l'étudiant est inscrit, avec son classement (`rank`) et sa moyenne par classe.

#### Réponse 200

```json
{
  "success": true,
  "classes": [
    {
      "id": "507f1f77bcf86cd799441000",
      "name": "Terminale C — Groupe A",
      "schoolName": "Lycée Technique de Douala",
      "schoolLogo": "https://cdn.quizlock.app/schools/logos/ltd.png",
      "level": "Terminale C",
      "field": "Sciences",
      "mainTeacher": { "name": "Prof. Martin Nkemeni" },
      "studentCount": 32,
      "academicYear": "2024-2025",
      "myRank": 5,
      "myAverage": 14.8
    }
  ]
}
```

#### Champs de réponse

| Champ | Type | Description |
|-------|------|-------------|
| `myRank` | number \| undefined | Position dans le classement de la classe (`null` si aucune tentative) |
| `myAverage` | number \| undefined | Score moyen de l'étudiant dans cette classe |

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 2. Détail d'une classe

```
GET /api/student/classes/:classId
```

**Auth requise** : Oui  
**Rôle** : `STUDENT` (inscrit dans la classe)

> Vue complète d'une classe : examens, liste des étudiants, enseignants, syllabuses et classement interne.

#### Réponse 200

```json
{
  "success": true,
  "class": {
    "id": "507f1f77bcf86cd799441000",
    "name": "Terminale C — Groupe A",
    "academicYear": "2024-2025",
    "school": { "id": "...", "name": "Lycée Technique de Douala" },
    "level": { "id": "...", "name": "Terminale C" },
    "mainTeacher": { "id": "...", "name": "Prof. Martin Nkemeni" },
    "studentsCount": 32
  },
  "exams": [
    {
      "id": "507f1f77bcf86cd799439200",
      "title": "Contrôle Mécanique — Terminale C",
      "description": "Évaluation formative",
      "startTime": "2025-01-20T08:00:00.000Z",
      "endTime": "2025-01-20T10:00:00.000Z",
      "duration": 60,
      "closeMode": "STRICT",
      "attempts": [
        { "id": "...", "status": "COMPLETED", "score": 14 }
      ],
      "_count": { "questions": 15 },
      "status": "completed"
    }
  ],
  "students": [
    {
      "id": "507f1f77bcf86cd799439050",
      "name": "Marie Dupont",
      "email": "marie.dupont@example.com",
      "image": null,
      "isActive": true
    }
  ],
  "teachers": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Prof. Martin Nkemeni",
      "email": "martin.nkemeni@example.com",
      "image": null,
      "role": "Professeur principal",
      "subjects": []
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "M. Dupuis",
      "email": "dupuis@example.com",
      "role": "Collaborateur",
      "subjects": [
        { "id": "...", "name": "Physique-Chimie", "code": "PC" }
      ]
    }
  ],
  "syllabuses": [
    {
      "id": "507f1f77bcf86cd799441100",
      "title": "Programme Mécanique — Terminale C",
      "description": null,
      "status": "PUBLISHED",
      "subject": { "id": "...", "name": "Physique", "code": "PHY" },
      "teacher": { "id": "...", "name": "Prof. Martin Nkemeni" },
      "chaptersCount": 5,
      "version": 1
    }
  ],
  "ranking": [
    {
      "rank": 1,
      "id": "507f1f77bcf86cd799439051",
      "name": "Jean Obono",
      "image": null,
      "averageScore": 18.5,
      "examsCompleted": 4,
      "isCurrentUser": false
    },
    {
      "rank": 5,
      "id": "507f1f77bcf86cd799439050",
      "name": "Marie Dupont",
      "image": null,
      "averageScore": 14.8,
      "examsCompleted": 3,
      "isCurrentUser": true
    }
  ]
}
```

#### Champ `exams[].status` — Valeurs possibles

| Valeur | Signification |
|--------|---------------|
| `"upcoming"` | Examen pas encore commencé, aucune tentative |
| `"active"` | En cours (entre `startTime` et `endTime`), pas encore tenté |
| `"in_progress"` | L'étudiant a une tentative `STARTED` |
| `"completed"` | L'étudiant a une tentative `COMPLETED` |
| `"missed"` | L'examen est terminé mais l'étudiant n'a pas participé |

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 403 | `"Vous n'êtes pas inscrit dans cette classe"` | Étudiant non inscrit |
| 404 | `"Classe non trouvée"` | Classe inexistante |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

### 3. Mes syllabuses

```
GET /api/student/syllabuses
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne tous les syllabuses assignés aux classes actives de l'étudiant (excluant les archivés).

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799441100",
      "title": "Programme Mécanique — Terminale C",
      "description": "Syllabus officiel",
      "status": "PUBLISHED",
      "subject": { "_id": "...", "name": "Physique", "code": "PHY" },
      "teacher": { "_id": "...", "name": "Prof. Martin Nkemeni" },
      "school": { "_id": "...", "name": "Lycée Technique de Douala" },
      "structure": {
        "chapters": [
          {
            "title": "Chapitre 1 — Lois de Newton",
            "concepts": ["507f1f77bcf86cd799441200"]
          }
        ]
      },
      "version": 1,
      "createdAt": "2025-01-10T10:00:00.000Z",
      "updatedAt": "2025-01-15T08:00:00.000Z"
    }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié ou rôle non STUDENT |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

### 4. Mes sujets et progression

```
GET /api/student/subjects
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne les matières de l'étudiant avec sa progression, son score moyen, la tendance et l'état de maîtrise de chaque concept.

#### Réponse 200

```json
{
  "success": true,
  "subjects": [
    {
      "id": "507f1f77bcf86cd799440100",
      "name": "Physique",
      "description": "Physique-chimie Terminale C",
      "averageScore": 72.5,
      "conceptsCount": 18,
      "conceptsMastered": 11,
      "trend": "IMPROVING",
      "concepts": [
        {
          "id": "507f1f77bcf86cd799441200",
          "title": "Lois de Newton",
          "description": "Étude des trois lois fondamentales de la dynamique",
          "currentLevel": "PROFICIENT",
          "lastEvaluated": "2025-01-15T10:00:00.000Z"
        },
        {
          "id": "507f1f77bcf86cd799441201",
          "title": "Thermodynamique",
          "description": null,
          "currentLevel": null,
          "lastEvaluated": null
        }
      ]
    }
  ]
}
```

#### Champs de réponse

| Champ | Type | Description |
|-------|------|-------------|
| `averageScore` | number | Score moyen en % sur tous les examens de ce sujet |
| `conceptsCount` | number | Nombre total de concepts dans le syllabus |
| `conceptsMastered` | number | Concepts avec niveau de maîtrise ≥ 80% |
| `trend` | `IMPROVING` \| `STABLE` \| `DECLINING` | Calculé sur les 4 dernières tentatives |
| `concepts[].currentLevel` | string \| null | Niveau de maîtrise auto-évalué (voir Enums) |

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 5. Mes statistiques de gamification

```
GET /api/student/gamification
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne les points XP, le niveau, les badges obtenus et les récompenses de l'étudiant.

#### Réponse 200

```json
{
  "success": true,
  "stats": {
    "xp": 1250,
    "level": 8,
    "levelName": "Explorateur",
    "nextLevelXp": 1500,
    "xpToNextLevel": 250,
    "badges": [
      {
        "id": "507f1f77bcf86cd799442000",
        "name": "Premier Pas",
        "description": "Compléter le premier examen",
        "imageUrl": "https://cdn.quizlock.app/badges/first-step.png",
        "earnedAt": "2025-01-20T09:00:00.000Z"
      }
    ],
    "streak": {
      "current": 5,
      "longest": 12
    },
    "stats": {
      "totalExamsCompleted": 15,
      "averageScore": 71.4,
      "totalTimeSpent": 12600
    }
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 6. Leaderboard

```
GET /api/student/leaderboard?type=CLASS&metric=EXAM_AVERAGE
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne le classement selon le type et la métrique demandés. Si l'étudiant n'est dans aucune classe, retourne `leaderboard: null`.

#### Paramètres de requête

| Paramètre | Type | Défaut | Valeurs | Description |
|-----------|------|--------|---------|-------------|
| `type` | string | `CLASS` | Voir tableau | Portée du classement |
| `metric` | string | `EXAM_AVERAGE` | Voir tableau | Critère de classement |

#### Valeurs de `type`

| Valeur | Portée |
|--------|--------|
| `CLASS` | Classement de la classe de l'étudiant |
| `SCHOOL_LEVEL` | Classement par niveau dans l'établissement |
| `NATIONAL_LEVEL` | Classement national par niveau |

#### Valeurs de `metric`

| Valeur | Description |
|--------|-------------|
| `EXAM_AVERAGE` | Moyenne des scores aux examens |
| `XP` | Points d'expérience (gamification) |
| `PASS_RATE` | Taux de réussite aux examens |

#### Réponse 200

```json
{
  "success": true,
  "leaderboard": {
    "type": "CLASS",
    "metric": "EXAM_AVERAGE",
    "updatedAt": "2025-01-20T12:00:00.000Z",
    "entries": [
      {
        "rank": 1,
        "userId": "507f1f77bcf86cd799439051",
        "name": "Jean Obono",
        "image": null,
        "score": 18.5,
        "isCurrentUser": false
      },
      {
        "rank": 5,
        "userId": "507f1f77bcf86cd799439050",
        "name": "Marie Dupont",
        "image": "https://...",
        "score": 14.8,
        "isCurrentUser": true
      }
    ],
    "currentUserPosition": {
      "rank": 5,
      "score": 14.8
    }
  }
}
```

#### Réponse 200 — Pas de classe trouvée

```json
{
  "success": true,
  "leaderboard": null,
  "message": "No class found for student"
}
```

> **Action UI recommandée** : Si `leaderboard === null`, afficher un message invitant l'étudiant à rejoindre une classe.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 7. Mes classements (tous leaderboards)

```
GET /api/student/rankings
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Résumé de la position de l'étudiant dans tous les leaderboards disponibles (classe, école, national).

#### Réponse 200

```json
{
  "success": true,
  "rankings": {
    "class": {
      "rank": 5,
      "total": 32,
      "score": 14.8,
      "className": "Terminale C — Groupe A"
    },
    "schoolLevel": {
      "rank": 12,
      "total": 120,
      "score": 14.8,
      "levelName": "Terminale C"
    },
    "national": {
      "rank": 342,
      "total": 5000,
      "score": 14.8,
      "levelName": "Terminale C"
    }
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 8. Mes challenges

```
GET /api/student/challenges
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne les challenges actifs ou à venir disponibles pour l'étudiant (basé sur sa classe, son établissement, son niveau), avec sa progression pour chaque challenge.

#### Réponse 200

```json
{
  "success": true,
  "challenges": [
    {
      "id": "507f1f77bcf86cd799443000",
      "title": "Champion de Mécanique",
      "description": "Compléter 5 examens avec un score > 70%",
      "type": "EXAM_PERFORMANCE",
      "status": "ACTIVE",
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-01-31T23:59:59.000Z",
      "goals": [
        { "target": 5, "description": "Réussir 5 examens" }
      ],
      "rewards": {
        "xpBonus": 500,
        "badgeName": "Maître Mécanicien",
        "specialReward": null
      },
      "progress": {
        "progress": [
          { "goalIndex": 0, "current": 3, "target": 5, "completed": false }
        ],
        "overallProgress": 60,
        "completed": false
      },
      "participantsCount": 18,
      "completedCount": 3
    }
  ]
}
```

#### Champs de réponse

| Champ | Type | Description |
|-------|------|-------------|
| `progress` | object \| null | `null` si l'étudiant n'a pas rejoint le challenge |
| `progress.overallProgress` | number | Progression globale en % (0-100) |
| `participantsCount` | number | Nombre d'étudiants inscrits au challenge |
| `completedCount` | number | Nombre d'étudiants ayant complété le challenge |

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 9. Rejoindre un challenge

```
POST /api/student/challenges/:id/join
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Inscrit l'étudiant à un challenge et initialise sa progression à 0 pour chaque objectif.

#### Corps de la requête

Aucun corps requis.

#### Réponse 200

```json
{
  "success": true,
  "message": "Successfully joined challenge"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Challenge ID is required"` | ID manquant (ne devrait pas arriver via URL) |
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Challenge not found"` | Challenge inexistant |
| 500 | `"Challenge is not active"` | Challenge pas encore actif ou terminé |
| 500 | `"Already participating in this challenge"` | Déjà inscrit |

> **Note** : Les erreurs métier (`not found`, `not active`, `already participating`) sont retournées en `500` (bug de format — à gérer côté frontend en inspectant `message`).

---

### 10. Analytics étudiant (IA)

```
GET /api/student/analytics
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne une analyse complète basée sur l'IA : prédiction de score, probabilité de réussite, forces, faiblesses et recommandations personnalisées.

#### Réponse 200

```json
{
  "success": true,
  "analytics": {
    "prediction": {
      "predictedPercentage": 74.5,
      "confidenceLevel": "MODERATE",
      "trendDirection": "IMPROVING",
      "factors": [
        { "factor": "Régularité", "impact": "POSITIVE", "weight": 0.3 },
        { "factor": "Score moyen récent", "impact": "POSITIVE", "weight": 0.5 }
      ]
    },
    "successProbability": {
      "probability": 0.78,
      "riskLevel": "LOW",
      "recommendedActions": [
        "Réviser le chapitre Thermodynamique",
        "Compléter les exercices de Cinématique"
      ]
    },
    "strengths": [
      { "subject": "Mécanique", "averageScore": 81.2, "conceptsCount": 4 }
    ],
    "weaknesses": [
      { "subject": "Thermodynamique", "averageScore": 52.0, "conceptsCount": 3 }
    ],
    "overallLevel": "PROFICIENT",
    "recommendations": [
      "Pratiquer davantage les questions à réponse ouverte",
      "Revoir les formules de base"
    ]
  }
}
```

#### Champs de réponse

| Champ | Type | Description |
|-------|------|-------------|
| `prediction` | object \| null | `null` si données insuffisantes |
| `prediction.confidenceLevel` | `LOW` \| `MODERATE` \| `HIGH` | Niveau de confiance de la prédiction IA |
| `prediction.trendDirection` | `IMPROVING` \| `STABLE` \| `DECLINING` | Tendance globale |
| `successProbability.probability` | number (0–1) | Probabilité de réussite (0 = 0%, 1 = 100%) |
| `successProbability.riskLevel` | `LOW` \| `MEDIUM` \| `HIGH` | Niveau de risque d'échec |
| `overallLevel` | string | Niveau global de maîtrise |

> **Cette requête peut être lente** (moteur de prédiction IA embarqué). Prévoir un état de chargement dans l'UI.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 11. Profil apprenant

```
GET /api/student/profile
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne le profil apprenant enrichi : statistiques globales, préférences de style d'apprentissage, historique de performance.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799444000",
    "user": "507f1f77bcf86cd799439050",
    "stats": {
      "totalExamsTaken": 15,
      "averageScore": 71.4,
      "lastActivityDate": "2025-01-20T09:00:00.000Z"
    },
    "learningStyle": "VISUAL",
    "strengths": ["Mécanique", "Électricité"],
    "weaknesses": ["Thermodynamique"],
    "createdAt": "2024-09-01T00:00:00.000Z",
    "updatedAt": "2025-01-20T09:00:00.000Z"
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 404 | `"Profile not found"` | Profil apprenant non encore créé |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 12. Rechercher des établissements (orientation)

```
GET /api/student/schools?query=lycee&country=CM&type=LYCEE
```

**Auth requise** : Oui (ou `studentId` en query param)  
**Rôle** : `STUDENT`

> Recherche d'établissements pour l'orientation scolaire. Supporte de nombreux filtres.

#### Paramètres de requête

| Paramètre | Type | Description |
|-----------|------|-------------|
| `studentId` | ObjectId | Optionnel — utilise la session si absent |
| `query` | string | Recherche textuelle sur le nom de l'école |
| `country` | string | Code pays (ex: `CM`, `FR`) |
| `city` | string | Ville |
| `level` | string | Niveau d'enseignement |
| `type` | string | Type d'établissement (`LYCEE`, `UNIVERSITE`, etc.) |
| `specialty` | string | Spécialité |
| `accreditation` | string | Accréditation |
| `modality` | string | Mode d'enseignement (`PRESENTIEL`, `DISTANCE`, `HYBRID`) |
| `language` | string | Langue d'enseignement |
| `costMin` | number | Coût annuel minimum (FCFA) |
| `costMax` | number | Coût annuel maximum (FCFA) |
| `scoreMin` | number | Score minimum requis |

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799445000",
      "name": "Lycée Technique de Douala",
      "type": "LYCEE",
      "address": "Rue de la Bassa, Douala, Cameroun",
      "logoUrl": "https://cdn.quizlock.app/schools/ltd.png",
      "country": "CM",
      "city": "Douala",
      "tuitionFee": 150000,
      "programs": ["Sciences", "Technique"],
      "accreditations": ["MINESEC"]
    }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié et `studentId` absent |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 13. Écoles d'orientation (liste simplifiée)

```
GET /api/student/orientation/schools?search=lycee
```

**Auth requise** : Non obligatoire  
**Rôle** : Tous

> Version simplifiée pour l'orientation. Retourne les établissements validés, avec fallback sur des données mock si la base de données est indisponible.

#### Paramètres de requête

| Paramètre | Type | Description |
|-----------|------|-------------|
| `search` | string | Recherche sur le nom de l'école |

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799445000",
      "name": "Lycée Technique de Douala",
      "type": "LYCEE",
      "address": "Douala, Cameroun",
      "logoUrl": null,
      "status": "VALIDATED",
      "contactInfo": {
        "phone": "+237 6XX XXX XXX",
        "email": "contact@ltd.cm"
      }
    }
  ],
  "meta": {
    "source": "mock"
  }
}
```

> **`meta.source`** : Si `"mock"`, les données proviennent du fallback statique (base de données indisponible). Ne pas afficher aux utilisateurs.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 500 | `"Internal server error"` | Erreur serveur |

---

## Flux complets recommandés

### Flux 1 : Chargement du dashboard étudiant

```
1. GET /api/student/classes              → Lister les classes (avec rang et moyenne)
2. GET /api/student/exams                → Lister les examens disponibles
3. GET /api/student/gamification         → Stats XP, badges
   → Afficher le widget de progression + examens récents
```

### Flux 2 : Vue d'une classe

```
1. GET /api/student/classes              → Récupérer la liste (et l'ID de la classe)
2. GET /api/student/classes/:classId     → Détail complet :
   → class : infos générales
   → exams : examens avec statut (completed/active/upcoming/missed/in_progress)
   → students : liste des élèves
   → teachers : liste des enseignants
   → syllabuses : programmes disponibles
   → ranking : classement complet avec isCurrentUser
```

### Flux 3 : Page Leaderboard

```
1. GET /api/student/leaderboard?type=CLASS&metric=EXAM_AVERAGE  → Classement classe
2. GET /api/student/leaderboard?type=SCHOOL_LEVEL&metric=XP     → Classement établissement
3. GET /api/student/leaderboard?type=NATIONAL_LEVEL             → Classement national
   → Si leaderboard === null, afficher "Rejoignez une classe"
```

### Flux 4 : Page Analytics (IA)

```
1. GET /api/student/analytics            → Charger les prédictions et forces/faiblesses
   ⚠️ Requête lente — afficher un skeleton/loader
   → prediction : score prédit, tendance, facteurs
   → successProbability : probabilité de réussite, actions recommandées
   → strengths / weaknesses : par matière
   → recommendations : actions concrètes à afficher
```

### Flux 5 : Challenges

```
1. GET /api/student/challenges           → Lister les challenges disponibles
   → progress === null → bouton "Rejoindre"
   → progress !== null → barre de progression
2. POST /api/student/challenges/:id/join → Rejoindre un challenge
   → Inspecter message si erreur 500 : "not found" / "not active" / "already participating"
3. GET /api/student/challenges           → Recharger la liste
```

---

## Enums de référence

### MasteryLevel (niveau de maîtrise d'un concept)

| Valeur | Description | % équivalent |
|--------|-------------|-------------|
| `NOVICE` | Débutant | 0–20% |
| `BEGINNER` | Débutant avancé | 21–40% |
| `INTERMEDIATE` | Intermédiaire | 41–60% |
| `PROFICIENT` | Compétent | 61–80% |
| `EXPERT` | Expert | 81–100% |

### LeaderboardType

| Valeur | Description |
|--------|-------------|
| `CLASS` | Classement au sein de la classe |
| `SCHOOL_LEVEL` | Classement par niveau dans l'établissement |
| `NATIONAL_LEVEL` | Classement national par niveau scolaire |

### LeaderboardMetric

| Valeur | Description |
|--------|-------------|
| `EXAM_AVERAGE` | Moyenne des scores aux examens |
| `XP` | Points d'expérience (gamification) |
| `PASS_RATE` | Taux de réussite |

### Trend

| Valeur | Description |
|--------|-------------|
| `IMPROVING` | Score moyen en hausse sur les 4 dernières tentatives |
| `STABLE` | Score stable (variation < 5%) |
| `DECLINING` | Score en baisse > 5% |

---

## Incohérences API à noter

| Endpoint | Clé de réponse données | Langue erreurs | Remarque |
|----------|------------------------|----------------|----------|
| `GET /api/student/classes` | `classes` (racine) | 🇬🇧 Anglais | — |
| `GET /api/student/classes/:id` | `class`, `exams`, `students`, ... (racine) | 🇫🇷 Français | Données à la racine, pas dans `data` |
| `GET /api/student/syllabuses` | `data` | 🇫🇷 Français | Format standard |
| `GET /api/student/subjects` | `subjects` (racine) | 🇬🇧 Anglais | — |
| `GET /api/student/gamification` | `stats` (racine) | 🇬🇧 Anglais | — |
| `GET /api/student/leaderboard` | `leaderboard` (racine) | 🇬🇧 Anglais | Peut être `null` |
| `GET /api/student/rankings` | `rankings` (racine) | 🇬🇧 Anglais | — |
| `GET /api/student/challenges` | `challenges` (racine) | 🇬🇧 Anglais | — |
| `POST /api/student/challenges/:id/join` | `{ success, message }` | 🇬🇧 Anglais | Erreurs métier en 500 |
| `GET /api/student/analytics` | `analytics` (racine) | 🇬🇧 Anglais | Peut être lent |
| `GET /api/student/profile` | `data` | 🇬🇧 Anglais | Format standard |
| `GET /api/student/schools` | dépend du `SchoolController` | 🇬🇧 Anglais | — |
| `GET /api/student/orientation/schools` | `data` + `meta` (racine) | 🇬🇧 Anglais | Fallback mock possible |

> **⚠️ Pattern général** : La majorité des endpoints `/api/student/*` retournent les données directement à la racine sous une clé nommée (`classes`, `subjects`, `analytics`, etc.) plutôt que dans `data`. **Vérifier chaque endpoint individuellement**.
