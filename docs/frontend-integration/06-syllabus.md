# Module 06 — Syllabus

> **Audience** : Équipe frontend externe
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)
> **Auth** : Cookie de session `next-auth.session-token` (obtenu après login)

---

## Vue d'ensemble

Le module Syllabus permet aux enseignants de créer et gérer des programmes pédagogiques structurés, composés de chapitres, sujets, concepts clés et ressources. Les syllabus sont assignables à des classes et servent de base pour créer des examens.

### Rôles concernés

| Rôle                       | Accès                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `TEACHER`                 | Créer, modifier, supprimer, cloner ses propres syllabus                                                                           |
| `TEACHER` (collaborateur) | Modifier la structure d'un syllabus assigné à une classe dont il est collaborateur (ne peut pas modifier les classes assignées) |
| `STUDENT`                 | Auto-évaluation sur les concepts d'un syllabus                                                                                    |

### Pages frontend concernées

| Page                  | URL frontend                   | Action                                       |
| --------------------- | ------------------------------ | -------------------------------------------- |
| Liste des syllabus    | `/teacher/syllabus`          | Affiche, filtre, duplique, supprime          |
| Créer un syllabus    | `/teacher/syllabus/create`   | Formulaire en 4 étapes (wizard)             |
| Détail d'un syllabus | `/teacher/syllabus/:id`      | Lecture + navigation vers création d'examen |
| Modifier un syllabus  | `/teacher/syllabus/:id/edit` | Même formulaire wizard en mode édition     |

### Architecture de données

```
Syllabus
├── title              (string, requis)
├── description        (string)
├── subject            (ObjectId → Subject, requis)
├── teacher            (ObjectId → User, auto-rempli)
├── school             (ObjectId → School, optionnel — déduit de la classe)
├── classes            (ObjectId[] → Class)
├── learningObjectives (string[])
├── status             (DRAFT | ACTIVE | ARCHIVED)
├── version            (number, incrémenté à chaque mise à jour)
└── structure
    └── chapters[]
        ├── title
        ├── description
        └── topics[]
            ├── title
            ├── content
            ├── concepts[]
            │   ├── id (UUID local)
            │   ├── title
            │   └── description
            └── resources[]
                ├── title
                ├── type  (PDF | VIDEO | LINK | TEXT)
                ├── url
                └── content
```

### Concept clé : Suppression logique

La **suppression** d'un syllabus est un **archivage** (`status: ARCHIVED`). Le syllabus n'est plus retourné dans les listes mais n'est pas effacé de la base.

## Endpoints

### 1. Lister les syllabus

```
GET /api/syllabus
```

**Auth requise** : Oui
**Rôle** : Tout utilisateur authentifié (filtre par `teacher = userId`)

#### Query Parameters

| Paramètre   | Type     | Description                                      |
| ------------ | -------- | ------------------------------------------------ |
| `subject`  | ObjectId | Filtrer par matière                             |
| `search`   | string   | Recherche dans le titre (insensible à la casse) |
| `schoolId` | ObjectId | Filtrer par école                               |

> **Note** : Le paramètre `level` visible dans `syllabusApi.getAll()` du frontend n'est **pas** traité côté backend — seuls `subject`, `search` et `schoolId` sont filtrés.

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439090",
      "title": "Syllabus Terminale C — Physique",
      "description": "Programme du premier trimestre, mécanique et thermodynamique",
      "subject": {
        "_id": "507f1f77bcf86cd799439031",
        "name": "Physique-Chimie"
      },
      "school": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Lycée Bilingue"
      },
      "teacher": "507f1f77bcf86cd799439011",
      "classes": ["68a1b2c3d4e5f6789abcdef0"],
      "learningObjectives": [
        "Comprendre les lois de Newton",
        "Appliquer le principe de conservation de l'énergie"
      ],
      "status": "DRAFT",
      "version": 1,
      "structure": {
        "chapters": [
          {
            "title": "Mécanique",
            "description": "Les forces et le mouvement",
            "topics": [
              {
                "title": "Les lois de Newton",
                "content": "Présentation des trois lois fondamentales",
                "concepts": [
                  {
                    "id": "abc123def",
                    "title": "Principe d'inertie",
                    "description": "Un corps au repos reste au repos..."
                  }
                ],
                "resources": [
                  {
                    "title": "Vidéo explicative Newton",
                    "type": "VIDEO",
                    "url": "https://youtube.com/..."
                  }
                ]
              }
            ]
          }
        ]
      },
      "createdAt": "2024-09-01T08:00:00.000Z",
      "updatedAt": "2024-09-15T10:00:00.000Z"
    }
  ]
}
```

> Les syllabus avec `status: ARCHIVED` sont **exclus** de cette liste.

#### Erreurs

| Code | Message                     | Cause            |
| ---- | --------------------------- | ---------------- |
| 401  | `"Unauthorized"`          | Non authentifié |
| 500  | `"Internal server error"` | Erreur serveur   |

---

### 2. Créer un syllabus

```
POST /api/syllabus
```

**Auth requise** : Oui**Rôle** : `TEACHER` uniquement

> **Flux frontend** : Après la création, le frontend appelle automatiquement `POST /api/concepts/sync` pour persister les concepts dans leur collection dédiée. Voir endpoint 7.

#### Corps de la requête

```json
{
  "title": "Syllabus Terminale C — Physique",
  "description": "Programme du premier trimestre",
  "subject": "507f1f77bcf86cd799439031",
  "school": "507f1f77bcf86cd799439012",
  "classes": ["68a1b2c3d4e5f6789abcdef0"],
  "learningObjectives": [
    "Comprendre les lois de Newton",
    "Appliquer le principe de conservation de l'énergie"
  ],
  "structure": {
    "chapters": [
      {
        "title": "Mécanique",
        "description": "Les forces et le mouvement",
        "topics": [
          {
            "title": "Les lois de Newton",
            "content": "Présentation des trois lois fondamentales",
            "concepts": [
              {
                "id": "abc123def",
                "title": "Principe d'inertie",
                "description": "Un corps au repos reste au repos..."
              }
            ],
            "resources": [
              {
                "title": "Vidéo Newton",
                "type": "VIDEO",
                "url": "https://youtube.com/..."
              }
            ]
          }
        ]
      }
    ]
  }
}
```

| Champ                  | Type       | Requis        | Description                                                                              |
| ---------------------- | ---------- | ------------- | ---------------------------------------------------------------------------------------- |
| `title`              | string     | **Oui** | Titre du syllabus                                                                        |
| `subject`            | ObjectId   | **Oui** | ID de la matière                                                                        |
| `description`        | string     | Non           | Description générale                                                                   |
| `school`             | ObjectId   | Non           | Déduit automatiquement de la classe si non fourni                                       |
| `classes`            | ObjectId[] | Non           | Classes assignées (max 1 par le formulaire frontend, mais le modèle accepte plusieurs) |
| `learningObjectives` | string[]   | Non           | Objectifs pédagogiques                                                                  |
| `structure`          | object     | Non           | Structure des chapitres (voir ci-dessous)                                                |

#### Structure `structure.chapters[]`

| Champ           | Type   | Description             |
| --------------- | ------ | ----------------------- |
| `title`       | string | Titre du chapitre       |
| `description` | string | Description optionnelle |
| `topics[]`    | array  | Sujets du chapitre      |

#### Structure `topics[]`

| Champ           | Type   | Description                                |
| --------------- | ------ | ------------------------------------------ |
| `title`       | string | Titre du sujet                             |
| `content`     | string | Contenu/description du sujet               |
| `concepts[]`  | array  | Concepts clés (voir ci-dessous)           |
| `resources[]` | array  | Ressources pédagogiques (voir ci-dessous) |

#### Structure `concepts[]`

| Champ           | Type   | Description                                       |
| --------------- | ------ | ------------------------------------------------- |
| `id`          | string | ID local (généré côté frontend, non-MongoDB) |
| `title`       | string | Nom du concept                                    |
| `description` | string | Description optionnelle                           |

#### Structure `resources[]`

| Champ       | Type   | Valeurs                                | Description                 |
| ----------- | ------ | -------------------------------------- | --------------------------- |
| `title`   | string | —                                     | Titre de la ressource       |
| `type`    | string | `PDF`, `VIDEO`, `LINK`, `TEXT` | Type de ressource           |
| `url`     | string | —                                     | URL (pour PDF, VIDEO, LINK) |
| `content` | string | —                                     | Contenu texte (pour TEXT)   |

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439090",
    "title": "Syllabus Terminale C — Physique",
    "subject": "507f1f77bcf86cd799439031",
    "teacher": "507f1f77bcf86cd799439011",
    "status": "DRAFT",
    "version": 1,
    "structure": { "chapters": [ ... ] },
    "createdAt": "2025-01-10T14:00:00.000Z"
  }
}
```

> Après réception du `_id`, appeler immédiatement `POST /api/concepts/sync` pour synchroniser les concepts.

#### Erreurs

| Code | Message                       | Cause                             |
| ---- | ----------------------------- | --------------------------------- |
| 400  | `"Missing required fields"` | `title` ou `subject` manquant |
| 401  | `"Unauthorized"`            | Non enseignant                    |
| 500  | `"Internal server error"`   | Erreur serveur                    |

---

### 3. Obtenir un syllabus par ID

```
GET /api/syllabus/:id
```

**Auth requise** : Oui

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439090",
    "title": "Syllabus Terminale C — Physique",
    "description": "Programme du premier trimestre",
    "subject": {
      "_id": "507f1f77bcf86cd799439031",
      "name": "Physique-Chimie"
    },
    "teacher": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Prof. Martin"
    },
    "school": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Lycée Bilingue"
    },
    "classes": [
      {
        "_id": "68a1b2c3d4e5f6789abcdef0",
        "name": "Terminale A1",
        "level": { "_id": "...", "name": "Terminale" }
      }
    ],
    "learningObjectives": ["Comprendre les lois de Newton"],
    "status": "DRAFT",
    "version": 2,
    "structure": {
      "chapters": [ ... ]
    },
    "createdAt": "2024-09-01T08:00:00.000Z",
    "updatedAt": "2024-09-20T10:00:00.000Z"
  }
}
```

> **`_rawSubjectId`** : En cas d'échec du populate de `subject`, le backend retourne un champ `_rawSubjectId` avec l'ObjectId brut de la matière. Le frontend doit l'utiliser comme fallback pour appeler `/api/subjects/:id`.

#### Erreurs

| Code | Message                   | Cause                           |
| ---- | ------------------------- | ------------------------------- |
| 400  | `"Invalid syllabus ID"` | ID malformé                    |
| 401  | `"Unauthorized"`        | Non authentifié                |
| 404  | `"Syllabus not found"`  | Syllabus inexistant ou archivé |

---

### 4. Modifier un syllabus

```
PUT /api/syllabus/:id
```

**Auth requise** : Oui**Condition** : Être le `teacher` (owner) **OU** être collaborateur d'une classe assignée au syllabus

> **Restriction** : Seul le `teacher` (owner) peut modifier le tableau `classes`. Un collaborateur qui tente de changer les classes assignées reçoit une erreur 403.

> **Versioning** : À chaque mise à jour, le champ `version` est incrémenté automatiquement (`$inc: { version: 1 }`).

#### Corps de la requête

Envoyer uniquement les champs à modifier :

```json
{
  "title": "Syllabus Terminale C — Physique (mis à jour)",
  "description": "Programme révisé",
  "subject": "507f1f77bcf86cd799439031",
  "classes": ["68a1b2c3d4e5f6789abcdef0"],
  "learningObjectives": ["Comprendre les lois de Newton", "Maîtriser la thermodynamique"],
  "status": "ACTIVE",
  "structure": {
    "chapters": [ ... ]
  }
}
```

| Champ                  | Type       | Description                                 |
| ---------------------- | ---------- | ------------------------------------------- |
| `title`              | string     | Nouveau titre                               |
| `description`        | string     | Nouvelle description                        |
| `subject`            | ObjectId   | Nouvelle matière                           |
| `classes`            | ObjectId[] | Classes assignées (owner uniquement)       |
| `learningObjectives` | string[]   | Remplace complètement la liste d'objectifs |
| `status`             | string     | `DRAFT`, `ACTIVE`, `ARCHIVED`         |
| `structure`          | object     | Remplace complètement la structure         |

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439090",
    "title": "Syllabus Terminale C — Physique (mis à jour)",
    "version": 3,
    "status": "ACTIVE",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

> Même flux que la création : appeler `POST /api/concepts/sync` après la mise à jour pour synchroniser les concepts.

#### Erreurs

| Code | Message                                                     | Cause                                      |
| ---- | ----------------------------------------------------------- | ------------------------------------------ |
| 400  | `"Invalid syllabus ID"`                                   | ID malformé                               |
| 401  | `"Unauthorized"`                                          | Non authentifié                           |
| 403  | `"Forbidden"`                                             | Ni owner ni collaborateur                  |
| 403  | `"Forbidden: Only the owner can modify assigned classes"` | Collaborateur tente de changer les classes |
| 404  | `"Syllabus not found"`                                    | Syllabus inexistant                        |

---

### 5. Supprimer (archiver) un syllabus

```
DELETE /api/syllabus/:id
```

**Auth requise** : Oui**Condition** : Être le `teacher` (owner) uniquement

> **Important** : La suppression est un **archivage** (`status: ARCHIVED`). Le syllabus disparaît des listes mais reste dans la base. Cette action est irréversible via l'API.

#### Réponse 200

```json
{
  "success": true,
  "message": "Syllabus archived"
}
```

#### Erreurs

| Code | Message                   | Cause               |
| ---- | ------------------------- | ------------------- |
| 400  | `"Invalid syllabus ID"` | ID malformé        |
| 401  | `"Unauthorized"`        | Non authentifié    |
| 403  | `"Forbidden"`           | N'est pas l'owner   |
| 404  | `"Syllabus not found"`  | Syllabus inexistant |

---

### 6. Cloner un syllabus

```
POST /api/syllabus/:id/clone
```

**Auth requise** : Oui

> Crée une copie complète du syllabus pour l'utilisateur connecté. Le clone a :
>
> - Le titre préfixé `"Copie de [titre original]"`
> - `status: DRAFT` (réinitialisé)
> - `version: 1` (réinitialisé)
> - `classes: []` (les classes ne sont **pas** copiées)
> - Le `teacher` devient l'utilisateur connecté

#### Corps de la requête

Aucun corps requis (envoyer `{}` ou un body vide).

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439091",
    "title": "Copie de Syllabus Terminale C — Physique",
    "subject": "507f1f77bcf86cd799439031",
    "teacher": "507f1f77bcf86cd799439011",
    "status": "DRAFT",
    "version": 1,
    "classes": [],
    "structure": { "chapters": [ ... ] },
    "createdAt": "2025-01-15T14:00:00.000Z"
  }
}
```

#### Erreurs

| Code | Message                           | Cause                      |
| ---- | --------------------------------- | -------------------------- |
| 400  | `"Invalid syllabus ID"`         | ID malformé               |
| 401  | `"Unauthorized"`                | Non authentifié           |
| 404  | `"Original syllabus not found"` | Syllabus source inexistant |

---

### 7. Synchroniser les concepts (appelé après create/update)

```
POST /api/concepts/sync
```

**Auth requise** : Oui

> **Endpoint complémentaire** : appelé automatiquement par le frontend après chaque création ou mise à jour d'un syllabus pour persister les concepts dans leur collection MongoDB dédiée. Cela permet l'auto-évaluation des élèves sur les concepts.
>
> **Comportement** : Supprime les concepts existants non présents dans la liste, puis fait un upsert de tous les concepts fournis (bulk write).

#### Corps de la requête

```json
{
  "syllabusId": "507f1f77bcf86cd799439090",
  "concepts": [
    {
      "_id": "507f1f77bcf86cd799439100",
      "title": "Principe d'inertie",
      "description": "Un corps au repos reste au repos...",
      "order": 0
    },
    {
      "title": "Deuxième loi de Newton",
      "description": "F = ma",
      "order": 1
    }
  ]
}
```

| Champ                      | Type     | Description                                                     |
| -------------------------- | -------- | --------------------------------------------------------------- |
| `syllabusId`             | ObjectId | **Requis** — ID du syllabus                              |
| `concepts[]`             | array    | **Requis** — Liste des concepts (peut être vide `[]`) |
| `concepts[]._id`         | ObjectId | Optionnel — ID MongoDB existant pour mise à jour              |
| `concepts[].title`       | string   | Nom du concept                                                  |
| `concepts[].description` | string   | Description optionnelle                                         |
| `concepts[].order`       | number   | Position dans la liste                                          |

> **Concepts sans `_id`** : Nouveaux concepts, un ObjectId est auto-généré.
> **Concepts avec `_id` valide** : Mis à jour.
> **Concepts absents de la liste** : Supprimés de la collection.

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439100",
      "title": "Principe d'inertie",
      "description": "Un corps au repos reste au repos...",
      "syllabus": "507f1f77bcf86cd799439090",
      "order": 0
    }
  ],
  "message": "2 concepts synchronized"
}
```

> **Note** : En cas d'erreur de sync, le frontend l'ignore (warning en console uniquement) — la création/mise à jour du syllabus reste valide.

#### Erreurs

| Code | Clé                                       | Cause              |
| ---- | ------------------------------------------ | ------------------ |
| 400  | `{ error: "Invalid syllabus ID" }`       | ID malformé       |
| 400  | `{ error: "Concepts must be an array" }` | Concepts non-array |
| 401  | `{ error: "Unauthorized" }`              | Non authentifié   |
| 500  | `{ error: "Internal Server Error" }`     | Erreur serveur     |

> **Attention** : Cet endpoint retourne `{ error: "..." }` au lieu de `{ success: false, message: "..." }`.

---

### 8. Auto-évaluation d'un concept (élève)

```
POST /api/syllabus/concepts/evaluate
```

**Auth requise** : Oui**Rôle** : Élève (`STUDENT`)

> Permet à un élève de s'auto-évaluer sur un concept. Ce résultat est utilisé dans les analytics.

#### Corps de la requête

```json
{
  "conceptId": "507f1f77bcf86cd799439100",
  "syllabusId": "507f1f77bcf86cd799439090",
  "level": 3,
  "reflection": "Je maîtrise bien ce concept, j'ai pu l'appliquer dans l'exercice 4"
}
```

| Champ          | Type     | Requis        | Description                         |
| -------------- | -------- | ------------- | ----------------------------------- |
| `conceptId`  | ObjectId | **Oui** | ID du concept évalué              |
| `syllabusId` | ObjectId | **Oui** | ID du syllabus contenant le concept |
| `level`      | number   | **Oui** | Niveau de maîtrise (ex: 1 à 5)    |
| `reflection` | string   | Non           | Commentaire de l'élève            |

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439110",
    "studentId": "507f1f77bcf86cd799439050",
    "conceptId": "507f1f77bcf86cd799439100",
    "syllabusId": "507f1f77bcf86cd799439090",
    "level": 3,
    "reflection": "Je maîtrise bien ce concept...",
    "createdAt": "2025-01-15T14:30:00.000Z"
  }
}
```

#### Erreurs

| Code | Message                                                                      | Cause            |
| ---- | ---------------------------------------------------------------------------- | ---------------- |
| 400  | `"Missing required fields: conceptId, syllabusId, and level are required"` | Champs manquants |
| 401  | `"Unauthorized"`                                                           | Non authentifié |

---

## Flux complets recommandés

### Flux 1 : Créer un syllabus

```
1. GET  /api/classes                     → Charger la liste des classes du prof (pour le picker)
2. GET  /api/subjects?level=:levelId     → Charger les matières filtrées par niveau de la classe
3. POST /api/syllabus                    → Créer le syllabus
   → Récupérer le _id dans la réponse
4. POST /api/concepts/sync               → Synchroniser les concepts dans leur collection dédiée
   → Envoyer { syllabusId: _id, concepts: [...] }
5. Rediriger vers /teacher/syllabus/:id
```

### Flux 2 : Modifier un syllabus

```
1. GET  /api/syllabus/:id                → Charger les données existantes
2. GET  /api/classes                     → Charger les classes (pour la sélection)
3. GET  /api/subjects?level=:levelId     → Charger les matières (filtrées par niveau)
4. PUT  /api/syllabus/:id                → Mettre à jour
5. POST /api/concepts/sync               → Resynchroniser les concepts
```

### Flux 3 : Page liste des syllabus

```
1. GET  /api/syllabus?schoolId=:id       → Charger les syllabus de l'école sélectionnée
   OU
   GET  /api/syllabus                    → Tous les syllabus (mode libre)
2. POST /api/syllabus/:id/clone          → Dupliquer (afficher le clone en tête de liste)
3. DELETE /api/syllabus/:id              → Archiver (retirer de la liste UI)
```

---

## Enums de référence

### SyllabusStatus

| Valeur       | Description                                        |
| ------------ | -------------------------------------------------- |
| `DRAFT`    | Brouillon (défaut à la création)                |
| `ACTIVE`   | Actif / publié                                    |
| `ARCHIVED` | Archivé (supprimé logiquement, exclu des listes) |

### ResourceType

| Valeur    | Description                |
| --------- | -------------------------- |
| `PDF`   | Fichier PDF                |
| `VIDEO` | Vidéo (URL YouTube, etc.) |
| `LINK`  | Lien web                   |
| `TEXT`  | Contenu texte inline       |

---

## Inconsistances API à noter

| Endpoint                            | Format d'erreur                        | Remarque                      |
| ----------------------------------- | -------------------------------------- | ----------------------------- |
| `POST /api/concepts/sync`         | `{ error: "..." }`                   | Différent des autres modules |
| Tous les autres `/api/syllabus/*` | `{ success: false, message: "..." }` | Format standard               |
