# Module 04 — Schools (Établissements)

> **Base URL** : `http://localhost:3001` (dev)  
> **Auth** : Session NextAuth (cookie `next-auth.session-token`) — sauf endpoints marqués **Public**  
> **Content-Type** : `application/json`

---

## Vue d'ensemble

Le module Schools couvre l'intégralité du cycle de vie d'un établissement scolaire sur la plateforme :

```
Création     →  PENDING  →  VALIDATED  (ou REJECTED / SUSPENDED)
                   ↑
           Soumise par un SCHOOL_ADMIN lors de l'inscription
           Validée par un admin plateforme (RECTOR, DG_M4M, etc.)
```

### Qui fait quoi

| Rôle | Actions autorisées |
|------|--------------------|
| **Public** | Rechercher des écoles validées, voir la liste publique |
| **STUDENT** | Parcourir les écoles pour l'orientation, postuler |
| **TEACHER** | Voir ses écoles, postuler à une école, voir les classes/enseignants |
| **SCHOOL_ADMIN** | Approuver/rejeter des candidatures d'enseignants, inviter des enseignants, voir les stats |
| **RECTOR / DG_M4M / DG_ISIMMA / TECH_SUPPORT** | Valider, rejeter ou suspendre une école sur la plateforme |

### Statuts d'une école (`SchoolStatus`)

| Statut | Description |
|--------|-------------|
| `PENDING` | En attente de validation par la plateforme |
| `VALIDATED` | École vérifiée et visible — apparaît dans les listes publiques |
| `REJECTED` | Rejetée par la plateforme (fraude, doublon, données incorrectes) |
| `SUSPENDED` | Suspendue après validation (violation détectée ultérieurement) |

### Types d'établissements (`SchoolType`)

| Valeur | Description |
|--------|-------------|
| `PRESCHOOL` | Préscolaire (maternelle, pépinière) |
| `PRIMARY` | École primaire |
| `SECONDARY_GENERAL` | Lycée / Collège général |
| `SECONDARY_TECHNICAL` | CETIC / Lycée technique |
| `TEACHER_TRAINING` | ENIEG / ENIET / TTC |
| `HIGHER_ED` | Université / Grandes écoles / BTS |
| `NON_FORMAL` | Alphabétisation, formation non formelle |
| `SECONDARY` | Alias → SECONDARY_GENERAL |
| `TRAINING_CENTER` | Alias → SECONDARY_TECHNICAL ou HIGHER_ED |
| `OTHER` | Autre |

---

## Endpoints

---

### 1. `GET /api/schools/public` — Liste publique des écoles validées

**Accès** : Public (aucune authentification requise)  
**Usage** : Sélectionner une école lors de la création de compte (`SCHOOL_ADMIN`)

#### Paramètres de requête

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `search` | string | `""` | Filtre sur le nom (insensible à la casse) |

**Exemple :**
```
GET /api/schools/public?search=lycee
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
      "name": "Lycée Général de Yaoundé",
      "type": "SECONDARY_GENERAL",
      "address": "Rue de l'Éducation, Yaoundé",
      "logoUrl": "http://localhost:3001/uploads/schools/logo.png",
      "status": "VALIDATED",
      "contactInfo": {
        "email": "contact@lycee-yaounde.cm",
        "phone": "+237222000001",
        "website": "https://lycee-yaounde.cm"
      }
    }
  ]
}
```

> Retourne jusqu'à **20 résultats**, triés alphabétiquement.  
> Seules les écoles `status: VALIDATED` et `isActive: true` sont retournées.

#### Exceptions

| Code | Champ | Cause |
|------|-------|-------|
| `500` | `message: "Internal Server Error"` | Erreur interne |

---

### 2. `GET /api/schools/search` — Recherche fuzzy d'écoles

**Accès** : Public (aucune authentification requise)  
**Usage** : Auto-complétion lors de l'inscription d'un enseignant ou de la recherche d'école

#### Paramètres de requête

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `q` | string | Oui* | Terme de recherche (min 2 caractères) |
| `city` | string | Non | Filtrer par ville |
| `type` | string | Non | Filtrer par type (`SECONDARY_GENERAL`, etc.) |
| `limit` | number | Non | Nombre de résultats (défaut: `10`) |

> *Si `q` est absent ou fait moins de 2 caractères, retourne `{ schools: [], hasExactMatch: false }` avec `200`.

**Exemple :**
```
GET /api/schools/search?q=lycee&city=Yaoundé&limit=5
```

#### Réponse succès — `200 OK`

```json
{
  "schools": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
      "name": "Lycée Général de Yaoundé",
      "type": "SECONDARY_GENERAL",
      "address": "...",
      "logoUrl": "..."
    }
  ],
  "hasExactMatch": false
}
```

#### Exceptions

| Code | Champ | Cause |
|------|-------|-------|
| `500` | `error: "Erreur lors de la recherche d'écoles"` | Erreur interne |

---

### 3. `GET /api/schools` — Liste des écoles (authentifié)

**Accès** : Tous les utilisateurs authentifiés

Retourne les écoles selon des filtres. Par défaut, retourne uniquement les écoles `VALIDATED`. Passer `status=all` pour voir toutes les écoles (utile pour les admins).

#### Paramètres de requête

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `search` | string | — | Filtre sur le nom |
| `type` | string | — | Filtrer par `SchoolType` |
| `status` | string | `VALIDATED` | `PENDING`, `VALIDATED`, `REJECTED`, `SUSPENDED`, `all` |

**Exemples :**
```
GET /api/schools
GET /api/schools?search=lycee&type=SECONDARY_GENERAL
GET /api/schools?status=all
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
      "name": "Lycée Général de Yaoundé",
      "type": "SECONDARY_GENERAL",
      "status": "VALIDATED",
      "admins": [
        { "_id": "...", "name": "Paul Admin", "email": "paul@lycee.cm" }
      ],
      "teachers": ["64f...", "64f..."],
      "isActive": true,
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `500` | `"Internal server error"` | Erreur interne |

---

### 4. `GET /api/teacher/schools` — Mes écoles (enseignant connecté)

**Accès** : `TEACHER` uniquement

Retourne la liste des écoles auxquelles l'enseignant est membre (approuvé).

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
      "name": "Lycée Général de Yaoundé",
      "type": "SECONDARY_GENERAL",
      "logoUrl": "...",
      "status": "VALIDATED",
      "isPending": false
    },
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0e2",
      "name": "Collège Bilingue",
      "type": "SECONDARY_GENERAL",
      "status": "VALIDATED",
      "isPending": true
    }
  ]
}
```

> `isPending: true` → L'enseignant a postulé mais n'est pas encore approuvé par l'école.  
> Ces écoles apparaissent dans le Sidebar avec un badge **"En attente"**.

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Unauthorized"` | Session absente ou rôle non `TEACHER` |
| `500` | `"Internal server error"` | Erreur interne |

---

### 5. `POST /api/teacher/link-school` — Postuler à une école (TEACHER)

**Accès** : `TEACHER` uniquement

Soumet une demande d'adhésion à une école. La demande doit ensuite être approuvée par un `SCHOOL_ADMIN` de cet établissement.

#### Corps de la requête

```json
{
  "schoolId": "64f1a2b3c4d5e6f7a8b9c0e1"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `schoolId` | string (ObjectId) | Oui | ID de l'école ciblée |

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Application submitted successfully"
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `400` | `"School ID est requis"` | `schoolId` absent du body |
| `400` | `"Vous êtes déjà membre de cette école"` | Déjà approuvé dans cette école |
| `400` | `"Vous avez déjà postulé à cette école"` | Demande en double |
| `401` | `"Non authentifié"` | Session absente |
| `403` | `"Accès réservé aux enseignants"` | Rôle ≠ `TEACHER` |
| `404` | `"École non trouvée"` | `schoolId` invalide |
| `500` | `"Erreur interne du serveur"` | Erreur interne |

---

### 6. `POST /api/schools/apply` — Postuler à une école (tous rôles)

**Accès** : Utilisateurs authentifiés  
**Usage** : Alternative à `/api/teacher/link-school`, non restreinte au rôle TEACHER

#### Corps de la requête

```json
{
  "schoolId": "64f1a2b3c4d5e6f7a8b9c0e1"
}
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Application submitted successfully"
}
```

#### Exceptions

| Code | `error` | Cause |
|------|---------|-------|
| `400` | `"School ID is required"` | `schoolId` absent |
| `400` | `"You are already a member..."` ou `"already applied..."` | Doublon |
| `401` | `"Unauthorized"` | Session absente |
| `404` | `"School not found"` | `schoolId` invalide |
| `500` | `"Internal Server Error"` | Erreur interne |

> **Note** : Cet endpoint retourne `error` (pas `message`) pour les erreurs — différence avec `/api/teacher/link-school`.

---

### 7. `GET /api/schools/[id]/stats` — Statistiques d'une école

**Accès** : Tous les utilisateurs authentifiés  
**Usage** : Dashboard d'administration d'école (`SCHOOL_ADMIN`)

Calcule en temps réel des statistiques complètes de l'école : étudiants, enseignants, classes, examens, scores, graphiques.

#### Paramètres d'URL

| Paramètre | Description |
|-----------|-------------|
| `id` | ObjectId de l'école |

**Exemple :**
```
GET /api/schools/64f1a2b3c4d5e6f7a8b9c0e1/stats
```

#### Réponse succès — `200 OK`

```json
{
  "details": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
    "name": "Lycée Général de Yaoundé",
    "type": "SECONDARY_GENERAL",
    "status": "VALIDATED"
  },
  "stats": {
    "totalStudents": 248,
    "totalTeachers": 12,
    "adminsCount": 2,
    "activeClasses": 9,
    "examsCount": 47,
    "averageScore": 12.4,
    "completionRate": 78
  },
  "charts": {
    "scoreDistribution": [
      { "range": "0-20%",   "count": 8,  "color": "#ef4444" },
      { "range": "21-40%",  "count": 15, "color": "#f97316" },
      { "range": "41-60%",  "count": 42, "color": "#eab308" },
      { "range": "61-80%",  "count": 98, "color": "#3b82f6" },
      { "range": "81-100%", "count": 85, "color": "#22c55e" }
    ],
    "recentPerformance": [
      { "name": "S1", "score": 11.2, "exams": 4 },
      { "name": "S2", "score": 12.8, "exams": 6 },
      { "name": "S3", "score": 13.1, "exams": 5 },
      { "name": "S4", "score": 12.4, "exams": 7 }
    ],
    "classDistribution": [
      { "name": "Terminale", "value": 3 },
      { "name": "Première",  "value": 3 },
      { "name": "Seconde",   "value": 3 }
    ],
    "recentExams": [
      {
        "id": "64f1...",
        "title": "Bac Blanc Mathématiques",
        "subject": "Mathématiques",
        "date": "2025-03-10T08:00:00.000Z",
        "status": "COMPLETED"
      }
    ]
  }
}
```

**Détail des champs :**

| Champ | Description |
|-------|-------------|
| `stats.totalStudents` | Étudiants uniques dans toutes les classes de l'école |
| `stats.totalTeachers` | Enseignants membres de l'école |
| `stats.adminsCount` | Administrateurs de l'école |
| `stats.averageScore` | Moyenne des scores sur 20 (arrondie à 1 décimale) |
| `stats.completionRate` | % d'examens complétés (0–100) |
| `charts.recentPerformance` | Tendance sur les 8 dernières semaines (S1 = la plus ancienne) |
| `charts.scoreDistribution` | Distribution des scores par tranche de 20% |
| `charts.classDistribution` | Répartition des classes par niveau |

#### Exceptions

| Code | `error` | Cause |
|------|---------|-------|
| `400` | `"Invalid school ID"` | ID absent ou `"undefined"` |
| `401` | `"Unauthorized"` | Session absente |
| `404` | `"School not found"` | Aucune école pour cet ID |
| `500` | `"Internal Server Error"` | Erreur interne |

---

### 8. `GET /api/schools/[id]/teachers` — Enseignants d'une école

**Accès** : Tous les utilisateurs authentifiés

Retourne la liste des enseignants membres de l'école, ainsi que les candidatures en attente.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": {
    "teachers": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "name": "Marie Curie",
        "email": "marie@lycee.cm",
        "image": "http://localhost:3001/uploads/avatars/...",
        "role": "TEACHER"
      }
    ],
    "applicants": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "name": "Albert Einstein",
        "email": "albert@lycee.cm",
        "createdAt": "2025-03-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Exceptions

| Code | `error` | Cause |
|------|---------|-------|
| `400` | `"Invalid school ID"` | ID absent ou invalide |
| `500` | `"Internal Server Error"` | Erreur interne |

---

### 9. `GET /api/schools/[id]/classes` — Classes d'une école

**Accès** : Tous les utilisateurs authentifiés

Retourne toutes les classes de l'école.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0c1",
      "name": "Terminale A - 2024",
      "level": { "_id": "...", "name": "Terminale" },
      "mainTeacher": { "_id": "...", "name": "Marie Curie" },
      "students": ["64f...", "64f..."],
      "isActive": true,
      "validationStatus": "VALIDATED"
    }
  ]
}
```

#### Exceptions

| Code | `success` / `message` | Cause |
|------|----------------------|-------|
| `400` | `false / "Invalid school ID"` | ID absent ou invalide |
| `401` | — `"Unauthorized"` | Session absente |
| `500` | `false / "Internal Server Error"` | Erreur interne |

---

### 10. `POST /api/schools/[id]/teachers/[teacherId]/approve` — Approuver un enseignant

**Accès** : Authentifié (usage `SCHOOL_ADMIN`)

Approuve la candidature d'un enseignant dans l'école. L'enseignant est déplacé de `applicants[]` vers `teachers[]`. Les classes indépendantes de l'enseignant sont automatiquement **greffées** à l'école et validées.

#### Paramètres d'URL

| Paramètre | Description |
|-----------|-------------|
| `id` | ObjectId de l'école |
| `teacherId` | ObjectId de l'enseignant candidat |

**Exemple :**
```
POST /api/schools/64f1a2b3c4d5e6f7a8b9c0e1/teachers/64f1a2b3c4d5e6f7a8b9c0d2/approve
```

#### Corps de la requête

Aucun body requis.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Professeur approuvé avec succès",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
    "name": "Lycée Général de Yaoundé",
    "teachers": ["64f1a2b3c4d5e6f7a8b9c0d1", "64f1a2b3c4d5e6f7a8b9c0d2"]
  }
}
```

> **Effet de bord important** : Les classes indépendantes créées par cet enseignant (avant l'approbation) sont automatiquement rattachées à l'école et passent en statut `VALIDATED`.

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Non authentifié"` | Session absente |
| `500` | `"Erreur lors de l'approbation du professeur"` | Erreur interne |

---

### 11. `POST /api/schools/[id]/teachers/[teacherId]/reject` — Rejeter un enseignant

**Accès** : Authentifié (usage `SCHOOL_ADMIN`)

Rejette la candidature de l'enseignant. L'enseignant est retiré de `applicants[]` et l'école est retirée de sa liste d'écoles.

#### Corps de la requête

Aucun body requis.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Professeur rejeté avec succès",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
    "name": "Lycée Général de Yaoundé"
  }
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Non authentifié"` | Session absente |
| `500` | `"Erreur lors du rejet du professeur"` | Erreur interne |

---

### 12. `GET /api/schools/[id]/invitations` — Obtenir le lien d'invitation

**Accès** : Authentifié (usage `SCHOOL_ADMIN`)

Récupère (ou crée s'il n'existe pas) le lien d'invitation générique de l'école, à partager avec des enseignants externes.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "link": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0l1",
    "token": "abc123def456",
    "school": "64f1a2b3c4d5e6f7a8b9c0e1",
    "expiresAt": "2025-04-17T00:00:00.000Z",
    "url": "http://localhost:3001/join/abc123def456"
  }
}
```

#### Exceptions

| Code | `error` | Cause |
|------|---------|-------|
| `401` | `"Unauthorized"` | Session absente |

---

### 13. `POST /api/schools/[id]/invitations` — Inviter des enseignants

**Accès** : Authentifié (usage `SCHOOL_ADMIN`)

Envoie des invitations par email à un ou plusieurs enseignants à rejoindre l'école.

#### Corps de la requête — Invitation individuelle

```json
{
  "type": "single",
  "email": "prof.nouveau@example.com",
  "name": "Nouveau Professeur"
}
```

#### Corps de la requête — Invitation en masse

```json
{
  "type": "batch",
  "teachers": [
    { "email": "prof1@example.com", "name": "Prof Un" },
    { "email": "prof2@example.com", "name": "Prof Deux" }
  ]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `type` | string | `"single"` ou `"batch"` |
| `email` | string | Email (si `type = "single"`) |
| `name` | string | Nom (si `type = "single"`) |
| `teachers` | object[] | Tableau `{ email, name }` (si `type = "batch"`) |

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Invitation(s) envoyée(s) avec succès",
  "sent": 2,
  "failed": []
}
```

#### Exceptions

| Code | `error` | Cause |
|------|---------|-------|
| `400` | `"Invalid request body"` | JSON malformé |
| `401` | `"Unauthorized"` | Session absente |

---

### 14. `GET /api/student/schools` — Écoles pour l'orientation étudiant

**Accès** : `STUDENT` authentifié (ou `studentId` en query)

Retourne les écoles pour le module d'orientation. Supporte un filtrage très riche côté serveur.

#### Paramètres de requête

| Paramètre | Type | Description |
|-----------|------|-------------|
| `query` | string | Recherche sur le nom |
| `country` | string | Filtrer par pays (nom) |
| `city` | string | Filtrer par ville (nom) |
| `type` | string | Filtrer par `SchoolType` |
| `level` | string | Filtrer par niveau académique (ex: `"Licence"`) |
| `specialty` | string | Filtrer par spécialité |
| `accreditation` | string | Filtrer par accréditation |
| `modality` | string | `PRESENTIEL`, `HYBRIDE`, `DISTANCE` |
| `language` | string | `FRANCAIS`, `ANGLAIS`, etc. |
| `costMin` | number | Frais de scolarité minimum (FCFA) |
| `costMax` | number | Frais de scolarité maximum (FCFA) |
| `scoreMin` | number | Score Xkorienta minimum (0-100) |
| `studentId` | string | Optionnel — utilise la session si absent |

**Exemple :**
```
GET /api/student/schools?query=ingenieur&type=HIGHER_ED&modality=PRESENTIEL&costMax=500000
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
      "name": "École Polytechnique de Yaoundé",
      "type": "HIGHER_ED",
      "address": "Yaoundé, Cameroun",
      "city": "Yaoundé",
      "country": "Cameroun",
      "logoUrl": "http://localhost:3001/uploads/schools/poly.png",
      "status": "VALIDATED",
      "contactInfo": {
        "email": "info@poly.cm",
        "phone": "+237222001001",
        "website": "https://poly.cm"
      },
      "specialties": ["Génie Civil", "Informatique"],
      "accreditation": ["MINESUP"],
      "tuitionFee": { "min": 300000, "max": 450000, "currency": "XAF" },
      "modality": "PRESENTIEL",
      "languages": ["FRANCAIS"],
      "xkorientaScore": 87,
      "badges": {
        "employment": true,
        "alternance": false,
        "certifications": ["ISO 9001"]
      },
      "academicLevel": ["Licence", "Master"],
      "degrees": ["LICENCE", "MASTER"],
      "partnerships": ["Total Énergie", "Orange Cameroun"],
      "studentCount": 2400,
      "foundedYear": 1971,
      "description": "École d'ingénieurs de référence au Cameroun...",
      "learningOutcomes": [
        "Maîtriser les fondamentaux de l'ingénierie",
        "Développer des projets concrets"
      ],
      "careerPaths": [
        { "title": "Ingénieur Civil", "salary": "500 000 - 1 200 000 XAF", "demand": "high" }
      ]
    }
  ]
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Unauthorized"` | Ni session ni `studentId` |
| `500` | `"Internal server error"` | Erreur interne |

---

### 15. `GET /api/admin/schools` — Liste admin par statut (plateforme)

**Accès** : `RECTOR`, `DG_M4M`, `DG_ISIMMA`, `TECH_SUPPORT` uniquement

Permet aux administrateurs plateforme de consulter les écoles par statut pour les valider.

#### Paramètres de requête

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `status` | string | `PENDING` | `PENDING`, `VALIDATED`, `REJECTED`, `SUSPENDED` |
| `page` | number | `1` | Numéro de page |
| `limit` | number | `20` | Résultats par page (max: 100) |
| `search` | string | — | Filtre sur le nom |

**Exemple :**
```
GET /api/admin/schools?status=PENDING&page=1&limit=20
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
      "name": "Nouveau Lycée de Douala",
      "type": "SECONDARY_GENERAL",
      "status": "PENDING",
      "owner": { "_id": "...", "name": "Propriétaire" },
      "createdAt": "2025-03-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `400` | `"Statut invalide. Valeurs: PENDING, VALIDATED, REJECTED, SUSPENDED"` | `status` inconnu |
| `401` | `"Non autorisé"` | Session absente |
| `403` | `"Accès réservé aux administrateurs de la plateforme"` | Rôle non autorisé |
| `500` | `"Erreur serveur"` | Erreur interne |

---

### 16. `POST /api/admin/schools/[id]/validate` — Valider / Rejeter / Suspendre une école

**Accès** : `RECTOR`, `DG_M4M`, `DG_ISIMMA`, `TECH_SUPPORT` uniquement

Action unique couvrant les trois transitions de statut d'une école.

#### Paramètres d'URL

| Paramètre | Description |
|-----------|-------------|
| `id` | ObjectId de l'école |

#### Corps de la requête

```json
{
  "action": "VALIDATE",
  "notes": ""
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `action` | string | Oui | `"VALIDATE"`, `"REJECT"`, ou `"SUSPEND"` |
| `notes` | string | Conditionnel | **Obligatoire** pour `REJECT` et `SUSPEND` |

#### Transitions de statut autorisées

| Action | Statut avant | Statut après | `notes` requis |
|--------|-------------|-------------|----------------|
| `VALIDATE` | `PENDING` | `VALIDATED` | Non |
| `REJECT` | `PENDING` | `REJECTED` | **Oui** |
| `SUSPEND` | `VALIDATED` | `SUSPENDED` | **Oui** |

#### Réponses succès — `200 OK`

**VALIDATE :**
```json
{
  "success": true,
  "message": "École validée avec succès",
  "school": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
    "name": "Nouveau Lycée de Douala",
    "status": "VALIDATED"
  }
}
```

**REJECT :**
```json
{
  "success": true,
  "message": "École rejetée",
  "school": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
    "name": "Nouveau Lycée de Douala",
    "status": "REJECTED"
  }
}
```

**SUSPEND :**
```json
{
  "success": true,
  "message": "École suspendue",
  "school": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
    "name": "Nouveau Lycée de Douala",
    "status": "SUSPENDED"
  }
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `400` | `"Action invalide. Valeurs acceptées: VALIDATE, REJECT, SUSPEND"` | `action` inconnue |
| `400` | `"Une raison de rejet est obligatoire (champ notes)"` | REJECT sans notes |
| `400` | `"Une raison de suspension est obligatoire (champ notes)"` | SUSPEND sans notes |
| `400` | `"ID d'école invalide"` | ID absent ou `"undefined"` |
| `401` | `"Non autorisé"` | Session absente |
| `403` | `"Accès réservé aux administrateurs de la plateforme"` | Rôle non autorisé |
| `404` | `"School not found"` | ID inexistant en base |
| `500` | `"School is already validated"` | Déjà au statut cible |
| `500` | `"Only validated schools can be suspended"` | Tentative de suspendre une école non validée |

---

## Récapitulatif des endpoints

| Méthode | Endpoint | Auth | Rôles | Description |
|---------|----------|------|-------|-------------|
| `GET` | `/api/schools/public` | Non | — | Liste publique (VALIDATED, max 20) |
| `GET` | `/api/schools/search` | Non | — | Recherche fuzzy d'écoles validées |
| `GET` | `/api/schools` | Oui | Tous | Liste avec filtres (search, type, status) |
| `GET` | `/api/teacher/schools` | Oui | TEACHER | Mes écoles (membre ou en attente) |
| `POST` | `/api/teacher/link-school` | Oui | TEACHER | Postuler à une école |
| `POST` | `/api/schools/apply` | Oui | Tous | Postuler à une école (tous rôles) |
| `GET` | `/api/schools/:id/stats` | Oui | Tous | Stats complètes + graphiques |
| `GET` | `/api/schools/:id/teachers` | Oui | Tous | Enseignants membres + candidats |
| `GET` | `/api/schools/:id/classes` | Oui | Tous | Classes de l'école |
| `POST` | `/api/schools/:id/teachers/:teacherId/approve` | Oui | SCHOOL_ADMIN | Approuver un enseignant |
| `POST` | `/api/schools/:id/teachers/:teacherId/reject` | Oui | SCHOOL_ADMIN | Rejeter un enseignant |
| `GET` | `/api/schools/:id/invitations` | Oui | SCHOOL_ADMIN | Obtenir/créer le lien d'invitation |
| `POST` | `/api/schools/:id/invitations` | Oui | SCHOOL_ADMIN | Inviter des enseignants |
| `GET` | `/api/student/schools` | Oui | STUDENT | Écoles pour l'orientation (filtres avancés) |
| `GET` | `/api/admin/schools` | Oui | Platform Admin | Liste admin par statut (paginée) |
| `POST` | `/api/admin/schools/:id/validate` | Oui | Platform Admin | Valider / Rejeter / Suspendre |

---

## Flux d'intégration recommandés

### Inscription d'un enseignant dans une école

```
1. GET /api/schools/search?q=lycee          → Auto-complétion
2. Enseignant choisit une école
3. POST /api/teacher/link-school { schoolId } → Soumettre la candidature
4. Polling GET /api/teacher/schools          → Vérifier si isPending → false (approuvé)
```

### Dashboard SCHOOL_ADMIN

```
1. GET /api/schools/:id/stats               → Chiffres clés + graphiques
2. GET /api/schools/:id/teachers            → Voir applicants[] en attente
3. POST /api/schools/:id/teachers/:id/approve  → Approuver
   POST /api/schools/:id/teachers/:id/reject   → Rejeter
4. GET /api/schools/:id/invitations         → Récupérer le lien à partager
5. POST /api/schools/:id/invitations { type:"single", email, name } → Inviter
```

### Validation par la plateforme

```
1. GET /api/admin/schools?status=PENDING    → Liste des demandes
2. POST /api/admin/schools/:id/validate { action: "VALIDATE" }
   POST /api/admin/schools/:id/validate { action: "REJECT", notes: "..." }
```
