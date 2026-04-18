# Module 05 — Classes

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie de session `next-auth.session-token` (obtenu après login)

---

## Vue d'ensemble

Le module Classes couvre tout le cycle de vie d'une classe : création, gestion des élèves, collaboration entre enseignants, système d'invitations et consultation côté élève.

### Rôles concernés

| Rôle | Accès |
|------|-------|
| `TEACHER` | Créer, modifier, supprimer ses classes ; gérer les collaborateurs |
| `STUDENT` | Consulter ses classes inscrites |
| `SCHOOL_ADMIN` | Valider/rejeter les classes de son école |

### Concept clé : `isIndependent`

Un enseignant peut créer une classe **sans école** (`isIndependent: true`). Si l'enseignant a une demande d'école en cours (`isPending`), la classe est liée à `pendingSchoolId`. Quand l'enseignant est approuvé par l'école, toutes ses classes indépendantes sont automatiquement **rattachées** à l'école.

### Concept clé : `mainTeacher` vs `teachers[]`

- `mainTeacher` = propriétaire de la classe (seul à pouvoir la modifier/supprimer)
- `teachers[]` = collaborateurs, chacun avec une matière (`subject`), un rôle (`ClassTeacherRole`) et des permissions (`ClassTeacherPermission[]`)
- La permission `INVITE_TEACHERS` permet à un collaborateur d'ajouter d'autres enseignants

---

## Endpoints

### 1. Lister les classes d'un enseignant

```
GET /api/classes
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (les autres rôles reçoivent `[]`)

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "68a1b2c3d4e5f6789abcdef0",
      "name": "Terminale A1",
      "academicYear": "2024-2025",
      "isIndependent": false,
      "mainTeacher": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Prof. Martin",
        "email": "martin@school.cm"
      },
      "school": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Lycée Bilingue"
      },
      "level": {
        "_id": "507f1f77bcf86cd799439013",
        "name": "Terminale"
      },
      "field": null,
      "specialty": null,
      "students": ["507f1f77...", "507f1f78..."],
      "teachers": [],
      "createdAt": "2024-09-01T08:00:00.000Z",
      "updatedAt": "2024-09-15T10:00:00.000Z"
    }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 2. Créer une classe

```
POST /api/classes
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` uniquement

#### Corps de la requête

```json
{
  "name": "Terminale A1",
  "level": "507f1f77bcf86cd799439013",
  "academicYear": "2024-2025",
  "school": "507f1f77bcf86cd799439012",
  "field": "507f1f77bcf86cd799439014",
  "specialty": "507f1f77bcf86cd799439015"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `name` | string | **Oui** | Nom de la classe |
| `level` | ObjectId | **Oui** | ID du niveau d'éducation |
| `academicYear` | string | **Oui** | Ex: `"2024-2025"` |
| `school` | ObjectId | Non | Omis → classe indépendante |
| `field` | ObjectId | Non | Filière |
| `specialty` | ObjectId | Non | Spécialité |

> **Note** : Si `school` est omis, la classe est créée en mode `isIndependent: true`. Si l'enseignant a une demande en cours, `pendingSchoolId` est automatiquement renseigné.

#### Réponse 201

```json
{
  "success": true,
  "data": {
    "_id": "68a1b2c3d4e5f6789abcdef0",
    "name": "Terminale A1",
    "academicYear": "2024-2025",
    "isIndependent": false,
    "mainTeacher": "507f1f77bcf86cd799439011",
    "school": "507f1f77bcf86cd799439012",
    "level": "507f1f77bcf86cd799439013",
    "field": null,
    "specialty": null,
    "students": [],
    "teachers": [],
    "createdAt": "2024-09-01T08:00:00.000Z"
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Missing required fields: name, level, academicYear"` | Champs obligatoires manquants |
| 401 | `"Unauthorized"` | Non enseignant |
| 500 | `"Internal server error"` | Erreur serveur |

---

### 3. Obtenir les détails d'une classe (vue enseignant)

```
GET /api/classes/:id
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (doit être `mainTeacher` **ou** collaborateur de la classe)

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "68a1b2c3d4e5f6789abcdef0",
    "name": "Terminale A1",
    "academicYear": "2024-2025",
    "isIndependent": false,
    "isMainTeacherForCurrentUser": true,
    "mainTeacher": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Prof. Martin",
      "email": "martin@school.cm"
    },
    "school": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Lycée Bilingue"
    },
    "level": {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Terminale"
    },
    "students": [
      { "_id": "507f1f77...", "name": "Jean Dupont", "email": "jean@email.com" }
    ],
    "teachers": [
      {
        "teacher": { "_id": "507f1f78...", "name": "Prof. Smith" },
        "subject": { "_id": "507f1f79...", "name": "Mathématiques" },
        "role": "COLLABORATOR",
        "permissions": ["INVITE_TEACHERS"]
      }
    ],
    "createdAt": "2024-09-01T08:00:00.000Z"
  }
}
```

> **`isMainTeacherForCurrentUser`** : `true` si l'utilisateur connecté est le propriétaire de la classe. Utilisez ce flag pour conditionner l'affichage des boutons Modifier/Supprimer.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Invalid class ID"` | ID malformé |
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Unauthorized"` | Enseignant non lié à la classe |
| 404 | `"Class not found"` | Classe inexistante |

---

### 4. Modifier une classe

```
PUT /api/classes/:id
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` — **`mainTeacher` uniquement** (les collaborateurs ne peuvent pas modifier)

#### Corps de la requête

Envoyer uniquement les champs à modifier (PATCH-like) :

```json
{
  "name": "Terminale A1 — 2025",
  "academicYear": "2025-2026"
}
```

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "68a1b2c3d4e5f6789abcdef0",
    "name": "Terminale A1 — 2025",
    "academicYear": "2025-2026",
    "updatedAt": "2025-01-10T14:00:00.000Z"
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Invalid class ID"` | ID malformé |
| 401 | `"Unauthorized"` | Non enseignant |
| 403 | `"Unauthorized"` | N'est pas le `mainTeacher` |
| 404 | `"Class not found"` | Classe inexistante |

---

### 5. Supprimer une classe

```
DELETE /api/classes/:id
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` — **`mainTeacher` uniquement**

#### Réponse 200

```json
{
  "success": true,
  "message": "Class deleted successfully"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Invalid class ID"` | ID malformé |
| 401 | `"Unauthorized"` | Non enseignant |
| 403 | `"Unauthorized"` | N'est pas le `mainTeacher` |
| 404 | `"Class not found"` | Classe inexistante |

---

### 6. Statistiques d'une classe

```
GET /api/classes/:id/stats
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` — `mainTeacher` ou collaborateur

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "totalStudents": 32,
    "totalExams": 8,
    "completedExams": 5,
    "averageScore": 14.5,
    "topScore": 19,
    "passRate": 78.5
  }
}
```

---

### 7. Examens d'une classe

```
GET /api/classes/:id/exams
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` (mainTeacher ou collaborateur)

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "title": "Composition de Mathématiques",
      "startTime": "2025-01-15T08:00:00.000Z",
      "endTime": "2025-01-15T10:00:00.000Z",
      "duration": 120,
      "status": "PUBLISHED",
      "closeMode": "STRICT"
    }
  ]
}
```

---

### 8. Retirer un élève d'une classe

```
DELETE /api/classes/:id/students/:studentId
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` — `mainTeacher` uniquement

#### Réponse 200

```json
{
  "success": true,
  "message": "Student removed from class"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Unauthorized"` | Non authentifié |
| 403 | `"Unauthorized"` | N'est pas le `mainTeacher` |
| 404 | `"Class not found"` / `"Student not found"` | Ressource inexistante |

---

### 9. Statistiques d'un élève dans une classe

```
GET /api/classes/:id/students/:studentId/stats
```

**Auth requise** : Oui  
**Rôle** : `TEACHER` — `mainTeacher` uniquement

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "studentId": "507f1f77...",
    "studentName": "Jean Dupont",
    "examsCompleted": 5,
    "averageScore": 14.2,
    "bestScore": 18,
    "worstScore": 11,
    "rank": 3
  }
}
```

---

## Collaboration entre enseignants

### 10. Lister les collaborateurs

```
GET /api/classes/:id/teachers
```

**Auth requise** : Oui  
**Rôle** : Tout enseignant de la classe (mainTeacher ou collaborateur)

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "teacher": {
        "_id": "507f1f77bcf86cd799439030",
        "name": "Prof. Smith",
        "email": "smith@school.cm",
        "image": null
      },
      "subject": {
        "_id": "507f1f77bcf86cd799439031",
        "name": "Mathématiques",
        "code": "MATH"
      },
      "role": "COLLABORATOR",
      "permissions": ["INVITE_TEACHERS"],
      "addedAt": "2024-09-05T10:00:00.000Z",
      "addedBy": "507f1f77bcf86cd799439011"
    }
  ]
}
```

> **Note** : Cet endpoint retourne `{ error: "..." }` (sans `success: false`) en cas d'erreur — contrairement aux autres endpoints de ce module.

---

### 11. Ajouter un collaborateur

```
POST /api/classes/:id/teachers
```

**Auth requise** : Oui  
**Condition** : Être `mainTeacher` **ou** avoir la permission `INVITE_TEACHERS`

#### Corps de la requête

```json
{
  "teacherId": "507f1f77bcf86cd799439030",
  "subjectId": "507f1f77bcf86cd799439031",
  "role": "COLLABORATOR",
  "permissions": ["INVITE_TEACHERS"]
}
```

| Champ | Type | Requis | Valeurs |
|-------|------|--------|---------|
| `teacherId` | ObjectId | **Oui** | ID d'un utilisateur existant avec rôle TEACHER |
| `subjectId` | ObjectId | **Oui** | ID de la matière enseignée |
| `role` | string | Non | `COLLABORATOR` (défaut) |
| `permissions` | string[] | Non | `["INVITE_TEACHERS"]` |

#### Réponse 201

```json
{
  "success": true,
  "message": "Enseignant ajouté avec succès",
  "data": { ... }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"teacherId et subjectId sont requis"` | Champs manquants |
| 400 | `"..."` | Enseignant déjà dans la classe pour cette matière |
| 403 | `"Vous n'avez pas la permission d'inviter des enseignants"` | Permission insuffisante |

---

### 12. Modifier les permissions d'un collaborateur

```
PUT /api/classes/:id/teachers
```

**Auth requise** : Oui  
**Condition** : Être `mainTeacher` **ou** avoir la permission `INVITE_TEACHERS`

#### Corps de la requête

```json
{
  "teacherId": "507f1f77bcf86cd799439030",
  "subjectId": "507f1f77bcf86cd799439031",
  "permissions": ["INVITE_TEACHERS"],
  "role": "COLLABORATOR"
}
```

| Champ | Type | Requis |
|-------|------|--------|
| `teacherId` | ObjectId | **Oui** |
| `subjectId` | ObjectId | **Oui** |
| `permissions` | string[] | **Oui** |
| `role` | string | Non |

#### Réponse 200

```json
{
  "success": true,
  "message": "Permissions mises à jour",
  "data": { ... }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"teacherId, subjectId et permissions sont requis"` | Champs manquants |
| 403 | `"Vous n'avez pas la permission de modifier les droits"` | Permission insuffisante |

---

### 13. Retirer un collaborateur

```
DELETE /api/classes/:id/teachers?teacherId=xxx&subjectId=xxx
```

**Auth requise** : Oui  
**Condition** : Être `mainTeacher` **OU** s'auto-retirer (un enseignant peut quitter une classe)

#### Query Parameters

| Paramètre | Requis | Description |
|-----------|--------|-------------|
| `teacherId` | **Oui** | ID de l'enseignant à retirer |
| `subjectId` | **Oui** | ID de la matière concernée |

#### Réponse 200

```json
{
  "success": true,
  "message": "Enseignant retiré de la classe"
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"teacherId et subjectId sont requis"` | Params manquants |
| 403 | `"Vous n'avez pas la permission de retirer des enseignants"` | Ni owner ni self |

---

### 14. Inviter un enseignant par email

```
POST /api/classes/:id/teachers/invite
```

**Auth requise** : Oui  
**Condition** : Être `mainTeacher` **ou** avoir la permission `INVITE_TEACHERS`

> Si l'enseignant n'a pas encore de compte, un compte est **automatiquement créé** et un email d'invitation lui est envoyé.

#### Corps de la requête

```json
{
  "email": "nouveau.prof@school.cm",
  "name": "Prof. Nouveau",
  "subjectIds": ["507f1f77bcf86cd799439031", "507f1f77bcf86cd799439032"],
  "role": "COLLABORATOR",
  "permissions": []
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `email` | string | **Oui** | Email de l'enseignant |
| `name` | string | **Oui** | Nom de l'enseignant |
| `subjectIds` | string[] | **Oui** | Au moins une matière |
| `role` | string | Non | Défaut: `"COLLABORATOR"` |
| `permissions` | string[] | Non | Permissions à attribuer |

#### Réponse 201

```json
{
  "success": true,
  "status": "INVITED",
  "message": "Invitation envoyée à nouveau.prof@school.cm",
  "data": {
    "teacherId": "507f1f77bcf86cd799439033",
    "teacherName": "Prof. Nouveau",
    "teacherEmail": "nouveau.prof@school.cm"
  }
}
```

> **`status`** : `"ENROLLED"` si l'enseignant existait déjà et a été directement ajouté, `"INVITED"` si un compte a été créé et un email envoyé.

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Email et nom sont requis"` | Champs manquants |
| 400 | `"Au moins une matière est requise"` | `subjectIds` vide |
| 403 | `"Vous n'avez pas la permission d'inviter des enseignants"` | Permission insuffisante |

---

### 15. Importer des enseignants en lot

```
PUT /api/classes/:id/teachers/invite
```

**Auth requise** : Oui  
**Condition** : Être `mainTeacher` **ou** avoir la permission `INVITE_TEACHERS`

#### Corps de la requête

```json
{
  "teachers": [
    { "email": "prof1@school.cm", "name": "Prof. Un" },
    { "email": "prof2@school.cm", "name": "Prof. Deux" }
  ],
  "subjectIds": ["507f1f77bcf86cd799439031"],
  "role": "COLLABORATOR",
  "permissions": []
}
```

#### Réponse 200

```json
{
  "success": true,
  "message": "2/2 enseignants traités",
  "data": {
    "total": 2,
    "enrolled": 1,
    "invited": 1,
    "errors": 0,
    "results": [
      {
        "success": true,
        "status": "ENROLLED",
        "email": "prof1@school.cm",
        "teacherId": "507f1f77...",
        "teacherName": "Prof. Un",
        "teacherEmail": "prof1@school.cm"
      },
      {
        "success": true,
        "status": "INVITED",
        "email": "prof2@school.cm",
        "teacherId": "507f1f78...",
        "teacherName": "Prof. Deux",
        "teacherEmail": "prof2@school.cm"
      }
    ]
  }
}
```

---

## Système d'invitations élèves

Le système supporte **3 types d'invitations** pour ajouter des élèves à une classe.

### Types d'invitation

| Type | Description |
|------|-------------|
| `LINK` | Lien partageable — tout étudiant peut s'inscrire |
| `INDIVIDUAL` | Email nominatif — crée un compte pré-activé |
| `BATCH` | Tableau d'étudiants — traitement en lot |

---

### 16. Obtenir ou créer le lien d'invitation principal

```
GET /api/classes/:id/invitations
```

**Auth requise** : Oui

> Retourne le lien existant, ou en crée un nouveau s'il n'en existe pas.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439040",
    "token": "abc123def456",
    "type": "LINK",
    "classId": "68a1b2c3d4e5f6789abcdef0",
    "expiresAt": null,
    "maxUses": null,
    "currentUses": 5,
    "invitationUrl": "http://localhost:3000/join/abc123def456",
    "createdAt": "2024-09-01T08:00:00.000Z"
  }
}
```

---

### 17. Créer une invitation

```
POST /api/classes/:id/invitations
```

**Auth requise** : Oui

#### Option A — Nouveau lien partageable (`LINK`)

```json
{
  "type": "LINK",
  "options": {
    "expiresAt": "2025-06-30T23:59:59.000Z",
    "maxUses": 50
  }
}
```

#### Option B — Invitation individuelle (`INDIVIDUAL`)

> Crée un compte étudiant pré-activé et envoie un email d'activation.

```json
{
  "type": "INDIVIDUAL",
  "email": "eleve@gmail.com",
  "name": "Jean Dupont"
}
```

#### Option C — Import en lot (`BATCH`)

```json
{
  "type": "BATCH",
  "students": [
    { "email": "eleve1@gmail.com", "name": "Élève Un" },
    { "email": "eleve2@gmail.com", "name": "Élève Deux" }
  ],
  "fileInfo": {
    "filename": "liste-classe.xlsx"
  }
}
```

#### Réponse 200/201

Varie selon le type. Pour `INDIVIDUAL` :

```json
{
  "success": true,
  "data": {
    "invitationUrl": "http://localhost:3000/join/xyz789",
    "email": "eleve@gmail.com",
    "token": "xyz789"
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Type d'invitation invalide"` | `type` non reconnu |
| 401 | `"Non autorisé"` | Non authentifié |

---

### 18. Voir tous les liens d'invitation

```
GET /api/classes/:id/invitations/links
```

**Auth requise** : Oui

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439040",
      "token": "abc123def456",
      "type": "LINK",
      "expiresAt": null,
      "maxUses": null,
      "currentUses": 5,
      "isActive": true,
      "createdAt": "2024-09-01T08:00:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439041",
      "token": "def456ghi789",
      "type": "INDIVIDUAL",
      "email": "eleve@gmail.com",
      "expiresAt": "2025-06-30T23:59:59.000Z",
      "maxUses": 1,
      "currentUses": 0,
      "isActive": true,
      "createdAt": "2024-09-10T08:00:00.000Z"
    }
  ]
}
```

---

## Rejoindre une classe via token

Ces endpoints sont **publics** (pas de session requise).

### 19. Valider un token d'invitation

```
GET /api/invitations/:token
```

**Auth requise** : Non (public)

#### Réponse 200 — Invitation de type `LINK`

```json
{
  "success": true,
  "data": {
    "type": "LINK",
    "className": "Terminale A1",
    "schoolName": "Lycée Bilingue",
    "teacherName": "Prof. Martin",
    "academicYear": "2024-2025",
    "expiresAt": null,
    "remainingUses": null,
    "isActivation": false
  }
}
```

#### Réponse 200 — Invitation de type `INDIVIDUAL`

```json
{
  "success": true,
  "data": {
    "type": "INDIVIDUAL",
    "className": "Terminale A1",
    "schoolName": "Lycée Bilingue",
    "teacherName": "Prof. Martin",
    "academicYear": "2024-2025",
    "expiresAt": "2025-06-30T23:59:59.000Z",
    "remainingUses": 1,
    "email": "eleve@gmail.com",
    "isActivation": true
  }
}
```

> **`isActivation: true`** → Le compte existe déjà, afficher un formulaire "Activer mon compte" (mot de passe uniquement).  
> **`isActivation: false`** → Nouveau compte, afficher un formulaire complet (nom + email + mot de passe).

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 404 | `"Lien d'invitation invalide ou expiré"` | Token invalide ou expiré |

---

### 20. Rejoindre via token (création/activation de compte)

```
POST /api/invitations/:token
```

**Auth requise** : Non (public)

#### Corps — Invitation `INDIVIDUAL` (activation de compte)

```json
{
  "password": "MonMotDePasse123!"
}
```

#### Corps — Invitation `LINK` (nouveau compte)

```json
{
  "name": "Jean Dupont",
  "email": "jean@gmail.com",
  "password": "MonMotDePasse123!"
}
```

| Champ | Requis pour INDIVIDUAL | Requis pour LINK |
|-------|------------------------|------------------|
| `password` | **Oui** (min 8 chars) | **Oui** (min 8 chars) |
| `name` | Non | **Oui** (min 2 chars) |
| `email` | Non | **Oui** (format valide) |

#### Réponse 200 — Activation (`INDIVIDUAL`)

```json
{
  "success": true,
  "message": "Compte activé avec succès ! Vous pouvez maintenant vous connecter.",
  "data": {
    "userId": "507f1f77bcf86cd799439050",
    "email": "eleve@gmail.com"
  }
}
```

#### Réponse 200 — Nouveau compte (`LINK`)

```json
{
  "success": true,
  "message": "Compte créé avec succès ! Vous pouvez maintenant vous connecter.",
  "data": {
    "userId": "507f1f77bcf86cd799439051",
    "email": "jean@gmail.com"
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Le mot de passe doit contenir au moins 8 caractères"` | Mot de passe trop court |
| 400 | `"Le nom doit contenir au moins 2 caractères"` | Nom trop court (LINK) |
| 400 | `"Email invalide"` | Format email invalide (LINK) |
| 404 | `"Lien d'invitation invalide ou expiré"` | Token invalide |
| 404 | `"Compte non trouvé"` | User supprimé pour INDIVIDUAL |
| 409 | `"..."` | Email déjà utilisé (contient "existe déjà") |
| 500 | `"Erreur serveur"` | Erreur serveur |

> **Flux post-inscription** : Après succès, rediriger l'utilisateur vers la page de connexion. Les comptes créés via invitation sont immédiatement actifs.

---

## Vue élève

### 21. Mes classes (liste)

```
GET /api/student/classes
```

**Auth requise** : Oui  
**Rôle** : `STUDENT`

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "68a1b2c3d4e5f6789abcdef0",
      "name": "Terminale A1",
      "academicYear": "2024-2025",
      "school": { "_id": "...", "name": "Lycée Bilingue" },
      "level": { "_id": "...", "name": "Terminale" },
      "mainTeacher": { "_id": "...", "name": "Prof. Martin" },
      "studentsCount": 32,
      "myRank": 5,
      "myAverageScore": 14.5
    }
  ]
}
```

---

### 22. Détail d'une classe (vue élève enrichie)

```
GET /api/student/classes/:classId
```

**Auth requise** : Oui  
**Rôle** : `STUDENT` — doit être inscrit dans la classe

> Endpoint riche : retourne la classe, les examens avec statut, les élèves, les enseignants regroupés, les syllabus et le classement complet.

#### Réponse 200

```json
{
  "success": true,
  "class": {
    "id": "68a1b2c3d4e5f6789abcdef0",
    "name": "Terminale A1",
    "academicYear": "2024-2025",
    "school": { "_id": "...", "name": "Lycée Bilingue" },
    "level": { "_id": "...", "name": "Terminale" },
    "mainTeacher": { "_id": "...", "name": "Prof. Martin" },
    "studentsCount": 32
  },
  "exams": [
    {
      "id": "507f1f77bcf86cd799439060",
      "title": "Composition de Mathématiques",
      "description": "Examen du premier trimestre",
      "startTime": "2025-01-15T08:00:00.000Z",
      "endTime": "2025-01-15T10:00:00.000Z",
      "duration": 120,
      "closeMode": "STRICT",
      "createdById": "507f1f77bcf86cd799439011",
      "_count": { "questions": 20 },
      "subject": "Mathématiques",
      "status": "completed",
      "attempts": [
        {
          "id": "507f1f77bcf86cd799439070",
          "status": "COMPLETED",
          "score": 16
        }
      ]
    }
  ],
  "students": [
    {
      "id": "507f1f77bcf86cd799439050",
      "name": "Jean Dupont",
      "email": "jean@gmail.com",
      "image": null,
      "isActive": true
    }
  ],
  "teachers": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Prof. Martin",
      "email": "martin@school.cm",
      "image": null,
      "role": "Professeur principal",
      "subjects": []
    },
    {
      "id": "507f1f77bcf86cd799439030",
      "name": "Prof. Smith",
      "email": "smith@school.cm",
      "image": null,
      "role": "Collaborateur",
      "subjects": [
        { "id": "...", "name": "Mathématiques", "code": "MATH" }
      ]
    }
  ],
  "syllabuses": [
    {
      "id": "507f1f77bcf86cd799439080",
      "title": "Programme de Mathématiques T1",
      "description": "Algèbre et Géométrie",
      "status": "PUBLISHED",
      "subject": { "id": "...", "name": "Mathématiques", "code": "MATH" },
      "teacher": { "id": "...", "name": "Prof. Smith" },
      "chaptersCount": 5,
      "version": 1
    }
  ],
  "ranking": [
    {
      "rank": 1,
      "isCurrentUser": false,
      "id": "507f1f77bcf86cd799439051",
      "name": "Marie Curie",
      "image": null,
      "averageScore": 18.5,
      "examsCompleted": 5
    },
    {
      "rank": 5,
      "isCurrentUser": true,
      "id": "507f1f77bcf86cd799439050",
      "name": "Jean Dupont",
      "image": null,
      "averageScore": 14.5,
      "examsCompleted": 4
    },
    {
      "rank": 32,
      "isCurrentUser": false,
      "id": "507f1f77bcf86cd799439099",
      "name": "Pierre Martin",
      "image": null,
      "averageScore": null,
      "examsCompleted": 0
    }
  ]
}
```

#### Statuts d'examen (`status`)

| Valeur | Signification |
|--------|---------------|
| `"upcoming"` | L'examen n'a pas encore commencé |
| `"active"` | En cours, l'élève peut le démarrer |
| `"in_progress"` | L'élève l'a commencé mais pas terminé |
| `"completed"` | L'élève l'a terminé |
| `"missed"` | L'examen est passé, l'élève n'a pas participé |

#### Logique du classement

- Trié par `averageScore` décroissant
- Les élèves sans examen complété ont `averageScore: null` et sont en bas
- `isCurrentUser: true` identifie l'élève connecté dans le tableau

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 401 | `"Non autorisé"` | Non authentifié |
| 403 | `"Vous n'êtes pas inscrit dans cette classe"` | Élève non inscrit |
| 404 | `"Classe non trouvée"` | Classe inexistante |

---

## Administration des classes (SCHOOL_ADMIN)

### 23. Lister les classes à valider

```
GET /api/admin/classes?status=PENDING
```

**Auth requise** : Oui  
**Rôle** : `SCHOOL_ADMIN` (doit administrer au moins une école)

#### Query Parameters

| Paramètre | Description |
|-----------|-------------|
| `status` | Filtrer par statut de validation : `PENDING`, `VALIDATED`, `REJECTED` |

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "68a1b2c3d4e5f6789abcdef0",
      "name": "Terminale A1",
      "academicYear": "2024-2025",
      "schoolName": "Lycée Bilingue",
      "mainTeacher": { "name": "Prof. Martin" },
      "validationStatus": "PENDING",
      "createdAt": "2024-09-01T08:00:00.000Z"
    }
  ],
  "schools": [
    { "_id": "507f1f77bcf86cd799439012", "name": "Lycée Bilingue" }
  ]
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 403 | `"You are not an administrator of any school"` | Pas admin d'école |

---

### 24. Valider ou rejeter une classe

```
POST /api/admin/classes/:id/validate
```

**Auth requise** : Oui  
**Rôle** : `SCHOOL_ADMIN` de l'école à laquelle appartient la classe

#### Corps de la requête

```json
{
  "action": "VALIDATE"
}
```

Pour rejeter :

```json
{
  "action": "REJECT",
  "reason": "Classe dupliquée, fusionner avec Terminale A2"
}
```

| Champ | Requis | Valeurs |
|-------|--------|---------|
| `action` | **Oui** | `"VALIDATE"` ou `"REJECT"` |
| `reason` | Oui si REJECT | Raison du rejet |

#### Réponse 200

```json
{
  "success": true,
  "message": "Class validated successfully",
  "data": {
    "_id": "68a1b2c3d4e5f6789abcdef0",
    "validationStatus": "VALIDATED",
    "updatedAt": "2025-01-10T14:00:00.000Z"
  }
}
```

#### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| 400 | `"Invalid action. Must be 'VALIDATE' or 'REJECT'"` | Action invalide |
| 400 | `"Rejection reason is required"` | Raison manquante pour REJECT |
| 400 | `"Class is not associated with any school"` | Classe sans école |
| 403 | `"You are not authorized to manage this class"` | Pas admin de l'école |
| 404 | `"Class not found"` | Classe inexistante |

---

## Enums de référence

### ClassTeacherRole

| Valeur | Description |
|--------|-------------|
| `COLLABORATOR` | Enseignant collaborateur (défaut) |

### ClassTeacherPermission

| Valeur | Description |
|--------|-------------|
| `INVITE_TEACHERS` | Peut ajouter/modifier des collaborateurs |

### Statuts de validation (classe)

| Valeur | Description |
|--------|-------------|
| `PENDING` | En attente de validation par l'admin d'école |
| `VALIDATED` | Approuvée |
| `REJECTED` | Rejetée |

---

## Inconsistances API à noter

> Ces différences existent dans le code actuel. Le frontend doit les gérer.

| Endpoint | Clé d'erreur | Exemple |
|----------|-------------|---------|
| `GET/POST/PUT/DELETE /api/classes/[id]/teachers` | `{ error: "..." }` | Pas de `success: false` |
| `POST /api/classes/[id]/teachers/invite` | `{ error: "..." }` | Pas de `success: false` |
| `GET /api/invitations/[token]` | `{ success: false, message: "..." }` | Standard |
| Tous les autres endpoints | `{ success: false, message: "..." }` | Standard |

**Recommandation** : Vérifier à la fois `response.ok` (HTTP status) et `data.success` pour gérer les erreurs de manière robuste.

---

## Flux complets recommandés

### Flux 1 : Enseignant crée une classe et invite des élèves

```
1. POST /api/classes → créer la classe
2. GET  /api/classes/:id/invitations → obtenir le lien
3. Partager le lien aux élèves
   OU
3. POST /api/classes/:id/invitations { type: "INDIVIDUAL" } → inviter un élève par email
   OU
3. POST /api/classes/:id/invitations { type: "BATCH" } → import en lot
```

### Flux 2 : Élève rejoint via lien

```
1. GET  /api/invitations/:token → valider le token, obtenir les infos classe
2. Afficher le formulaire selon isActivation:
   - isActivation: true  → formulaire mot de passe uniquement
   - isActivation: false → formulaire nom + email + mot de passe
3. POST /api/invitations/:token → créer/activer le compte + inscription automatique
4. Rediriger vers /login
```

### Flux 3 : Enseignant ajoute un collaborateur

```
1. GET  /api/classes/:id/teachers → voir les collaborateurs existants
2. POST /api/classes/:id/teachers → ajouter par ID (si l'enseignant existe)
   OU
2. POST /api/classes/:id/teachers/invite → inviter par email (crée compte si besoin)
3. PUT  /api/classes/:id/teachers → modifier les permissions si nécessaire
```
