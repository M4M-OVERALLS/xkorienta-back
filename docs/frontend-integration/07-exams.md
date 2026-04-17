# Module 07 — Exams (CRUD + Workflow)

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie de session `next-auth.session-token` (obtenu après login)

---

## Vue d'ensemble

Le module Exams permet aux enseignants de créer, configurer et gérer des examens (QCM). Il couvre tout le cycle de vie d'un examen : création → soumission à validation → validation → publication → surveillance → résultats.

### Rôles concernés

| Rôle | Accès |
|------|-------|
| `TEACHER` | Créer, modifier, supprimer, publier ses propres examens |
| `INSPECTOR` | Valider les examens soumis par les enseignants |
| `SCHOOL_ADMIN` | Accès lecture + actions de validation |
| `STUDENT` | Utiliser `/api/student/exams` (voir Module 09) |

### Pages frontend concernées

| Page | URL frontend | Action |
|------|-------------|--------|
| Liste des examens | `/teacher/exams` | Affiche, filtre, supprime les examens |
| Créer un examen | `/teacher/exams/create` | Formulaire de création avec questions |
| Détail d'un examen | `/teacher/exams/:id` | Vue complète + gestion workflow |
| Résultats | `/teacher/exams/:id/results` | Statistiques et résultats étudiants |

### Architecture de données (Exam)

```
Exam
├── title              (string, requis, min 3 car.)
├── description        (string, optionnel)
├── startTime          (Date ISO 8601, requis)
├── endTime            (Date ISO 8601, requis)
├── duration           (number, minutes, requis, min 1)
├── closeMode          (STRICT | PERMISSIVE)
├── status             (DRAFT | PENDING_VALIDATION | VALIDATED | PUBLISHED | CLOSED | ARCHIVED)
├── isPublished        (boolean)
├── publishedAt        (Date)
├── createdById        (ObjectId → User)
├── syllabus           (ObjectId → Syllabus, optionnel)
├── subject            (ObjectId → Subject, optionnel)
├── targetLevels       (ObjectId[] → EducationLevel)
├── config
│   ├── passingScore         (number, %)
│   ├── maxAttempts          (number)
│   ├── shuffleQuestions     (boolean)
│   └── enableImmediateFeedback (boolean)
└── questions[]              (collection Question séparée)
    ├── text              (string, requis)
    ├── imageUrl          (string, optionnel)
    ├── points            (number, requis, min 1)
    └── options[]
        ├── text          (string, requis)
        └── isCorrect     (boolean)
```

### Workflow des statuts

```
DRAFT
  └──[Enseignant soumet]──→ PENDING_VALIDATION
                               └──[Inspector/Teacher valide]──→ VALIDATED
                                                                   └──[Enseignant publie]──→ PUBLISHED
                                                                                               └──[Fermeture auto/manuelle]──→ CLOSED
```

> **Note importante** : Le endpoint `PATCH /api/exams/[id]/status` permet aussi de basculer directement vers `PUBLISHED` depuis `DRAFT` (workflow simplifié pour les enseignants sans inspection obligatoire).

---

## Endpoints

### 1. Lister les examens

```
GET /api/exams
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` uniquement (les étudiants doivent utiliser `/api/student/exams`)

#### Comportement

- Enseignant : retourne uniquement ses examens (`createdById = userId`)
- Étudiant : retourne `403` avec message de redirection

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439200",
      "id": "507f1f77bcf86cd799439200",
      "title": "Contrôle Mécanique — Terminale C",
      "description": "Évaluation formative sur les lois de Newton",
      "startTime": "2025-01-20T08:00:00.000Z",
      "endTime": "2025-01-20T10:00:00.000Z",
      "duration": 60,
      "closeMode": "STRICT",
      "status": "PUBLISHED",
      "isPublished": true,
      "publishedAt": "2025-01-18T14:00:00.000Z",
      "createdById": "507f1f77bcf86cd799439011",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-18T14:00:00.000Z"
    }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Students should use /api/student/exams"` | Rôle étudiant |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 2. Créer un examen

```
POST /api/exams
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` uniquement

> **Architecture** : La création crée simultanément l'examen (`Exam`), les questions (`Question`) et les options (`Option`) en cascade. Tout est atomique — si une étape échoue, relancer la requête complète.

#### Corps de la requête

```json
{
  "title": "Contrôle Mécanique — Terminale C",
  "description": "Évaluation formative sur les lois de Newton",
  "startTime": "2025-01-20T08:00:00.000Z",
  "endTime": "2025-01-20T10:00:00.000Z",
  "duration": 60,
  "closeMode": "STRICT",
  "questions": [
    {
      "text": "Quelle est la première loi de Newton ?",
      "imageUrl": "",
      "points": 2,
      "options": [
        { "text": "Un corps au repos tend à rester au repos", "isCorrect": true },
        { "text": "F = ma", "isCorrect": false },
        { "text": "Action = Réaction", "isCorrect": false },
        { "text": "L'énergie se conserve", "isCorrect": false }
      ]
    },
    {
      "text": "Quelle est la formule de la deuxième loi de Newton ?",
      "points": 3,
      "options": [
        { "text": "F = ma", "isCorrect": true },
        { "text": "E = mc²", "isCorrect": false },
        { "text": "P = mv", "isCorrect": false },
        { "text": "W = Fd", "isCorrect": false }
      ]
    }
  ]
}
```

#### Champs de la requête

| Champ | Type | Requis | Contraintes | Description |
|-------|------|--------|-------------|-------------|
| `title` | string | **Oui** | min 3 car. | Titre de l'examen |
| `description` | string | Non | — | Description (affiché aux étudiants) |
| `startTime` | string (ISO 8601) | **Oui** | — | Date/heure de début |
| `endTime` | string (ISO 8601) | **Oui** | — | Date/heure de fin |
| `duration` | number | **Oui** | min 1 | Durée en minutes |
| `closeMode` | string | **Oui** | `STRICT` \| `PERMISSIVE` | Mode de fermeture |
| `questions` | array | **Oui** | — | Liste des questions |
| `questions[].text` | string | **Oui** | min 1 | Énoncé de la question |
| `questions[].imageUrl` | string | Non | URL ou `""` | Image optionnelle |
| `questions[].points` | number | **Oui** | min 1 | Valeur en points |
| `questions[].options` | array | **Oui** | — | Réponses possibles (min 2 recommandé) |
| `questions[].options[].text` | string | **Oui** | min 1 | Texte de l'option |
| `questions[].options[].isCorrect` | boolean | **Oui** | — | Si cette option est correcte |

#### `closeMode` — Comportement

| Valeur | Comportement |
|--------|-------------|
| `STRICT` | L'accès se ferme exactement à `endTime`, même si l'étudiant est en cours |
| `PERMISSIVE` | L'étudiant peut terminer sa tentative même après `endTime` |

#### Réponse 201

```json
{
  "message": "Exam created",
  "exam": {
    "id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "description": "Évaluation formative sur les lois de Newton",
    "startTime": "2025-01-20T08:00:00.000Z",
    "endTime": "2025-01-20T10:00:00.000Z",
    "duration": 60,
    "closeMode": "STRICT",
    "createdById": "507f1f77bcf86cd799439011"
  }
}
```

> **Note** : La réponse ne retourne pas `success: true` — elle retourne directement `{ message, exam }`. Format différent des autres modules.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Invalid input data"` | Validation Zod échouée (champ manquant ou format incorrect) |
| 401 | `"Unauthorized"` | Non enseignant |
| 500 | `"Something went wrong"` | Erreur serveur |

---

### 3. Modifier un examen

```
PUT /api/exams/:id
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (owner uniquement)

> **Règle critique** : Si des étudiants ont déjà commencé des tentatives (`attempts > 0`), **les questions ne peuvent plus être modifiées**. Seuls les métadonnées (titre, dates, durée, mode) sont mis à jour. La réponse inclut alors `"warning": true`.

#### Corps de la requête

Même format que la création — tous les champs sont requis (remplacement complet) :

```json
{
  "title": "Contrôle Mécanique — Terminale C (Révisé)",
  "description": "Version corrigée",
  "startTime": "2025-01-20T09:00:00.000Z",
  "endTime": "2025-01-20T11:00:00.000Z",
  "duration": 90,
  "closeMode": "PERMISSIVE",
  "questions": [
    {
      "text": "Question mise à jour",
      "points": 2,
      "options": [
        { "text": "Bonne réponse", "isCorrect": true },
        { "text": "Mauvaise réponse", "isCorrect": false }
      ]
    }
  ]
}
```

#### Réponse 200 — Sans tentatives existantes

```json
{
  "message": "Exam updated successfully",
  "exam": {
    "_id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C (Révisé)",
    "duration": 90,
    "closeMode": "PERMISSIVE",
    "updatedAt": "2025-01-16T10:00:00.000Z"
  }
}
```

#### Réponse 200 — Avec tentatives existantes (mise à jour partielle)

```json
{
  "message": "Exam updated. Questions were not modified because students have already taken this exam.",
  "exam": {
    "_id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C (Révisé)",
    "duration": 90
  },
  "warning": true
}
```

> **Action UI recommandée** : Si `warning: true`, afficher un message d'alerte à l'enseignant : *"Les questions n'ont pas été modifiées car des étudiants ont déjà passé cet examen."*

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non enseignant |
| 404 | `"Not found or unauthorized"` | Examen inexistant ou l'enseignant n'en est pas le créateur |
| 500 | `"Something went wrong"` | Erreur serveur |

---

### 4. Supprimer un examen

```
DELETE /api/exams/:id
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (owner uniquement)

> **Suppression en cascade** : Supprime l'examen ET toutes les données liées — réponses (`Response`), tentatives (`Attempt`), questions (`Question`), options (`Option`), codes tardifs (`LateCode`). **Action irréversible.**

#### Réponse 200

```json
{
  "message": "Exam deleted successfully"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non enseignant |
| 404 | `"Not found or unauthorized"` | Examen inexistant ou non propriétaire |
| 500 | `"Something went wrong"` | Erreur serveur |

---

### 5. Changer le statut d'un examen (Workflow)

```
PATCH /api/exams/:id/status
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (owner)

> C'est l'endpoint principal de gestion du cycle de vie. Il permet de faire progresser l'examen dans le workflow.

#### Corps de la requête

```json
{
  "status": "PUBLISHED"
}
```

#### Valeurs de `status` acceptées

| Valeur | Transition depuis | Effet secondaire |
|--------|-------------------|-----------------|
| `DRAFT` | Tout statut | — |
| `PENDING_VALIDATION` | `DRAFT` | Soumet à validation |
| `VALIDATED` | `PENDING_VALIDATION` | Marque `validatedBy`, `validatedAt` |
| `PUBLISHED` | `VALIDATED` ou `DRAFT` | Met `isPublished: true`, `publishedAt: now`, **notifie les étudiants** |
| `CLOSED` | `PUBLISHED` | Ferme l'accès à l'examen |
| `ARCHIVED` | Tout statut | Archive l'examen |

> **Notification automatique** : Lors du passage à `PUBLISHED`, le backend envoie automatiquement une notification à tous les étudiants des classes liées au syllabus de l'examen (ou aux niveaux cibles `targetLevels`).

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "status": "PUBLISHED",
    "isPublished": true,
    "publishedAt": "2025-01-18T14:00:00.000Z"
  },
  "message": "Exam status updated to PUBLISHED"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Invalid status"` | Valeur de statut non reconnue |
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Unauthorized to modify this exam"` | N'est pas le créateur |
| 404 | `"Exam not found"` | Examen inexistant |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 6. Valider un examen

```
POST /api/exams/:id/validate
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` ou `INSPECTOR`

> Fait passer un examen de `PENDING_VALIDATION` → `VALIDATED`. Correspond au processus pédagogique de relecture par un pair ou inspecteur.

#### Corps de la requête

Aucun corps requis (envoyer `{}` ou corps vide).

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "status": "VALIDATED",
    "validatedBy": "507f1f77bcf86cd799439022",
    "validatedAt": "2025-01-17T09:00:00.000Z"
  },
  "message": "Exam validated successfully"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Forbidden: Only teachers and inspectors can validate exams"` | Rôle non autorisé |
| 403 | `"Cannot validate..."` | Transition de statut invalide |
| 404 | `"...not found"` | Examen inexistant |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 7. Publier un examen

```
POST /api/exams/:id/publish
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (owner) ou rôle avec permissions suffisantes

> Fait passer un examen de `VALIDATED` → `PUBLISHED`. Cet endpoint est une alternative plus stricte à `PATCH /status` — il passe par le `ExamWorkflowService` qui vérifie les transitions de statut.

#### Corps de la requête

Aucun corps requis.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439200",
    "title": "Contrôle Mécanique — Terminale C",
    "status": "PUBLISHED",
    "isPublished": true,
    "publishedAt": "2025-01-18T14:00:00.000Z"
  },
  "message": "Exam published successfully"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Unauthorized"` ou `"Cannot publish..."` | Pas les droits ou mauvais statut courant |
| 404 | `"...not found"` | Examen inexistant |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 8. Consulter les résultats d'un examen

```
GET /api/exams/:id/results
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (owner uniquement)

> Retourne les statistiques globales + la liste détaillée de toutes les tentatives pour cet examen.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "exam": {
      "id": "507f1f77bcf86cd799439200",
      "title": "Contrôle Mécanique — Terminale C",
      "duration": 60,
      "passingScore": 50
    },
    "stats": {
      "totalAttempts": 28,
      "completedAttempts": 25,
      "inProgressAttempts": 3,
      "averageScore": 67,
      "highestScore": 95,
      "lowestScore": 20,
      "passRate": 72,
      "averageTimeSpent": 45
    },
    "distribution": [
      { "range": "0-20", "count": 2 },
      { "range": "21-40", "count": 3 },
      { "range": "41-60", "count": 5 },
      { "range": "61-80", "count": 10 },
      { "range": "81-100", "count": 5 }
    ],
    "attempts": [
      {
        "id": "507f1f77bcf86cd799439300",
        "studentId": "507f1f77bcf86cd799439050",
        "studentName": "Marie Dupont",
        "studentEmail": "marie.dupont@example.com",
        "studentCode": "STD2024001",
        "studentImage": "https://...",
        "status": "COMPLETED",
        "score": 14,
        "maxScore": 20,
        "percentage": 70,
        "passed": true,
        "timeSpent": 52,
        "timeSpentFormatted": "52m",
        "startedAt": "2025-01-20T08:05:00.000Z",
        "submittedAt": "2025-01-20T08:57:00.000Z",
        "tabSwitchCount": 0,
        "suspiciousActivity": false
      }
    ]
  }
}
```

#### Champs de `stats`

| Champ | Type | Description |
|-------|------|-------------|
| `totalAttempts` | number | Nombre total de tentatives (toutes statuts) |
| `completedAttempts` | number | Tentatives terminées (`COMPLETED`) |
| `inProgressAttempts` | number | Tentatives en cours (`STARTED`) |
| `averageScore` | number | Score moyen en % |
| `highestScore` | number | Meilleur score en % |
| `lowestScore` | number | Score le plus bas en % |
| `passRate` | number | % d'étudiants ayant passé (score ≥ `passingScore`) |
| `averageTimeSpent` | number | Temps moyen en minutes |

#### Champs de `attempts[]`

| Champ | Type | Description |
|-------|------|-------------|
| `tabSwitchCount` | number | Nombre de changements d'onglet détectés |
| `suspiciousActivity` | boolean | Activité suspecte détectée par l'anti-triche |

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 403 | `"Accès non autorisé"` | N'est pas le créateur de l'examen |
| 404 | `"Examen non trouvé"` | Examen inexistant |
| 500 | `"Erreur serveur"` | Erreur serveur |

> **Note** : Cet endpoint retourne les messages d'erreur **en français** (contrairement aux autres qui les retournent en anglais).

---

### 9. Obtenir les codes tardifs d'un examen

```
GET /api/exams/:id/late-codes
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (owner uniquement)

> Récupère la liste des codes d'accès tardifs (`LateCode`) générés pour cet examen. Voir **Module 13 — Late Codes** pour la création.

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439400",
      "examId": "507f1f77bcf86cd799439200",
      "code": "LATE-XK7F9",
      "assignedUserId": {
        "_id": "507f1f77bcf86cd799439050",
        "name": "Marie Dupont",
        "email": "marie.dupont@example.com"
      },
      "createdBy": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Prof. Martin"
      },
      "expiresAt": "2025-01-20T11:00:00.000Z",
      "used": false,
      "createdAt": "2025-01-20T09:30:00.000Z"
    }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 403 | `"Accès non autorisé"` | N'est pas le créateur |
| 404 | `"Examen non trouvé"` | Examen inexistant |
| 500 | `"Erreur serveur"` | Erreur serveur |

---

## Flux complets recommandés

### Flux 1 : Créer et publier un examen (mode simplifié)

```
1. GET  /api/syllabus                         → Charger les syllabus du prof (pour liaison)
2. POST /api/exams                            → Créer l'examen avec ses questions
   → Récupérer le _id dans la réponse (exam.id)
3. PATCH /api/exams/:id/status { status: "PUBLISHED" }
   → Publier directement (workflow simplifié)
   → Les étudiants reçoivent une notification automatique
4. Rediriger vers /teacher/exams/:id          → Vue de surveillance
```

### Flux 2 : Workflow complet avec validation pédagogique

```
1. POST /api/exams                                          → Créer (status: DRAFT)
2. PATCH /api/exams/:id/status { status: "PENDING_VALIDATION" } → Soumettre à validation
   (L'inspecteur ou un autre enseignant prend le relai)
3. POST /api/exams/:id/validate                             → Valider (Teacher/Inspector)
4. POST /api/exams/:id/publish                              → Publier (Owner)
```

### Flux 3 : Page résultats

```
1. GET /api/exams/:id/results                 → Charger stats + liste des tentatives
2. GET /api/exams/:id/late-codes              → Charger les codes tardifs
   → Afficher tableau de résultats avec colonnes : étudiant, score, temps, activité suspecte
```

### Flux 4 : Modifier un examen existant

```
1. GET /api/exams                             → Lister les examens
2. (Frontend charge les données de l'examen depuis le state ou un GET par ID)
3. PUT /api/exams/:id                         → Envoyer TOUTES les données (titre + dates + questions)
   → Vérifier si warning: true dans la réponse
   → Si warning: true, informer l'utilisateur que les questions n'ont pas changé
```

---

## Enums de référence

### ExamStatus

| Valeur | Description |
|--------|-------------|
| `DRAFT` | Brouillon (statut par défaut à la création) |
| `PENDING_VALIDATION` | En attente de relecture pédagogique |
| `VALIDATED` | Validé, prêt à être publié |
| `PUBLISHED` | Publié — visible et accessible aux étudiants |
| `CLOSED` | Fermé — plus accessible aux étudiants |
| `ARCHIVED` | Archivé — masqué des listes |

### CloseMode

| Valeur | Description |
|--------|-------------|
| `STRICT` | L'accès se ferme exactement à `endTime` |
| `PERMISSIVE` | Les tentatives en cours peuvent être terminées après `endTime` |

---

## Incohérences API à noter

| Endpoint | Format de réponse succès | Format d'erreur | Remarque |
|----------|--------------------------|-----------------|----------|
| `POST /api/exams` | `{ message, exam }` | `{ message }` | Pas de clé `success` ni `data` |
| `PUT /api/exams/:id` | `{ message, exam }` | `{ message }` | Même format non standard |
| `DELETE /api/exams/:id` | `{ message }` | `{ message }` | Pas de clé `success` |
| `PATCH /api/exams/:id/status` | `{ success, data, message }` | `{ success, message }` | Format standard |
| `POST /api/exams/:id/validate` | `{ success, data, message }` | `{ success, message }` | Format standard |
| `GET /api/exams/:id/results` | `{ success, data }` | Messages **en français** | Messages d'erreur en français |
| `GET /api/exams/:id/late-codes` | `{ success, data }` | Messages **en français** | Messages d'erreur en français |

> **Recommandation frontend** : Ne pas supposer un format unique — tester la présence de `success`, `data`, `message` et `exam` selon l'endpoint.
