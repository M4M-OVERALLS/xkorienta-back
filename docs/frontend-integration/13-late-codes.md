# Module 13 — Late Codes (Codes de Retard)

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token` (Rôles : `STUDENT`, `TEACHER`)

---

## Vue d'ensemble

Les Examens sur Quizlock disposent d'une fonctionnalité de restriction horaire (une date de fin d'examen, après laquelle l'accès est bloqué). Le système de "Late Code" (Code de retard) permet aux Enseignants de générer un bypass exceptionnel et granulaire pour certains étudiants qui auraient eu un problème (panne électrique, urgence).

Un **Late Code** généré permet de repousser cette limite.

---

## 1. Générer un Code d'Accès Tardif (Enseignant)

```
POST /api/late-codes/generate
```

**Auth requise** : Oui (`TEACHER` ayant créé l'examen, ou ayant les droits sur la classe associée)

> Cette requête permet de configurer et générer un nouveau code unique d'accès. Ce code alphanumeric à 8 caractères peut être généré à l'avance ou le jour J.

#### Corps de la requête

```json
{
  "examId": "507f1f77bcf86cd799448000",
  "usagesRemaining": 1,
  "expiresAt": "2024-03-25T16:00:00Z",
  "assignedUserId": "...", 
  "reason": "Problème de connexion lors de l'examen initial."
}
```

- `examId` (String, obligatoire): L'ID de l'examen que l'on veut débloquer.
- `usagesRemaining` (Number, optionnel): Nombre de fois où le code peut être utilisé (Défaut : 1). Utile si le professeur veut transmettre un seul code à un groupe modéré.
- `expiresAt` (Date, optionnel): Date limite au dela de laquelle le code de bypass périme (Défaut : 7 jours).
- `assignedUserId` (String, optionnel): Pour verrouiller le bypass à un élève spécifique afin d'éviter qu'il donne ce code à un de ses camarades (recommandé).
- `reason` (String, optionnel): Note interne facultative.

#### Réponse 200

```json
{
  "success": true,
  "lateCode": {
    "_id": "...",
    "code": "KX4P9Q2M",
    "examId": "507f1f77bcf86cd799448000",
    "maxUsages": 1,
    "usagesRemaining": 1,
    "status": "ACTIVE",
    "expiresAt": "2024-03-25T16:00:00.000Z"
  }
}
```

*(L'enseignant transmet alors le code de 8 caractères à l'élève)*

---

## 2. Valider et Utiliser un Late Code (Étudiant)

```
POST /api/late-codes/validate
```

**Auth requise** : Oui (`STUDENT`)

> Avant de lancer l'examen bloqué (dans le lobby), l'élève entre le code de bypass. Si validé, le système enregistre l'utilisation (historique) et modifie le droit d'accès courant de l'étudiant pour cet examen. Il est invité à commencer.

#### Corps de la requête

```json
{
  "code": "KX4P9Q2M",
  "examId": "507f1f77bcf86cd799448000"
}
```

#### Réponse 200

```json
{
  "success": true,
  "lateCode": {
     "usagesRemaining": 0,
     "status": "EXHAUSTED"
  },
  "message": "Late code validated successfully. You can now access the exam."
}
```

#### Erreurs possibles
L'API effectue une validation très stricte dans le service :
- **400 / 500** avec `message` de l'erreur brute :
  - `"Invalid late code"` (Mauvais code)
  - `"Late code has been deactivated"` (Code désactivé manuellement par le prof)
  - `"Late code has expired"` (La date de validité choisie par le prof est passée)
  - `"Late code has no remaining usages"` (Code de groupe déjà consommé)
  - `"This late code is assigned to another user"` (L'élève tente d'utiliser le code nominatif d'un camarade)
  - `"You have already used this late code"` (L'étudiant s'en est déjà servi)
