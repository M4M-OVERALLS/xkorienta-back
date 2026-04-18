# Module 03 — User Profile

> **Base URL** : `http://localhost:3001` (dev)  
> **Auth** : Session NextAuth obligatoire sur tous les endpoints (cookie `next-auth.session-token`)  
> **Content-Type** : `application/json` sauf indication contraire

---

## Vue d'ensemble

Le module Profile est structuré en **trois couches** :

| Couche | Endpoints | Qui peut y accéder |
|--------|-----------|-------------------|
| **Profil de base** | `/api/user/profile`, `/api/user/profile/avatar` | Tous les rôles |
| **Profil apprenant** | `/api/profiles/learner`, `/api/student/profile` | `STUDENT` uniquement |
| **Profil pédagogique** | `/api/profiles/pedagogical` | `TEACHER` et rôles pédagogiques |
| **Stats & Activités** | `/api/profiles/stats`, `/api/profiles/activities` | Tous les rôles |

### Schéma global du profil par rôle

```
STUDENT
  ├── User (base)              → /api/user/profile
  ├── LearnerProfile           → /api/profiles/learner  ou  /api/student/profile
  └── Stats apprenant          → /api/profiles/stats

TEACHER / rôles pédagogiques
  ├── User (base)              → /api/user/profile
  ├── PedagogicalProfile       → /api/profiles/pedagogical
  ├── Stats enseignant (temps réel) → /api/profiles/stats
  └── Activités récentes       → /api/profiles/activities
```

---

## Endpoints

---

### 1. `GET /api/user/profile` — Profil de base

**Accès** : Tous les rôles authentifiés

Retourne les informations essentielles de l'utilisateur connecté. Pour les étudiants, inclut également la liste de leurs classes actives.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "image": "http://localhost:3001/uploads/avatars/64f1a2b3-uuid.jpg",
    "role": "STUDENT",
    "classes": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0e1",
        "name": "Terminale A - 2024",
        "level": {
          "_id": "64f1a2b3c4d5e6f7a8b9c0f1",
          "name": "Terminale"
        },
        "school": {
          "_id": "64f1a2b3c4d5e6f7a8b9c0g1",
          "name": "Lycée Général de Yaoundé"
        }
      }
    ]
  }
}
```

> **Note** : `classes` est un tableau vide `[]` pour les enseignants et admins. Il n'est peuplé que pour les `STUDENT`.  
> **Note** : `image` peut être `null` si aucun avatar n'a été défini.

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Non autorisé"` | Session absente ou expirée |
| `404` | `"Utilisateur non trouvé"` | ID de session ne correspond à aucun compte |
| `500` | `"Erreur serveur"` | Erreur interne |

---

### 2. `PUT /api/user/profile` — Mettre à jour le profil de base

**Accès** : Tous les rôles authentifiés

Permet de modifier le nom, l'email et/ou le mot de passe. **Ne pas utiliser cet endpoint pour changer l'avatar** — utiliser `/api/user/profile/avatar` à la place.

#### Corps de la requête

```json
{
  "name": "Jean-Pierre Dupont",
  "email": "jpdupont@example.com",
  "currentPassword": "AncienMotDePasse1!",
  "newPassword": "NouveauMotDePasse2@"
}
```

| Champ | Type | Requis | Notes |
|-------|------|--------|-------|
| `name` | string | Non | Nouveau nom affiché |
| `email` | string | Non | Nouvelle adresse email |
| `currentPassword` | string | Conditionnel | Obligatoire si `newPassword` est fourni |
| `newPassword` | string | Non | Nouveau mot de passe (hashé avec bcrypt×12) |

> Tous les champs sont optionnels — envoyer uniquement ceux à modifier.  
> Ne pas envoyer de champ `image` : retourne une erreur `400` orientant vers `/api/user/profile/avatar`.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Profil mis à jour avec succès",
  "user": {
    "name": "Jean-Pierre Dupont",
    "email": "jpdupont@example.com",
    "image": "http://localhost:3001/uploads/avatars/64f1a2b3-uuid.jpg"
  }
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `400` | `"Mot de passe actuel requis pour changer le mot de passe"` | `newPassword` fourni sans `currentPassword` |
| `400` | `"Utilisez /api/user/profile/avatar pour uploader une image"` | Champ `image` détecté dans le body |
| `401` | `"Non autorisé"` | Session absente ou expirée |
| `404` | `"Utilisateur non trouvé"` | Compte introuvable |
| `500` | `"Erreur serveur"` | Erreur interne |

---

### 3. `POST /api/user/profile/avatar` — Uploader un avatar

**Accès** : Tous les rôles authentifiés  
**Content-Type** : `multipart/form-data` (pas de JSON)

Upload une image d'avatar pour l'utilisateur. L'ancien avatar local est automatiquement supprimé du serveur. Les avatars OAuth (Google, GitHub) ne sont pas supprimés.

#### Corps de la requête (multipart/form-data)

| Champ | Type | Requis | Contraintes |
|-------|------|--------|-------------|
| `avatar` | File | Oui | JPG, PNG ou WebP — max **2 MB** |

#### Exemple d'envoi (JavaScript / Fetch)

```javascript
const formData = new FormData();
formData.append('avatar', fileInput.files[0]);

const response = await fetch('/api/user/profile/avatar', {
  method: 'POST',
  body: formData,
  // Ne pas définir Content-Type manuellement — le navigateur le fait avec le boundary
  credentials: 'include', // pour envoyer le cookie de session
});
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Avatar mis à jour",
  "user": {
    "image": "http://localhost:3001/uploads/avatars/64f1a2b3c4d5e6f7a8b9c0d1-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
  }
}
```

> L'URL retournée est **absolue** et directement utilisable dans une balise `<img>`.  
> Cette URL est également mise à jour dans `user.image` (disponible via `GET /api/user/profile`).

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `400` | `"Fichier avatar manquant"` | Le champ `avatar` est absent du FormData |
| `400` | `"Format non supporté (jpg, png, webp)"` | Extension non autorisée (ex: gif, svg, bmp) |
| `400` | `"Taille invalide. Max 2MB."` | Fichier vide ou dépassant 2 Mo |
| `401` | `"Non autorisé"` | Session absente ou expirée |
| `404` | `"Utilisateur non trouvé"` | Compte introuvable |
| `500` | `"Erreur serveur"` | Erreur d'écriture disque ou autre |

---

### 4. `GET /api/profiles/learner` — Profil apprenant détaillé

**Accès** : `STUDENT` uniquement

Retourne le `LearnerProfile` complet avec parcours académique, préférences cognitives, abonnement et gamification.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0p1",
    "user": "64f1a2b3c4d5e6f7a8b9c0d1",
    "currentLevel": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0f1",
      "name": "Terminale",
      "code": "TERM_FR",
      "cycle": "SECONDAIRE_SECOND_CYCLE"
    },
    "currentField": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0h1",
      "name": "Sciences",
      "code": "SC"
    },
    "enrollmentDate": "2024-09-01T00:00:00.000Z",
    "expectedGraduationDate": "2025-07-31T00:00:00.000Z",
    "awaitingSchoolValidation": false,
    "cognitiveProfile": "VISUAL",
    "learnerType": "EXAM_PREP",
    "subscriptionStatus": "FREEMIUM",
    "subscriptionExpiry": null,
    "preferredLearningMode": "EXAM",
    "stats": {
      "totalExamsTaken": 12,
      "averageScore": 14.3,
      "totalStudyTime": 3600,
      "strongSubjects": [
        { "_id": "...", "name": "Mathématiques" }
      ],
      "weakSubjects": [
        { "_id": "...", "name": "Histoire-Géographie" }
      ],
      "lastActivityDate": "2025-03-15T10:30:00.000Z"
    },
    "gamification": {
      "level": 3,
      "xp": 1250,
      "badges": [
        {
          "badgeId": "first_exam",
          "earnedAt": "2024-09-15T08:00:00.000Z"
        }
      ],
      "streak": 7
    },
    "createdAt": "2024-09-01T00:00:00.000Z",
    "updatedAt": "2025-03-15T10:30:00.000Z"
  }
}
```

#### Détail des champs retournés

| Champ | Type | Description |
|-------|------|-------------|
| `currentLevel` | object \| null | Niveau scolaire peuplé (EducationLevel) |
| `currentField` | object \| null | Filière peuplée (Field) |
| `enrollmentDate` | ISO date | Date d'inscription |
| `expectedGraduationDate` | ISO date \| null | Date de fin d'études prévue |
| `awaitingSchoolValidation` | boolean | `true` si en attente de validation d'école |
| `cognitiveProfile` | enum \| null | Profil cognitif (voir tableau) |
| `learnerType` | enum \| null | Type d'apprenant (voir tableau) |
| `subscriptionStatus` | enum | Statut d'abonnement |
| `preferredLearningMode` | enum \| null | Mode d'apprentissage préféré |
| `stats.totalStudyTime` | number | Temps total en **secondes** |
| `stats.averageScore` | number | Moyenne sur 20 |
| `gamification.xp` | number | Points d'expérience totaux |
| `gamification.streak` | number | Jours consécutifs d'activité |

**Valeurs des enums :**

| Enum | Valeurs |
|------|---------|
| `cognitiveProfile` | `VISUAL`, `AUDITORY`, `LOGIC_MATH`, `LITERARY` |
| `learnerType` | `EXAM_PREP`, `REMEDIAL`, `ADVANCED`, `STRUGGLING` |
| `subscriptionStatus` | `FREEMIUM`, `PREMIUM`, `INSTITUTION_PREMIUM`, `EDUCATOR_ACCESS`, `DIRECTION_ACCESS` |
| `preferredLearningMode` | `AUTO_EVAL`, `COMPETITION`, `EXAM`, `CLASS_CHALLENGE` |

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Unauthorized"` | Session absente |
| `403` | `"Forbidden: Not a student"` | Rôle différent de `STUDENT` |
| `404` | `"Profile not found"` | LearnerProfile non encore créé (onboarding incomplet) |
| `500` | `"Internal server error"` | Erreur interne |

---

### 5. `PUT /api/profiles/learner` — Mettre à jour le profil apprenant

**Accès** : `STUDENT` uniquement

Met à jour les préférences et informations académiques de l'étudiant. Les stats et la gamification **ne peuvent pas** être modifiées via cet endpoint (champs protégés côté serveur).

#### Champs modifiables

| Champ | Type | Description |
|-------|------|-------------|
| `currentLevel` | string (ObjectId) | ID du niveau scolaire (EducationLevel) |
| `currentField` | string (ObjectId) | ID de la filière (Field) |
| `cognitiveProfile` | enum | Profil cognitif |
| `learnerType` | enum | Type d'apprenant |
| `preferredLearningMode` | enum | Mode d'apprentissage préféré |
| `enrollmentDate` | ISO date string | Date d'inscription |
| `expectedGraduationDate` | ISO date string | Date de fin d'études prévue |

#### Corps de la requête (exemple complet)

```json
{
  "currentLevel": "64f1a2b3c4d5e6f7a8b9c0f1",
  "currentField": "64f1a2b3c4d5e6f7a8b9c0h1",
  "cognitiveProfile": "VISUAL",
  "learnerType": "EXAM_PREP",
  "preferredLearningMode": "EXAM",
  "enrollmentDate": "2024-09-01T00:00:00.000Z",
  "expectedGraduationDate": "2025-07-31T00:00:00.000Z"
}
```

> Envoyer uniquement les champs à modifier. Les autres champs ne sont pas touchés.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0p1",
    "user": "64f1a2b3c4d5e6f7a8b9c0d1",
    "cognitiveProfile": "VISUAL",
    "learnerType": "EXAM_PREP",
    "preferredLearningMode": "EXAM",
    "currentLevel": "64f1a2b3c4d5e6f7a8b9c0f1",
    "currentField": "64f1a2b3c4d5e6f7a8b9c0h1",
    "updatedAt": "2025-03-20T14:00:00.000Z"
  }
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `400` | `"No valid fields to update"` | Aucun champ autorisé dans le body |
| `401` | `"Unauthorized"` | Session absente |
| `403` | `"Forbidden: Not a student"` | Rôle différent de `STUDENT` |
| `404` | `"Profile not found"` | LearnerProfile inexistant |
| `500` | `"Internal server error"` | Erreur interne |

---

### 6. `GET /api/profiles/pedagogical` — Profil pédagogique (enseignant)

**Accès** : `TEACHER`, `INSPECTOR`, `SURVEILLANT`, `PREFET`, `PRINCIPAL`, `DG_ISIMMA`, `RECTOR`, `DG_M4M`, `TECH_SUPPORT`

Retourne le `PedagogicalProfile` complet avec matières enseignées, niveaux d'intervention, qualifications et statistiques.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0q1",
    "user": "64f1a2b3c4d5e6f7a8b9c0d1",
    "teachingSubjects": [
      { "_id": "64f1a2b3c4d5e6f7a8b9c0s1", "name": "Mathématiques", "code": "MATH" },
      { "_id": "64f1a2b3c4d5e6f7a8b9c0s2", "name": "Physique-Chimie", "code": "PHY" }
    ],
    "interventionLevels": [
      { "_id": "64f1a2b3c4d5e6f7a8b9c0f1", "name": "Terminale", "code": "TERM_FR" }
    ],
    "interventionFields": [
      { "_id": "64f1a2b3c4d5e6f7a8b9c0h1", "name": "Série C", "code": "C" }
    ],
    "contributionTypes": ["CREATOR", "VALIDATOR"],
    "accessScope": "SUBJECT",
    "scopeDetails": {
      "specificInstitution": null,
      "specificSubjects": [],
      "specificLevels": [],
      "specificFields": []
    },
    "reportingAccess": "CLASS",
    "stats": {
      "totalExamsCreated": 24,
      "totalExamsValidated": 18,
      "totalStudentsSupervised": 120,
      "averageStudentScore": 12.5,
      "lastActivityDate": "2025-03-15T10:30:00.000Z"
    },
    "qualifications": [
      {
        "title": "DIPES II",
        "issuedBy": "ENS Yaoundé",
        "issuedDate": "2018-07-15T00:00:00.000Z",
        "expiryDate": null,
        "certificateUrl": "https://example.com/cert/dipes.pdf"
      }
    ],
    "createdAt": "2024-09-01T00:00:00.000Z",
    "updatedAt": "2025-03-15T10:30:00.000Z"
  }
}
```

#### Détail des champs retournés

| Champ | Type | Description |
|-------|------|-------------|
| `teachingSubjects` | object[] | Matières enseignées (peuplées depuis Subject) |
| `interventionLevels` | object[] | Niveaux d'intervention (peuplés depuis EducationLevel) |
| `interventionFields` | object[] | Filières (peuplées depuis Field) |
| `contributionTypes` | enum[] | Types de contribution (voir tableau) |
| `accessScope` | enum | Portée d'accès |
| `reportingAccess` | enum | Niveau d'accès aux rapports |
| `stats.averageStudentScore` | number | Moyenne des élèves sur 20 |
| `qualifications` | object[] | Diplômes et certifications |

**Valeurs des enums :**

| Enum | Valeurs | Description |
|------|---------|-------------|
| `contributionTypes` | `CREATOR`, `VALIDATOR`, `CORRECTOR`, `MANAGER`, `SUPERVISOR` | Rôles dans la création de contenu |
| `accessScope` | `GLOBAL`, `LOCAL`, `SUBJECT`, `LEVEL`, `FIELD` | Portée des droits d'accès |
| `reportingAccess` | `CLASS`, `FIELD`, `ESTABLISHMENT`, `GLOBAL` | Niveau d'accès aux rapports |

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Unauthorized"` | Session absente |
| `403` | `"Forbidden: Not a pedagogical user"` | Rôle `STUDENT` ou non reconnu |
| `404` | `"Profile not found"` | PedagogicalProfile non encore créé |
| `500` | `"Internal server error"` | Erreur interne |

---

### 7. `PUT /api/profiles/pedagogical` — Mettre à jour le profil pédagogique

**Accès** : Rôles pédagogiques (voir ci-dessus)

#### Champs modifiables

| Champ | Type | Description |
|-------|------|-------------|
| `teachingSubjects` | string[] (ObjectId[]) | IDs des matières enseignées |
| `interventionLevels` | string[] (ObjectId[]) | IDs des niveaux d'intervention |
| `interventionFields` | string[] (ObjectId[]) | IDs des filières |
| `qualifications` | object[] | Liste des diplômes (voir structure ci-dessous) |

> `accessScope`, `contributionTypes`, `stats` et `reportingAccess` sont en **lecture seule** depuis cet endpoint.

#### Structure d'un objet `qualification`

```json
{
  "title": "Master en Mathématiques",
  "issuedBy": "Université de Yaoundé I",
  "issuedDate": "2020-06-30T00:00:00.000Z",
  "expiryDate": null,
  "certificateUrl": "https://example.com/cert/master.pdf"
}
```

#### Corps de la requête (exemple)

```json
{
  "teachingSubjects": [
    "64f1a2b3c4d5e6f7a8b9c0s1",
    "64f1a2b3c4d5e6f7a8b9c0s2"
  ],
  "interventionLevels": ["64f1a2b3c4d5e6f7a8b9c0f1"],
  "interventionFields": ["64f1a2b3c4d5e6f7a8b9c0h1"],
  "qualifications": [
    {
      "title": "DIPES II",
      "issuedBy": "ENS Yaoundé",
      "issuedDate": "2018-07-15T00:00:00.000Z"
    }
  ]
}
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0q1",
    "teachingSubjects": ["64f1a2b3c4d5e6f7a8b9c0s1", "64f1a2b3c4d5e6f7a8b9c0s2"],
    "interventionLevels": ["64f1a2b3c4d5e6f7a8b9c0f1"],
    "updatedAt": "2025-03-20T14:00:00.000Z"
  }
}
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `400` | `"No valid fields to update"` | Aucun champ autorisé dans le body |
| `401` | `"Unauthorized"` | Session absente |
| `403` | `"Forbidden: Not a pedagogical user"` | Rôle non autorisé |
| `404` | `"Profile not found"` | PedagogicalProfile inexistant |
| `500` | `"Internal server error"` | Erreur interne |

---

### 8. `GET /api/profiles/stats` — Statistiques du tableau de bord

**Accès** : Tous les rôles authentifiés

Retourne des statistiques adaptées au rôle de l'utilisateur connecté. **La structure de réponse est différente selon le rôle.**

---

#### Réponse pour `STUDENT` — `200 OK`

```json
{
  "success": true,
  "data": {
    "basic": {
      "totalExamsTaken": 12,
      "averageScore": 14.3,
      "totalStudyTime": 3600,
      "lastActivityDate": "2025-03-15T10:30:00.000Z"
    },
    "subjects": {
      "strong": [
        { "_id": "...", "name": "Mathématiques" }
      ],
      "weak": [
        { "_id": "...", "name": "Histoire-Géographie" }
      ]
    },
    "gamification": {
      "level": 3,
      "xp": 1250,
      "badges": [
        { "badgeId": "first_exam", "earnedAt": "2024-09-15T08:00:00.000Z" }
      ],
      "streak": 7
    },
    "subscription": {
      "status": "FREEMIUM",
      "expiry": null
    }
  }
}
```

---

#### Réponse pour `TEACHER` (et rôles pédagogiques) — `200 OK`

Les stats enseignant sont calculées **en temps réel** à chaque appel (pas de cache).

```json
{
  "success": true,
  "data": {
    "basic": {
      "totalExamsCreated": 24,
      "totalStudentsReached": 87,
      "averageStudentScore": 12.5,
      "activeExams": 6
    },
    "details": {
      "publishedExams": 6,
      "ongoingExams": 2,
      "draftExams": 18
    },
    "gamification": {
      "xp": 2950,
      "level": 6,
      "nextLevelXp": 3000,
      "title": "Professeur Expert"
    }
  }
}
```

**Détail des champs enseignant :**

| Champ | Description |
|-------|-------------|
| `basic.totalExamsCreated` | Total des examens créés (brouillons inclus) |
| `basic.totalStudentsReached` | Nombre d'étudiants uniques dans ses classes |
| `basic.averageStudentScore` | Moyenne des scores sur tous ses examens (sur 20) |
| `basic.activeExams` | Examens publiés (= `details.publishedExams`) |
| `details.publishedExams` | Examens en statut publié |
| `details.ongoingExams` | Examens actuellement en cours (entre startTime et endTime) |
| `details.draftExams` | `totalExamsCreated - publishedExams` |
| `gamification.title` | `"Enseignant Certifié"` (niv. 1-5) / `"Professeur Expert"` (niv. 6-10) / `"Maître Pédagogue"` (niv. 11+) |

**Formule XP enseignant :**
```
XP = (publishedExams × 100) + (draftExams × 50) + (studentsReached × 10) + (avgScore × 5)
Niveau = floor(XP / 500) + 1
```

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Unauthorized"` | Session absente |
| `404` | `"Profile not found"` | Profil non trouvé |
| `500` | `"Internal server error"` | Erreur interne |

---

### 9. `GET /api/profiles/activities` — Activités récentes

**Accès** : Tous les rôles authentifiés  
**Usage principal** : Enseignants et admins (feed d'activité du dashboard)

#### Paramètres de requête

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `limit` | number | `5` | Nombre maximum d'activités à retourner |

#### Exemple

```
GET /api/profiles/activities?limit=10
```

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "64f1a2b3c4d5e6f7a8b9c0e1",
      "type": "EXAM_CREATED",
      "title": "Nouvel examen créé",
      "description": "Mathématiques - Terminale, Première",
      "timestamp": "2025-03-14T09:15:00.000Z",
      "user": {
        "name": "Moi"
      },
      "metadata": {
        "examId": "64f1a2b3c4d5e6f7a8b9c0e1",
        "status": "DRAFT"
      }
    }
  ]
}
```

**Types d'activités actuellement retournés :**

| `type` | Description |
|--------|-------------|
| `EXAM_CREATED` | Examen créé par l'enseignant |

> D'autres types d'activités (validations, publications) seront ajoutés ultérieurement.

#### Exceptions

| Code | `message` | Cause |
|------|-----------|-------|
| `401` | `"Unauthorized"` | Session absente |
| `500` | `"Internal server error"` | Erreur interne |

---

### 10. `GET /api/student/profile` — Profil étudiant (alias)

**Accès** : `STUDENT` uniquement

Endpoint alternatif pour récupérer le profil apprenant depuis le namespace `/api/student/`. Retourne les mêmes données que `GET /api/profiles/learner` avec un wrapper légèrement différent.

#### Réponse succès — `200 OK`

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "user": "...",
    "currentLevel": { ... },
    "stats": { ... },
    "gamification": { ... }
  }
}
```

> **Recommandation** : Privilégier `GET /api/profiles/learner` pour les étudiants (plus explicite). Utiliser `GET /api/student/profile` uniquement dans le contexte du dashboard étudiant.

---

## Guide d'intégration par cas d'usage

### Afficher la page de profil utilisateur

```
1. GET /api/user/profile            → nom, email, avatar, rôle, classes (si STUDENT)
2. Si STUDENT  → GET /api/profiles/learner     → niveau, filière, gamification, stats
   Si TEACHER  → GET /api/profiles/pedagogical → matières, niveaux, qualifications
3. GET /api/profiles/stats          → statistiques pour le widget dashboard
```

### Mettre à jour le profil (formulaire d'édition)

```
• Changer nom/email    → PUT /api/user/profile  { name, email }
• Changer mot de passe → PUT /api/user/profile  { currentPassword, newPassword }
• Changer avatar       → POST /api/user/profile/avatar  (multipart/form-data)
• Préférences étudiant → PUT /api/profiles/learner  { cognitiveProfile, preferredLearningMode, ... }
• Matières enseignant  → PUT /api/profiles/pedagogical  { teachingSubjects, interventionLevels, ... }
```

### Afficher le feed d'activité (dashboard enseignant)

```
GET /api/profiles/activities?limit=5
```

---

## Récapitulatif des endpoints

| Méthode | Endpoint | Auth | Rôles | Description |
|---------|----------|------|-------|-------------|
| `GET` | `/api/user/profile` | Oui | Tous | Profil de base + classes (STUDENT) |
| `PUT` | `/api/user/profile` | Oui | Tous | Modifier nom / email / mot de passe |
| `POST` | `/api/user/profile/avatar` | Oui | Tous | Uploader avatar (multipart) |
| `GET` | `/api/profiles/learner` | Oui | STUDENT | Profil apprenant complet |
| `PUT` | `/api/profiles/learner` | Oui | STUDENT | Modifier préférences apprenant |
| `GET` | `/api/profiles/pedagogical` | Oui | TEACHER + | Profil pédagogique complet |
| `PUT` | `/api/profiles/pedagogical` | Oui | TEACHER + | Modifier matières / qualifications |
| `GET` | `/api/profiles/stats` | Oui | Tous | Stats dashboard (adapté au rôle) |
| `GET` | `/api/profiles/activities` | Oui | Tous | Activités récentes (`?limit=N`) |
| `GET` | `/api/student/profile` | Oui | STUDENT | Alias profil apprenant |
