# Module 08 — Attempts (Prise d'examen)

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie de session `next-auth.session-token` (obtenu après login)

---

## Vue d'ensemble

Le module Attempts gère tout le cycle de vie d'une **prise d'examen côté étudiant** : accéder à l'examen, démarrer une tentative, enregistrer les réponses au fil de l'eau, soumettre, reprendre en cas d'interruption et consulter les résultats.

### Rôles concernés

| Rôle | Accès |
|------|-------|
| `STUDENT` | Tous les endpoints de ce module |
| `TEACHER` | Lecture des résultats (`/api/exams/:id/results` — voir Module 07) |

### Pages frontend concernées

| Page | URL frontend | Endpoints utilisés |
|------|-------------|-------------------|
| Liste des examens disponibles | `/student` / `/student/classes` | `GET /api/student/exams` |
| Lobby / Salle d'attente | Avant de démarrer | `GET /api/student/exams/:id/lobby` |
| Prise d'examen | `/student/exam/:id/take` | `GET /api/student/exams/:id/take` → `POST /api/attempts/start` → `POST /api/attempts/answer` |
| Soumission de l'examen | (bouton "Terminer") | `POST /api/attempts/:id/submit` |
| Résultats | Après soumission | `GET /api/student/exams/:id/result` |
| Historique | `/student/history` | `GET /api/student/attempts` |
| Revoir une tentative | (lien depuis l'historique) | `GET /api/student/attempts/:attemptId` |
| Reprise d'un examen interrompu | QR Code ou email | `POST /api/resume` → `POST /api/attempts/:id/resume` |

### Architecture de données

```
Attempt
├── examId           (ObjectId → Exam)
├── userId           (ObjectId → User)
├── status           (STARTED | COMPLETED | ABANDONED)
├── startedAt        (Date)
├── expiresAt        (Date)
├── submittedAt      (Date, à complétion)
├── score            (number)
├── maxScore         (number)
├── percentage       (number, 0-100)
├── passed           (boolean)
├── timeSpent        (number, secondes)
├── resumeToken      (string, 64 hex chars — secret)
├── tabSwitchCount   (number)
├── suspiciousActivityDetected (boolean)
└── antiCheatEvents[]
    ├── type         (tab_switch | copy_paste | right_click | ...)
    ├── timestamp    (Date)
    └── metadata     (any)

Response (réponse à une question)
├── attemptId        (ObjectId → Attempt)
├── questionId       (ObjectId → Question)
├── selectedOptionId (ObjectId → Option, pour QCM)
├── textResponse     (string, pour OPEN_QUESTION et TRUE_FALSE)
├── isCorrect        (boolean, calculé côté serveur)
├── timeSpent        (number, secondes passées sur la question)
└── answeredAt       (Date)
```

### Cycle de vie d'une tentative

```
[Étudiant accède à l'examen]
           │
           ▼
GET /api/student/exams/:id/lobby   ← Vérifier état, question count, tentatives précédentes
           │
           ▼
GET /api/student/exams/:id/take    ← Charger les questions (sans "isCorrect" des options)
           │
           ▼
POST /api/attempts/start            ← Démarrer → reçoit { attemptId, resumeToken, config }
           │
           ├──────────────────────────────────────────────────┐
           │                                                  │
           ▼                                                  ▼
POST /api/attempts/answer           (répéter pour        En cas de crash/rechargement
{ attemptId, questionId, ... }       chaque question)         │
           │                                                  ▼
           ▼                                        POST /api/attempts/:id/resume
POST /api/attempts/:id/submit       ← Soumettre tout      { resumeToken }
           │
           ▼
GET /api/student/exams/:id/result   ← Afficher résultats (si non bloqués)
```

> **`resumeToken`** : Généré à chaque `start`. À stocker côté frontend (localStorage ou state) pour permettre la reprise en cas de rechargement de page ou d'interruption.

---

## Endpoints — Côté Étudiant (accès aux examens)

### 1. Lister les examens disponibles pour l'étudiant

```
GET /api/student/exams
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne les examens publiés accessibles à cet étudiant (via ses classes, ses niveaux, ou les examens publics).

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439200",
      "title": "Contrôle Mécanique — Terminale C",
      "description": "Évaluation formative sur les lois de Newton",
      "startTime": "2025-01-20T08:00:00.000Z",
      "endTime": "2025-01-20T10:00:00.000Z",
      "duration": 60,
      "closeMode": "STRICT",
      "status": "PUBLISHED",
      "isPublished": true,
      "config": {
        "maxAttempts": 1,
        "shuffleQuestions": true,
        "enableImmediateFeedback": false,
        "passingScore": 50
      }
    }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

### 2. Lobby d'un examen (salle d'attente)

```
GET /api/student/exams/:id/lobby
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne les informations de l'examen **sans les questions** + le nombre de questions + toutes les tentatives précédentes de l'étudiant. À appeler avant de démarrer pour afficher la page de présentation de l'examen.

#### Réponse 200

```json
{
  "success": true,
  "exam": {
    "id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "description": "Évaluation formative sur les lois de Newton",
    "startTime": "2025-01-20T08:00:00.000Z",
    "endTime": "2025-01-20T10:00:00.000Z",
    "duration": 60,
    "closeMode": "STRICT",
    "config": {
      "maxAttempts": 1,
      "passingScore": 50,
      "shuffleQuestions": true,
      "enableImmediateFeedback": false
    },
    "pedagogicalObjective": "FORMATIVE_EVAL",
    "_count": { "questions": 15 }
  },
  "attempts": [
    {
      "id": "507f1f77bcf86cd799439300",
      "examId": "507f1f77bcf86cd799439200",
      "userId": "507f1f77bcf86cd799439050",
      "status": "COMPLETED",
      "score": 14,
      "startedAt": "2025-01-20T08:05:00.000Z",
      "submittedAt": "2025-01-20T08:57:00.000Z",
      "expiresAt": "2025-01-20T10:00:00.000Z",
      "resumeToken": "a8f3c..."
    }
  ]
}
```

> **Usage clé** : Comparer `attempts.length` avec `exam.config.maxAttempts` pour décider si le bouton "Démarrer" doit être affiché ou désactivé.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 404 | `"Examen non trouvé"` | Examen inexistant |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

### 3. Charger les questions pour la prise d'examen

```
GET /api/student/exams/:id/take
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne les questions de l'examen **sans** le champ `isCorrect` des options (masqué par sécurité). Retourne également la tentative en cours de l'étudiant s'il en a une.

> **Reformulation AI** : Si `exam.config.antiCheat.aiReformulation = true`, les textes des questions et options sont reformulés de façon unique par étudiant via l'API HuggingFace (pour éviter la communication des réponses entre étudiants).

#### Réponse 200

```json
{
  "success": true,
  "exam": {
    "id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "description": "Évaluation formative",
    "startTime": "2025-01-20T08:00:00.000Z",
    "endTime": "2025-01-20T10:00:00.000Z",
    "duration": 60,
    "closeMode": "STRICT",
    "config": { "maxAttempts": 1, "shuffleQuestions": true },
    "pedagogicalObjective": "FORMATIVE_EVAL",
    "syllabusId": "507f1f77bcf86cd799439090",
    "linkedConcepts": [],
    "questions": [
      {
        "id": "507f1f77bcf86cd799439500",
        "examId": "507f1f77bcf86cd799439200",
        "text": "Quelle est la première loi de Newton ?",
        "type": "QCM",
        "imageUrl": null,
        "points": 2,
        "options": [
          { "id": "507f1f77bcf86cd799439601", "questionId": "507f1f77bcf86cd799439500", "text": "Un corps au repos tend à rester au repos" },
          { "id": "507f1f77bcf86cd799439602", "questionId": "507f1f77bcf86cd799439500", "text": "F = ma" },
          { "id": "507f1f77bcf86cd799439603", "questionId": "507f1f77bcf86cd799439500", "text": "Action = Réaction" },
          { "id": "507f1f77bcf86cd799439604", "questionId": "507f1f77bcf86cd799439500", "text": "L'énergie se conserve" }
        ]
      }
    ]
  },
  "attempt": null
}
```

> **`attempt: null`** : L'étudiant n'a pas encore démarré de tentative.  
> **`attempt: { id, status, resumeToken, responses[] }`** : L'étudiant a une tentative en cours — utiliser `resumeToken` pour reprendre.

#### Types de questions (`type`)

| Valeur | Description | Champs utilisés |
|--------|-------------|-----------------|
| `QCM` | Choix multiple (1 bonne réponse) | `options[]` avec `isCorrect` masqué |
| `TRUE_FALSE` | Vrai ou Faux | `options[]` (ou `selectedOptionId = 'true'/'false'`) |
| `OPEN_QUESTION` | Réponse libre | `textResponse` dans la réponse |

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 404 | `"Examen non trouvé"` | Examen inexistant |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

## Endpoints — Gestion des Tentatives

### 4. Démarrer une tentative

```
POST /api/attempts/start
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Crée une nouvelle tentative. Génère un `resumeToken` sécurisé (64 hex). **Stocker ce token en localStorage** pour la reprise.

> **Pré-conditions vérifiées** :
> - L'examen doit être `PUBLISHED`
> - `now >= startTime` et `now <= endTime`
> - `attempts < config.maxAttempts`
> - Délai entre tentatives `timeBetweenAttempts` respecté

#### Corps de la requête

```json
{
  "examId": "507f1f77bcf86cd799439200"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `examId` | ObjectId | **Oui** | ID de l'examen à tenter |

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "attemptId": "507f1f77bcf86cd799439300",
    "resumeToken": "a8f3c9e2d1b4f8a7c6e5d4b3a2f1e8d7c6b5a4f3e2d1c8b7a6f5e4d3c2b1a9f8",
    "config": {
      "maxAttempts": 1,
      "shuffleQuestions": true,
      "timeBetweenAttempts": 0,
      "antiCheat": {
        "enabled": true,
        "maxTabSwitches": 3
      }
    },
    "startedAt": "2025-01-20T08:05:00.000Z",
    "duration": 60
  },
  "message": "Attempt started successfully"
}
```

> **Champs importants à stocker** :
> - `attemptId` → requis pour `POST /answer` et `POST /submit`
> - `resumeToken` → stocké en localStorage pour la reprise
> - `duration` → minutes restantes (afficher le timer)

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"examId is required"` | Corps manquant |
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Exam is not published"` | Examen non publié |
| 403 | `"Exam has not started yet"` | Avant `startTime` |
| 403 | `"Exam has ended"` | Après `endTime` |
| 403 | `"Maximum attempts (N) reached"` | `maxAttempts` atteint |
| 403 | `"Please wait N hours before attempting again"` | Délai non respecté |
| 404 | `"Exam not found"` | Examen inexistant |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 5. Enregistrer une réponse (au fil de l'eau)

```
POST /api/attempts/answer
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Sauvegarde une réponse pour une question donnée. **Appeler après chaque sélection** de l'étudiant (pas seulement à la fin). Si la question a déjà une réponse, elle est mise à jour (upsert).

> **Évaluation** : `isCorrect` est calculé côté serveur immédiatement.

#### Corps de la requête

```json
{
  "attemptId": "507f1f77bcf86cd799439300",
  "questionId": "507f1f77bcf86cd799439500",
  "selectedOptionId": "507f1f77bcf86cd799439601",
  "textResponse": null
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `attemptId` | ObjectId | **Oui** | ID de la tentative en cours |
| `questionId` | ObjectId | **Oui** | ID de la question répondue |
| `selectedOptionId` | ObjectId \| `"true"` \| `"false"` | Selon type | Pour QCM : ObjectId de l'option. Pour TRUE_FALSE : chaîne `"true"` ou `"false"` |
| `textResponse` | string | Pour OPEN_QUESTION | Réponse libre de l'étudiant |

#### Cas d'usage par type de question

| Type | `selectedOptionId` | `textResponse` | Exemple |
|------|--------------------|---------------|---------|
| `QCM` | ObjectId de l'option | — | `"507f1f77bcf86cd799439601"` |
| `TRUE_FALSE` | `"true"` ou `"false"` | — | `"true"` |
| `OPEN_QUESTION` | — | Texte libre | `"La force est égale à la masse fois l'accélération"` |

#### Réponse 200

```json
{
  "message": "Saved"
}
```

> **Note** : La réponse est volontairement minimale. L'état des réponses est rechargé depuis `/take` si nécessaire.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"attemptId and questionId are required"` | Champs manquants |
| 400 | `"Attempt already completed"` | Tentative déjà soumise |
| 403 | `"Invalid attempt"` | Tentative invalide ou non propriétaire |
| 404 | `"Question not found"` | Question inexistante |
| 500 | `"Something went wrong"` | Erreur serveur |

> **Note** : Cet endpoint retourne `{ message }` (sans `success`) en cas d'erreur de type `"Invalid attempt"` ou `"Attempt already completed"`.

---

### 6. Soumettre une tentative

```
POST /api/attempts/:id/submit
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Finalise et évalue la tentative. Envoie toutes les réponses en une seule fois. **Cette action est irréversible** : la tentative passe à `COMPLETED`.

> **Deux variantes existent** :
> - `POST /api/attempts/:id/submit` — Nouvelle version (recommandée) : envoie `{ responses[] }` dans le body, évalue et retourne le résultat complet.
> - `POST /api/attempts/submit` — Ancienne version : envoie `{ attemptId }`, calcule le score depuis les réponses déjà enregistrées. Toujours active pour compatibilité.

#### Corps de la requête

```json
{
  "responses": [
    {
      "questionId": "507f1f77bcf86cd799439500",
      "selectedOptionId": "507f1f77bcf86cd799439601",
      "timeSpent": 45
    },
    {
      "questionId": "507f1f77bcf86cd799439501",
      "selectedOptionId": "507f1f77bcf86cd799439611",
      "timeSpent": 30
    },
    {
      "questionId": "507f1f77bcf86cd799439502",
      "textAnswer": "La force est liée à l'accélération par F = ma",
      "timeSpent": 120
    }
  ]
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `responses` | array | **Oui** | Liste de toutes les réponses (peut être `[]`) |
| `responses[].questionId` | ObjectId | **Oui** | ID de la question |
| `responses[].selectedOptionId` | ObjectId \| `"true"` \| `"false"` | Selon type | Pour QCM et TRUE_FALSE |
| `responses[].textAnswer` | string | Pour OPEN_QUESTION | Réponse libre |
| `responses[].timeSpent` | number | Non | Secondes passées sur la question |

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "attempt": {
      "_id": "507f1f77bcf86cd799439300",
      "status": "COMPLETED",
      "score": 14,
      "maxScore": 20,
      "percentage": 70,
      "passed": true,
      "timeSpent": 3120,
      "submittedAt": "2025-01-20T08:57:00.000Z"
    },
    "evaluation": {
      "score": 14,
      "maxScore": 20,
      "percentage": 70,
      "passed": true,
      "breakdown": [
        { "questionId": "...", "isCorrect": true, "points": 2, "earnedPoints": 2 }
      ]
    },
    "totalResponses": 15
  },
  "message": "Attempt submitted and evaluated successfully"
}
```

> **Après soumission** : Rediriger vers `GET /api/student/exams/:id/result` pour afficher la page de résultats.

#### Effets de bord (côté serveur)

- Met à jour les stats de l'examen (`averageScore`, `passRate`)
- Met à jour le profil apprenant (`totalExamsTaken`, `averageScore`)
- Publie des événements : `ATTEMPT_SUBMITTED`, `ATTEMPT_GRADED`, `EXAM_COMPLETED`
- Peut déclencher la gamification (badges, points XP)

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"responses array is required"` | `responses` absent ou non-tableau |
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Unauthorized: Not your attempt"` | Tentative appartenant à quelqu'un d'autre |
| 403 | `"Attempt is not in progress"` | Déjà soumise ou abandonnée |
| 404 | `"Attempt not found"` | Tentative inexistante |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 7. Reprendre une tentative interrompue

```
POST /api/attempts/:id/resume
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Permet de reprendre une tentative `STARTED` après un crash ou rechargement de page. Le `resumeToken` est requis — il a été reçu lors du `start`.

#### Corps de la requête

```json
{
  "resumeToken": "a8f3c9e2d1b4f8a7c6e5d4b3a2f1e8d7c6b5a4f3e2d1c8b7a6f5e4d3c2b1a9f8"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `resumeToken` | string | **Oui** | Token reçu lors du `start`, stocké en localStorage |

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "attempt": {
      "_id": "507f1f77bcf86cd799439300",
      "examId": "507f1f77bcf86cd799439200",
      "status": "STARTED",
      "startedAt": "2025-01-20T08:05:00.000Z",
      "expiresAt": "2025-01-20T10:00:00.000Z",
      "resumeToken": "a8f3c9e2d1b4f8a7c6e5d4b3a2f1e8d7..."
    },
    "responses": [
      {
        "_id": "507f1f77bcf86cd799439700",
        "attemptId": "507f1f77bcf86cd799439300",
        "questionId": "507f1f77bcf86cd799439500",
        "selectedOptionId": "507f1f77bcf86cd799439601",
        "isCorrect": true
      }
    ]
  },
  "message": "Attempt resumed successfully"
}
```

> **Usage** : `data.responses` permet de pré-cocher les réponses déjà enregistrées dans l'interface.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"resumeToken is required"` | Token absent du body |
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Invalid resume token"` | Token incorrect |
| 403 | `"Unauthorized: This attempt does not belong to you"` | Mauvais utilisateur |
| 403 | `"Attempt is not in progress"` | Tentative déjà terminée |
| 404 | `"Attempt not found"` | Tentative inexistante |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 8. Obtenir les détails d'une tentative

```
GET /api/attempts/:id
```

**Auth requise** : Oui  
**Rôle** : `STUDENT` (propriétaire uniquement)

> Retourne les détails d'une tentative sans les questions complètes de l'examen.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439300",
    "examId": "507f1f77bcf86cd799439200",
    "userId": "507f1f77bcf86cd799439050",
    "status": "COMPLETED",
    "startedAt": "2025-01-20T08:05:00.000Z",
    "expiresAt": "2025-01-20T10:00:00.000Z",
    "submittedAt": "2025-01-20T08:57:00.000Z",
    "score": 14,
    "maxScore": 20,
    "percentage": 70,
    "passed": true,
    "timeSpent": 3120
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Unauthorized: This attempt does not belong to you"` | Non propriétaire |
| 404 | `"Attempt not found"` | Tentative inexistante |
| 500 | `"Internal server error"` | Erreur serveur |

---

## Endpoints — Résultats et Historique

### 9. Résultats d'un examen pour l'étudiant

```
GET /api/student/exams/:id/result
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne les résultats de la tentative de l'étudiant pour un examen donné. Inclut la gestion du **blocage des résultats** en période de retardataires.

#### Réponse 200 — Résultats disponibles

```json
{
  "success": true,
  "exam": {
    "id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "duration": 60,
    "endTime": "2025-01-20T10:00:00.000Z",
    "questions": [
      { "id": "507f1f77bcf86cd799439500", "text": "Quelle est la première loi de Newton ?", "points": 2 }
    ]
  },
  "attempt": {
    "id": "507f1f77bcf86cd799439300",
    "status": "COMPLETED",
    "score": 14,
    "submittedAt": "2025-01-20T08:57:00.000Z"
  },
  "maxScore": 20,
  "percentage": 70,
  "resultsBlocked": false,
  "inLatePeriod": false,
  "timeUntilResults": 0
}
```

#### Réponse 200 — Résultats bloqués (période retardataires)

```json
{
  "success": true,
  "exam": { ... },
  "attempt": { "id": "...", "status": "COMPLETED", "score": null },
  "maxScore": 20,
  "percentage": 0,
  "resultsBlocked": true,
  "inLatePeriod": true,
  "timeUntilResults": 23
}
```

> **`resultsBlocked: true`** : Afficher un message du type *"Les résultats seront disponibles dans 23 minutes (fin de la période retardataires)"*.  
> **`timeUntilResults`** : Nombre de minutes restantes avant le déblocage.

#### Champs de la réponse

| Champ | Type | Description |
|-------|------|-------------|
| `resultsBlocked` | boolean | `true` si les résultats ne sont pas encore visibles |
| `inLatePeriod` | boolean | `true` si des retardataires sont encore en train de passer |
| `timeUntilResults` | number | Minutes restantes avant déblocage (0 si non bloqué) |
| `percentage` | number | Score en % (0 si bloqué) |

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 404 | `"Examen non trouvé"` | Examen inexistant |
| 404 | `"Tentative non trouvée"` | L'étudiant n'a pas de tentative |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

### 10. Historique des tentatives de l'étudiant

```
GET /api/student/attempts
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Retourne toutes les tentatives terminées de l'étudiant avec les détails de l'examen. Utilisé pour la page `/student/history`.

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439300",
      "examId": "507f1f77bcf86cd799439200",
      "exam": {
        "title": "Contrôle Mécanique — Terminale C",
        "duration": 60
      },
      "status": "COMPLETED",
      "score": 14,
      "maxScore": 20,
      "percentage": 70,
      "passed": true,
      "timeSpent": 3120,
      "startedAt": "2025-01-20T08:05:00.000Z",
      "submittedAt": "2025-01-20T08:57:00.000Z"
    }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

### 11. Consulter une tentative en détail (révision)

```
GET /api/student/attempts/:attemptId
```

**Auth requise** : Oui  
**Rôle** : `STUDENT` (propriétaire)

> Retourne la tentative avec les questions complètes, les options (avec `isCorrect` révélé), et les réponses de l'étudiant. Utile pour la révision après l'examen.

> **Blocage résultats** : Si l'examen est configuré pour bloquer les résultats pendant la période retardataires (`delayResultsUntilLateEnd: true`), retourne un `403` avec `blocked: true`.

#### Réponse 200

```json
{
  "success": true,
  "exam": {
    "id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "questions": [
      {
        "id": "507f1f77bcf86cd799439500",
        "text": "Quelle est la première loi de Newton ?",
        "type": "QCM",
        "points": 2,
        "explanation": "La première loi de Newton, ou principe d'inertie...",
        "options": [
          { "id": "507f1f77bcf86cd799439601", "text": "Un corps au repos...", "isCorrect": true },
          { "id": "507f1f77bcf86cd799439602", "text": "F = ma", "isCorrect": false },
          { "id": "507f1f77bcf86cd799439603", "text": "Action = Réaction", "isCorrect": false },
          { "id": "507f1f77bcf86cd799439604", "text": "L'énergie se conserve", "isCorrect": false }
        ]
      }
    ]
  },
  "attempt": {
    "id": "507f1f77bcf86cd799439300",
    "status": "COMPLETED",
    "score": 14,
    "responses": [
      {
        "id": "507f1f77bcf86cd799439700",
        "attemptId": "507f1f77bcf86cd799439300",
        "questionId": "507f1f77bcf86cd799439500",
        "selectedOptionId": "507f1f77bcf86cd799439601",
        "textResponse": "",
        "isCorrect": true
      }
    ]
  }
}
```

#### Réponse 403 — Résultats bloqués

```json
{
  "success": false,
  "blocked": true,
  "inLatePeriod": true,
  "timeUntilResults": 23,
  "message": "Les résultats seront disponibles après la fin de la période retardataires."
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 403 | `"Accès refusé"` | Non propriétaire de la tentative |
| 403 | `"Les résultats seront disponibles..."` | Résultats bloqués (`blocked: true`) |
| 404 | `"Tentative non trouvée"` | Tentative inexistante |
| 404 | `"Examen non trouvé"` | Examen associé inexistant |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

## Endpoint — Anti-triche

### 12. Enregistrer un événement anti-triche

```
POST /api/attempts/:id/anti-cheat-event
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

> Enregistre un événement de comportement suspect lors d'un examen. **À appeler depuis les event listeners du navigateur** (visibilitychange, contextmenu, etc.) pendant la prise d'examen.

> **⚠️ Dépassement du seuil de tab_switch** : Si `tabSwitchCount > exam.config.antiCheat.maxTabSwitches`, la tentative est automatiquement **abandonnée** (`status: ABANDONED`) et une erreur 403 est retournée. L'étudiant ne peut alors plus terminer l'examen.

#### Corps de la requête

```json
{
  "type": "tab_switch",
  "data": {
    "timestamp": "2025-01-20T08:30:00.000Z",
    "duration": 5
  }
}
```

| Champ | Type | Requis | Valeurs acceptées | Description |
|-------|------|--------|-------------------|-------------|
| `type` | string | **Oui** | Voir tableau ci-dessous | Type d'événement |
| `data` | any | Non | — | Métadonnées optionnelles |

#### Types d'événements acceptés

| Valeur | Déclencheur frontend recommandé |
|--------|--------------------------------|
| `tab_switch` | `document.addEventListener('visibilitychange', ...)` |
| `window_blur` | `window.addEventListener('blur', ...)` |
| `copy_paste` | `document.addEventListener('copy', ...)` ou `paste` |
| `right_click` | `document.addEventListener('contextmenu', ...)` |
| `context_menu` | `document.addEventListener('contextmenu', ...)` |
| `screenshot` | `document.addEventListener('keydown', ...)` (PrintScreen) |
| `fullscreen_exit` | `document.addEventListener('fullscreenchange', ...)` |

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "success": true,
    "event": {
      "type": "tab_switch",
      "timestamp": "2025-01-20T08:30:00.000Z",
      "metadata": { "duration": 5 }
    }
  },
  "message": "Anti-cheat event recorded"
}
```

#### Réponse 403 — Seuil dépassé (tentative abandonnée)

```json
{
  "success": false,
  "message": "Maximum tab switches exceeded. Attempt has been abandoned."
}
```

> **Action UI recommandée** : Si réception de ce `403`, afficher un message d'alerte et rediriger vers le dashboard. La tentative ne peut plus être soumise.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"event type is required"` | `type` absent |
| 400 | `"Invalid event type. Must be one of: ..."` | Type non reconnu |
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Maximum tab switches exceeded. Attempt has been abandoned."` | Seuil anti-triche dépassé |
| 403 | `"Attempt is not in progress"` | Tentative terminée |
| 403 | `"Unauthorized: This attempt does not belong to you"` | Non propriétaire |
| 404 | `"Attempt not found"` | Tentative inexistante |
| 500 | `"Internal server error"` | Erreur serveur |

---

## Endpoint — Reprise par lien/QR Code

### 13. Valider un token de reprise et obtenir la redirection

```
POST /api/resume
```

**Auth requise** : Non obligatoire (mais vérifie l'utilisateur si connecté)

> Valide un token de reprise et retourne l'URL de redirection. Utilisé quand l'étudiant accède via un QR Code ou un lien email.

#### Corps de la requête

```json
{
  "token": "a8f3c9e2d1b4f8a7c6e5d4b3a2f1e8d7c6b5a4f3e2d1c8b7a6f5e4d3c2b1a9f8"
}
```

#### Réponse 200

```json
{
  "redirectUrl": "/student/exam/507f1f77bcf86cd799439200/take"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Token is required"` | Token absent |
| 403 | `"Logged in as wrong user. Please logout first."` | Mauvais utilisateur connecté |
| 404 | `"Invalid token"` | Token invalide ou tentative inexistante |
| 500 | `"Something went wrong"` | Erreur serveur |

---

## Flux complets recommandés

### Flux 1 : Prise d'examen standard (étudiant)

```
1. GET  /api/student/exams                    → Charger la liste des examens disponibles
2. GET  /api/student/exams/:id/lobby          → Vérifier: état, nb questions, tentatives précédentes
   → Si attempts.length >= config.maxAttempts → Désactiver le bouton "Démarrer"
   → Si attempt avec status: "STARTED" → Afficher bouton "Reprendre"
3. GET  /api/student/exams/:id/take           → Charger les questions (isCorrect masqué)
4. POST /api/attempts/start { examId }        → Démarrer la tentative
   → Stocker { attemptId, resumeToken } en localStorage
   → Démarrer le timer (duration minutes)
5. POST /api/attempts/answer (× N)            → Sauvegarder chaque réponse
   { attemptId, questionId, selectedOptionId }
6. POST /api/attempts/:attemptId/submit       → Soumettre (envoyer TOUTES les réponses)
   { responses: [...] }
7. GET  /api/student/exams/:id/result         → Afficher les résultats
```

### Flux 2 : Reprise après crash (page rechargée)

```
1. Récupérer { attemptId, resumeToken } depuis localStorage
2. GET  /api/student/exams/:id/take           → Recharger les questions
3. POST /api/attempts/:id/resume              → Reprendre
   { resumeToken }
   → data.responses[] contient les réponses déjà enregistrées → pré-cocher dans l'UI
4. Continuer avec POST /api/attempts/answer pour les questions restantes
5. POST /api/attempts/:id/submit              → Soumettre
```

### Flux 3 : Reprise via QR Code / Email

```
1. POST /api/resume { token }                 → Valider le token
   → Récupérer redirectUrl
2. Rediriger vers redirectUrl
   (ex: /student/exam/:id/take)
3. GET  /api/student/exams/:id/lobby          → Vérifier la tentative en cours
4. POST /api/attempts/:id/resume              → Reprendre avec le resumeToken
```

### Flux 4 : Historique et révision

```
1. GET  /api/student/attempts                 → Lister toutes les tentatives
2. (clic sur une tentative)
   GET  /api/student/attempts/:attemptId      → Détail avec questions + réponses
   → Si blocked: true → Afficher message "résultats pas encore disponibles"
   → Sinon → Afficher la correction complète
```

---

## Enums de référence

### AttemptStatus

| Valeur | Description |
|--------|-------------|
| `STARTED` | En cours — l'étudiant est en train de passer l'examen |
| `COMPLETED` | Soumis et évalué |
| `ABANDONED` | Abandonné (dépassement limite anti-triche ou expiration) |

### Question Types

| Valeur | Description | Format de réponse |
|--------|-------------|-------------------|
| `QCM` | Choix multiple | `selectedOptionId` = ObjectId |
| `TRUE_FALSE` | Vrai ou Faux | `selectedOptionId` = `"true"` ou `"false"` |
| `OPEN_QUESTION` | Réponse libre | `textAnswer` = string |

### PedagogicalObjective (exam config)

| Valeur | Description |
|--------|-------------|
| `FORMATIVE_EVAL` | Évaluation formative (feedback immédiat possible) |
| `SELF_ASSESSMENT` | Auto-évaluation |
| `DIAGNOSTIC_EVAL` | Évaluation diagnostique |
| `REMEDIATION` | Remédiation |
| `SUMMATIVE_EVAL` | Évaluation sommative |

---

## Incohérences API à noter

| Endpoint | Format succès | Format erreur | Langue erreurs |
|----------|---------------|---------------|----------------|
| `POST /api/attempts/start` | `{ success, data, message }` | `{ success, message }` | 🇬🇧 Anglais |
| `POST /api/attempts/answer` | `{ message: "Saved" }` | `{ message }` (sans `success`) | 🇬🇧 Anglais |
| `POST /api/attempts/:id/submit` | `{ success, data, message }` | `{ success, message }` | 🇬🇧 Anglais |
| `POST /api/attempts/:id/resume` | `{ success, data, message }` | `{ success, message }` | 🇬🇧 Anglais |
| `GET /api/student/exams` | `{ success, data }` | — | 🇫🇷 Français |
| `GET /api/student/exams/:id/lobby` | `{ success, exam, attempts }` | `{ success, message }` | 🇫🇷 Français |
| `GET /api/student/exams/:id/take` | `{ success, exam, attempt }` | `{ success, message }` | 🇫🇷 Français |
| `GET /api/student/exams/:id/result` | `{ success, exam, attempt, ... }` | `{ success, message }` | 🇫🇷 Français |
| `GET /api/student/attempts/:id` | `{ success, exam, attempt }` | `{ success, message }` | 🇫🇷 Français |
| `POST /api/resume` | `{ redirectUrl }` | `{ message }` (sans `success`) | 🇬🇧 Anglais |

> **⚠️ Pattern incohérent** : Les endpoints `/api/student/*` retournent les données directement à la racine de l'objet (`exam`, `attempt`) au lieu de les imbriquer dans `data`.
