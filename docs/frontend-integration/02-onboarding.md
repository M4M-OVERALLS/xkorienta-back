# Module 02 — Onboarding & Registration

> **Base URL** : `http://localhost:3001` (dev) — remplacer par l'URL de production  
> **Auth** : Session NextAuth (cookie `next-auth.session-token`) ou Bearer JWT selon le setup frontend  
> **Content-Type** : `application/json` sur tous les endpoints

---

## Vue d'ensemble du flux

L'inscription sur QuizLock se déroule en **2 étapes obligatoires** :

```
Étape 1 ──► POST /api/register          → Créer le compte (sans rôle)
              │
              ▼
           L'utilisateur se connecte (NextAuth / login)
              │
              ▼
Étape 2 ──► POST /api/onboarding        → Choisir le rôle + compléter le profil
```

Il existe également un flux alternatif (**inscription complète en une étape**) utilisé notamment lors de la création d'une école :

```
POST /api/register/v2   → Créer le compte AVEC rôle dès le départ
```

---

## Endpoints

### 1. `POST /api/register` — Créer un compte (sans rôle)

**Accès** : Public (non authentifié)  
**Rate limit** : Activé — max ~10 requêtes / 15 min par IP

#### Corps de la requête

```json
{
  "name": "Jean Dupont",
  "email": "jean.dupont@example.com",
  "phone": "+237612345678",
  "password": "MonMotDePasse1!"
}
```

| Champ | Type | Requis | Règles |
|-------|------|--------|--------|
| `name` | string | Oui | 2 à 100 caractères |
| `email` | string (email) | Oui* | Format email valide |
| `phone` | string | Oui* | 8 à 15 chiffres, peut commencer par `+` |
| `password` | string | Oui | 8 à 128 caractères, doit contenir majuscule + chiffre ou symbole |

> *`email` **ou** `phone` est requis (pas forcément les deux)

#### Réponse succès — `201 Created`

```json
{
  "message": "User created successfully. Please complete onboarding.",
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "phone": "+237612345678"
  }
}
```

#### Exceptions

| Code HTTP | `message` | Cause |
|-----------|-----------|-------|
| `400` | `"Invalid input data"` | Validation Zod échouée (nom trop court, email invalide, etc.) |
| `400` | `"Email ou numéro de téléphone requis"` | Ni email ni téléphone fourni |
| `400` | `"User already exists"` | Email ou téléphone déjà enregistré |
| `400` | `"<message du validateur de mot de passe>"` | Mot de passe trop faible |
| `429` | `"Too many requests"` | Rate limit dépassé |
| `500` | `"Internal server error"` | Erreur serveur |

---

### 2. `POST /api/onboarding` — Compléter l'onboarding (choisir un rôle)

**Accès** : Authentifié (session NextAuth requise)  
**Rate limit** : Non

L'utilisateur doit être connecté via NextAuth avant d'appeler cet endpoint. Appelez-le immédiatement après la première connexion.

#### Corps de la requête — Rôle STUDENT

```json
{
  "role": "STUDENT",
  "details": {
    "subSystem": "FRANCOPHONE",
    "cycle": "SECONDAIRE_SECOND_CYCLE",
    "level": "Terminale"
  }
}
```

#### Corps de la requête — Rôle TEACHER

```json
{
  "role": "TEACHER",
  "details": {}
}
```

| Champ | Type | Requis | Valeurs acceptées |
|-------|------|--------|-------------------|
| `role` | string | Oui | `"STUDENT"` ou `"TEACHER"` |
| `details` | object | Oui | Voir tableau ci-dessous |

**Champs `details` pour STUDENT :**

| Champ | Type | Requis | Valeurs |
|-------|------|--------|---------|
| `subSystem` | string | Non (défaut: `FRANCOPHONE`) | `FRANCOPHONE`, `ANGLOPHONE`, `BILINGUAL` |
| `cycle` | string | Non (défaut: `SECONDAIRE_PREMIER_CYCLE`) | Voir tableau des cycles |
| `level` | string | Non (défaut: `NIVEAU_INCONNU`) | Ex: `"Terminale"`, `"3ème"`, `"CM2"` |

**Cycles disponibles (`Cycle`) :**

| Valeur | Description |
|--------|-------------|
| `PRESCOLAIRE` | Petite section → Grande section / Nursery |
| `PRIMAIRE` | SIL → CM2 / Class 1 → Class 6 |
| `SECONDAIRE_PREMIER_CYCLE` | 6ème → 3ème / Form 1 → Form 5 |
| `SECONDAIRE_SECOND_CYCLE` | 2nde → Terminale / Lower-Upper Sixth |
| `TECHNIQUE_PREMIER_CYCLE` | 1ère → 4ème année technique |
| `TECHNIQUE_SECOND_CYCLE` | 2nde technique → Terminale technique |
| `NORMAL` | ENIEG / ENIET / TTC |
| `BTS_HND` | BTS 1-2 / HND 1-2 |
| `LICENCE` | L1 → L3 |
| `MASTER` | M1 → M2 |
| `DOCTORAT` | D1 → D3+ |
| `SUPERIEUR` | Alias générique supérieur |

#### Réponse succès — `200 OK`

```json
{
  "message": "Onboarding completed successfully",
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "role": "STUDENT",
    "studentCode": "X7K3M2P1"
  }
}
```

> Le champ `studentCode` n'est présent que pour les étudiants (généré automatiquement).  
> Pour les enseignants, un `PedagogicalProfile` est créé automatiquement en arrière-plan.

#### Exceptions

| Code HTTP | `message` | Cause |
|-----------|-----------|-------|
| `400` | `"Invalid request body"` | Corps JSON malformé |
| `400` | `"Invalid role selected"` | Rôle autre que `STUDENT` ou `TEACHER` |
| `400` | `"Role already assigned"` | L'utilisateur a déjà un rôle différent |
| `401` | `"Unauthorized"` | Session absente ou expirée |
| `404` | `"User not found"` | Aucun compte associé à la session |
| `500` | `"Internal server error"` | Erreur serveur |

---

### 3. `POST /api/register/v2` — Inscription complète avec rôle (flux alternatif)

**Accès** : Public  
**Usage** : Inscription en une étape, notamment pour créer une école en même temps

#### Corps de la requête

```json
{
  "name": "Marie Curie",
  "email": "marie@lycee.cm",
  "phone": "+237699000001",
  "password": "Secure123!",
  "role": "TEACHER",
  "schoolId": "64f1a2b3c4d5e6f7a8b9c0e2"
}
```

| Champ | Type | Requis | Notes |
|-------|------|--------|-------|
| `name` | string | Oui | |
| `email` | string | Oui* | |
| `phone` | string | Oui* | |
| `password` | string | Oui | |
| `role` | string | Oui | `STUDENT`, `TEACHER`, `SCHOOL_ADMIN` |
| `schoolId` | string | Conditionnel | Requis si rôle `TEACHER` ou `SCHOOL_ADMIN` sans création d'école |

#### Réponse succès — `200 OK` (cas simple)

```json
{
  "success": true,
  "message": "Inscription réussie",
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Marie Curie",
    "email": "marie@lycee.cm",
    "phone": "+237699000001",
    "role": "TEACHER",
    "awaitingSchoolValidation": false
  }
}
```

#### Réponse succès — `200 OK` (avec création d'école)

```json
{
  "success": true,
  "message": "Inscription réussie. Votre école a été créée et vous en êtes l'administrateur.",
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Marie Curie",
    "email": "marie@lycee.cm",
    "phone": "+237699000001",
    "role": "SCHOOL_ADMIN",
    "awaitingSchoolValidation": true
  },
  "createdSchool": {
    "id": "64f1a2b3c4d5e6f7a8b9c0e2",
    "name": "Lycée Technique de Yaoundé",
    "status": "PENDING"
  }
}
```

#### Exceptions

| Code HTTP | `message` | Cause |
|-----------|-----------|-------|
| `400` | `"Un compte existe déjà"` | Email déjà enregistré |
| `400` | `"Ce numéro de téléphone est déjà utilisé"` | Téléphone déjà enregistré |
| `400` | `"Invalid role"` | Rôle non reconnu |
| `400` | `"School selection is required"` | Rôle nécessite un `schoolId` |
| `400` | `"Selected school does not exist"` | `schoolId` invalide |
| `400` | `"Email ou numéro de téléphone requis"` | Ni email ni téléphone |
| `400` | `"Caractères invalides détectés"` | Injection détectée dans les champs |
| `500` | `"Erreur interne du serveur"` | Erreur serveur |

---

## Logique côté frontend recommandée

```
1. Afficher formulaire d'inscription
2. POST /api/register → stocker l'email/téléphone
3. Rediriger vers la page de connexion (NextAuth signIn)
4. Après connexion, vérifier si session.user.role est null/undefined
5. Si pas de rôle → afficher l'écran de choix de rôle
6. POST /api/onboarding avec le rôle et les détails
7. Rediriger vers le dashboard selon le rôle :
   - STUDENT  → /student
   - TEACHER  → /teacher
   - SCHOOL_ADMIN → /admin
```

---

## Notes importantes

- Un utilisateur dont le rôle est déjà défini ne peut **pas en changer** via `/api/onboarding` (erreur 400 `Role already assigned`)
- Si `subSystem` / `cycle` / `level` sont absents pour un STUDENT, des valeurs par défaut sont appliquées automatiquement
- Si le niveau (`level`) n'existe pas encore en base, il est créé automatiquement — aucune action requise du frontend
