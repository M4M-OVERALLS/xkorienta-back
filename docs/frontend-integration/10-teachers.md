# Module 10 — Teachers (Dashboard Enseignant)

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie de session `next-auth.session-token` (login avec rôle `TEACHER`)

---

## Vue d'ensemble

Le module Teachers gère tout ce qui se trouve dans le tableau de bord de l'enseignant : ses classes, l'invitation d'élèves, les statistiques de performance de la classe, les enseignants collaborateurs, et le lien avec les établissements scolaires.

### Rôles concernés

| Rôle | Accès |
|------|-------|
| `TEACHER` | Titulaire complet de ses classes, vue sur les performances. Peut inviter des élèves et des collaborateurs. |
| `ADMIN` / School Admin | Peut valider une classe (hors scope de ce document focalisé sur l'enseignant). |

### Structure des permissions (Collaborateurs)

Dans une classe, on distingue :
- **isMainTeacher** : L'enseignant principal (propriétaire de la classe), a tous les droits (suppression de la classe, modification, retrait de collaborateurs).
- **Collaborateur** : Un enseignant invité via `POST /api/classes/:id/teachers` sur certaines matières avec des permissions spécifiques (`ClassTeacherPermission`).

---

## 1. Gestion des Établissements (Schools)

L'enseignant peut postuler ou lister ses établissements.

### 1.1 Lister ses écoles

```
GET /api/teacher/schools
```

**Auth requise** : Oui (`TEACHER`)

> Retourne la liste des écoles auxquelles l'enseignant est lié (statut `APPROVED`, `PENDING` ou `REJECTED`).

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "school": {
        "_id": "507f1f77bcf86cd799445100",
        "name": "Lycée Technique de Douala",
        "logoUrl": "..."
      },
      "status": "APPROVED",
      "appliedAt": "2024-11-10T12:00:00.000Z",
      "isPending": false
    }
  ]
}
```

### 1.2 Postuler à une école

```
POST /api/teacher/link-school
```

**Auth requise** : Oui (`TEACHER`)

> Demande à rejoindre un établissement éducatif.

#### Corps de requête

```json
{
  "schoolId": "507f1f77bcf86cd799445100"
}
```

#### Réponse 200 / Erreurs 400

Même format `{ "success": boolean, "message": string }` dans la réponse :
- `"École non trouvée"` (404)
- `"Vous êtes déjà membre de cette école"` (400)
- `"Vous avez déjà postulé à cette école"` (400)

---

## 2. Mes Classes & Statistiques

### 2.1 Lister mes classes

```
GET /api/classes
```

**Auth requise** : Oui (`TEACHER`)

> Liste les classes de l'enseignant (principales et collaboratives). Calcule automatiquement le score moyen, le nombre d'étudiants, et l'historique de performance sur les 7 derniers examens (pour afficher un mini-graphique sparkline).

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799446001",
      "name": "Terminale C — Physique",
      "academicYear": "2024-2025",
      "isMainTeacher": true,
      "schoolId": "507f1f77bcf86cd799445100",
      "validationStatus": "VALIDATED",
      "studentsCount": 32,
      "averageScore": 14.2,
      "examsCount": 5,
      "performanceHistory": [
        { "value": 12 },
        { "value": 14 },
        { "value": 15 }
      ]
    }
  ]
}
```

### 2.2 Créer une classe

```
POST /api/classes
```

**Auth requise** : Oui (`TEACHER`)

> Le statut de validation sera automatiquement `PENDING` si relié à une école, ou `INDEPENDENT` si l'enseignant le crée de façon indépendante.

#### Corps de requête

```json
{
  "name": "Terminale C — Mathématiques",
  "academicYear": "2024-2025",
  "level": "507f... (ID Level)",
  "school": "507f... (ID School - Optionnel)",
  "field": "507f... (ID Field)",
  "specialty": "507f... (ID Specialty - Optionnel)"
}
```

#### Réponse 201

```json
{
  "success": true,
  "data": { "_id": "...", "name": "...", "validationStatus": "PENDING" }
}
```

### 2.3 Détail d'une classe

```
GET /api/classes/:classId
```

**Auth requise** : Oui (Teacher dans la classe)

> Informations complètes (étudiants, profs, info générales). Propriété `isMainTeacherForCurrentUser` disponible.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799446001",
    "name": "Terminale C — Physique",
    "students": [{ "_id": "...", "name": "Jean Dupont", "email": "jean@.." }],
    "mainTeacher": { "_id": "...", "name": "Prof." },
    "isMainTeacherForCurrentUser": true
  }
}
```

### 2.4 Modifier et Supprimer la classe

```
PUT /api/classes/:classId
```
(Corps : Données modifiables de la classe)

```
DELETE /api/classes/:classId
```

> **Restriction** : Uniquement pour le Main Teacher (les collaborateurs auront une 403 Forbidden).

### 2.5 Statistiques de la classe

```
GET /api/classes/:classId/stats
```

**Auth requise** : Oui (Teacher dans la classe)

> Retourne un résumé puissant de la santé de la classe. Exigible pour construire le dashboard statistique.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "totalStudents": 32,
    "averageScore": 75.5,
    "attendanceRate": 95,
    "examsCount": 8,
    "performanceHistory": [
      {
        "name": "Contrôle N...",
        "score": 72.0,
        "fullDate": "2025-01-10T10:00:00Z"
      }
    ]
  }
}
```

---

## 3. Gestion des Étudiants et Invitations

### 3.1 Tous mes étudiants (toutes classes)

```
GET /api/teachers/students?search=&classId=
```

**Auth requise** : Oui (`TEACHER`)

> Retourne le pool de tous les étudiants liés aux classes de l'enseignant (utile pour un annuaire global de messages ou relances), dédoublonnés et agrégés.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalStudents": 150,
      "totalClasses": 5,
      "averagePerClass": 30
    },
    "classes": [
      { "_id": "...", "name": "Terminale C", "studentCount": 32 }
    ],
    "studentsWithClass": [
      {
        "id": "...",
        "name": "Alice Mballa",
        "email": "alice@...",
        "className": "Terminale C",
        "classId": "..."
      }
    ]
  }
}
```

### 3.2 Retirer un étudiant d'une classe

```
DELETE /api/classes/:classId/students/:studentId
```

**Auth requise** : Oui (Main Teacher uniquement)

#### Réponse 200

```json
{ "success": true, "message": "Student removed from class" }
```

### 3.3 Obtenir / Créer un lien permanent d'invitation

```
GET /api/classes/:classId/invitations
```

> Si le lien n'existe pas, l'API le crée. Retourne le lien par défaut.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "url": "http://localhost:3000/invite/cls_XyZ123"
  }
}
```

### 3.4 Créer une invitation spécifique (Lien expirable, Email, ou Batch CSV)

```
POST /api/classes/:classId/invitations
```

**Type : `LINK`** (lien avec limite/expiration)
```json
{
  "type": "LINK",
  "options": {
    "expiresAt": "2025-01-31T00:00:00.000Z",
    "maxUses": 50
  }
}
```

**Type : `INDIVIDUAL`** (envoyer un email)
```json
{
  "type": "INDIVIDUAL",
  "email": "eleve@example.com",
  "name": "Prénom Nom"
}
```

**Type : `BATCH`** (importer un CSV)
```json
{
  "type": "BATCH",
  "students": [
    { "email": "a@ex.com", "name": "Alice" },
    { "email": "b@ex.com", "name": "Bob" }
  ],
  "fileInfo": "eleves_terminale.csv"
}
```

#### Réponse 200

```json
{
  "success": true,
  "data": { "url": "..." },
  "message": "Invitation(s) générée(s)"
}
```

---

## 4. Enseignants Collaborateurs

### 4.1 Lister les enseignants de la classe

```
GET /api/classes/:classId/teachers
```

> Retourne le `mainTeacher` (titulaire) et la liste des `collaborators` (invités).  
> **Clé de réponse : `data`**.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "mainTeacher": { "_id": "...", "name": "Prof Titulaire" },
    "collaborators": [
      {
        "teacher": { "_id": "...", "name": "Prof Maths" },
        "subject": { "_id": "...", "name": "Maths", "code": "MTH" },
        "role": "COLLABORATOR",
        "permissions": ["CREATE_EXAMS", "VIEW_STATS"],
        "isActive": true
      }
    ]
  }
}
```

### 4.2 Ajouter un enseignant formateur (Collaborateur)

```
POST /api/classes/:classId/teachers
```

**Condition** : Être propriétaire de la classe OU avoir la permission `INVITE_TEACHERS`.

#### Corps de requête

```json
{
  "teacherId": "507f1f... (ID Teacher existant)",
  "subjectId": "507f... (ID de la matière enseignée)",
  "role": "COLLABORATOR",
  "permissions": ["CREATE_EXAMS", "VIEW_STATS"]
}
```

**Permissions disponibles** (`ClassTeacherPermission`) :  
`MANAGE_SYLLABUS`, `CREATE_EXAMS`, `GRADE_EXAMS`, `VIEW_STATS`, `INVITE_TEACHERS`.

#### Réponse 201

```json
{
  "success": true,
  "message": "Enseignant ajouté avec succès",
  "data": { "..." }
}
```

### 4.3 Modifier un Collaborateur

```
PUT /api/classes/:classId/teachers
```

Même condition que l'ajout. Permet de modifier les permissions en écrasement.

#### Corps de requête

```json
{
  "teacherId": "...",
  "subjectId": "...",
  "permissions": ["VIEW_STATS"]
}
```

### 4.4 Supprimer un Collaborateur

```
DELETE /api/classes/:classId/teachers?teacherId=xxx&subjectId=yyy
```

**Condition** : Être propriétaire de la classe OU l'enseignant ciblé lui-même (s'il démissionne de la classe).

#### Réponse 200

```json
{ "success": true, "message": "Enseignant retiré" }
```

---

## 5. Recherche d'enseignants (Annuaire)

### 5.1 Chercher des enseignants en base

```
GET /api/teachers?search=nom&schoolId=xxx&limit=20
```

> Utilisé pour charger le dropdown (Typeahead) quand on ajoute un prof à une classe. Retourne `data`.

### 5.2 Créer un enseignant (Manuel)

```
POST /api/teachers
```

> Idéal si le collaborateur n'a pas encore de compte. Le système lui crée un mot de passe temporaire invisible que l'école/l'Admin devra gérer.

#### Corps de requête

```json
{
  "name": "Prof Mbia",
  "email": "mbia@example.com",
  "schoolId": "..." 
}
```

### 5.3 Chercher des enseignants externes (Assistance)

```
GET /api/teachers/external?subject=yyy&school=zzz
```

> Utilisé pour trouver des professeurs afin d'émettre des requêtes de remédiation/assistance payante. Géré par l'élève, et exclut de base les enseignants de la propre école de l'élève.

---

## Incohérences API à noter

| Endpoint | Méthode | Clé Données | Remarque sur la gestion des erreurs |
|----------|---------|-------------|-------------------------------------|
| `/api/classes` | Tous | `data` | Renvoi de 500 pour validations MongoDB. |
| `/api/teacher/schools` | GET | `data` | Format différent (tableau contenant l'objet `school` au lieu de listes simples). |
| `/api/classes/:id/stats`| GET | `data` | Très lourd côté base de données si $> 100$ étudiants, à ne pas appeler dans une itération de liste. |
| `/api/teachers/students`| GET | `data.studentsWithClass` | Contient un mix entre `stats`, `classes` (dropdown) et tous les étudiants non paginés par défaut. |
| `/api/classes/:id/invitations` | POST | `data.url` (ou via erreur si BATCH échoue mal) | La vérification d'email lors des ajouts batch peut échouer sur le SMTP. Ne bloque pas la génération en soit en BD. |
