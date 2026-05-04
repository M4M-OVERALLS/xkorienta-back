# Module 22 - Teacher Registration Checklist

> Audience : Equipe produit (frontend + backend)  
> Contexte front : parcours enseignant dans `/teacher/classes`  
> Objectif : definir les informations a collecter pour enregistrer un professeur sans oublier les champs critiques

---

## 1) Ce que tu as deja bien identifie

Pour chaque professeur, tu as cite les bons fondamentaux :
- nom ;
- email ;
- classes assignees ;
- matieres enseignees.

Ces champs sont indispensables, mais il manque quelques donnees pour un flux solide en production.

---

## 2) Informations minimales obligatoires (MVP)

Utiliser ce bloc si vous voulez lancer vite et rester compatible avec les endpoints existants.

### Identite professeur
- `name` (string, requis) ;
- `email` (string, requis, unique, format valide).

### Affectation pedagogique
- `classId` ou `classIds` (au moins une classe cible) ;
- `subjectIds` (au moins une matiere par affectation).

### Contexte organisationnel
- `schoolId` (fortement recommande et souvent necessaire selon le contexte ecole).

---

## 3) Informations recommandees (a ajouter pour eviter les blocages)

### Gestion compte et securite
- `status` : `INVITED` | `ENROLLED` | `ACTIVE` | `SUSPENDED` ;
- `isActive` (boolean) ;
- `invitedAt` / `enrolledAt` (dates de suivi) ;
- `invitedBy` (userId de l'admin/prof qui a invite).

### Contact et identifiants metier
- `phone` (optionnel mais utile pour support et relance) ;
- `teacherCode`/`employeeId` (optionnel, utile pour administration interne).

### Parametrage pedagogique par classe
- `role` (ex: `COLLABORATOR`) ;
- `permissions` (ex: `INVITE_TEACHERS`, `CREATE_EXAMS`, `VIEW_STATS`, etc.) ;
- affectation par couple **classe + matiere** (pas seulement une liste globale de matieres).

### Audit et tracabilite
- `createdAt`, `updatedAt` ;
- `lastLogin` (suivi d'activation reel) ;
- journal d'actions (qui a ajoute, modifie, retire).

---

## 4) Structure de donnees recommandee cote produit

```json
{
  "teacher": {
    "name": "Prof. Mbia",
    "email": "mbia@example.com",
    "phone": "+2376XXXXXXX",
    "schoolId": "school_123",
    "status": "INVITED",
    "isActive": true
  },
  "assignments": [
    {
      "classId": "class_1",
      "subjectIds": ["subject_math", "subject_phy"],
      "role": "COLLABORATOR",
      "permissions": ["CREATE_EXAMS", "VIEW_STATS"]
    },
    {
      "classId": "class_2",
      "subjectIds": ["subject_math"],
      "role": "COLLABORATOR",
      "permissions": ["VIEW_STATS"]
    }
  ]
}
```

---

## 5) Mapping avec l'existant API

### Cas A - Creer un prof de base (annuaire)
- Endpoint : `POST /api/teachers`
- Payload minimal observe :
  - `name`
  - `email`
  - `schoolId`

### Cas B - Ajouter/inviter un prof dans une classe
- Endpoint : `POST /api/classes/:id/teachers/invite`
- Payload minimal observe :
  - `email`
  - `name`
  - `subjectIds` (obligatoire, au moins une matiere)
  - `role` (optionnel)
  - `permissions` (optionnel)

### Cas C - Ajouter un prof deja existant a une classe
- Endpoint : `POST /api/classes/:id/teachers`
- Payload :
  - `teacherId`
  - `subjectId`
  - `role`
  - `permissions`

---

## 6) Mapping parcours front (`/teacher/classes`)

Pour ton flux front "on cree les classes puis on rattache les professeurs" :

1. Creer/selectionner la classe dans `/teacher/classes` ;
2. Ouvrir l'ecran d'ajout enseignant de la classe ;
3. Renseigner `name` + `email` ;
4. Choisir une ou plusieurs matieres (`subjectIds`) ;
5. Definir le role/permissions si necessaire ;
6. Inviter le prof (ou l'ajouter s'il existe deja) ;
7. Afficher le statut retour (`INVITED` ou `ENROLLED`) dans l'UI.

---

## 7) Ce que tu avais oublie (le plus important)

Si l'objectif est robuste, il manquait surtout :
- le **statut d'activation** du professeur (`INVITED/ENROLLED/ACTIVE`) ;
- les **permissions** par classe ;
- la distinction **prof existant** vs **prof a inviter** ;
- la traçabilite (`invitedBy`, dates, historique) ;
- la structuration par **affectation classe + matiere**, pas uniquement "liste de classes" et "liste de matieres" separees.

---

## 8) Validation rapide avant implementation

- Le meme email ne doit pas creer des doublons enseignant.
- Impossible d'inviter sans matiere (`subjectIds` vide).
- Un prof peut etre sur plusieurs classes avec permissions differentes.
- Les matieres proposees doivent etre filtrees par niveau/classe.
- Les actions sensibles (ajout/retrait prof) doivent etre reservees au main teacher ou permissions adequates.

