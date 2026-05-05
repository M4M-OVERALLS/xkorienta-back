# Module 20 - Public Mini-Tests

> **Audience** : Equipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Aucune pour le parcours public, cookie/session requis pour certaines actions optionnelles

---

## Vue d'ensemble

Le module `Public Mini-Tests` permet a un visiteur non connecte de :
- decouvrir des mini-tests publics ;
- repondre rapidement a un quiz court ;
- obtenir un score et un feedback instantane ;
- etre redirige vers l'inscription pour debloquer les fonctionnalites avancees.

Ce module sert de porte d'entree produit (acquisition, engagement, conversion).

---

## Objectifs UX frontend

- Temps d'acces minimal (pas d'etape bloquante avant la premiere question).
- Parcours mobile-first.
- Progression claire (`question X / N`).
- Feedback immediat apres soumission.
- CTA final explicite : `Creer un compte` / `Continuer avec un compte`.

---

## Convention API (module 20)

### Reponse succes (format cible)
```json
{
  "success": true,
  "data": {}
}
```

### Reponse erreur (format cible)
```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### Regles frontend recommandees
- Toujours gerer `loading`, `error`, `empty`.
- Eviter de precharger tout le contenu si non necessaire (lazy loading).
- Sauvegarder localement la progression temporaire (sessionStorage) en cas de refresh.

---

## 1) Lister les mini-tests publics

```http
GET /api/public/mini-tests
```

### Query params
- `subject` (string, optionnel) : ID matiere
- `level` (string, optionnel) : ID niveau
- `difficulty` (string, optionnel) : `EASY` | `MEDIUM` | `HARD`
- `limit` (number, optionnel, defaut 12)
- `page` (number, optionnel, defaut 1)

### Exemple
```http
GET /api/public/mini-tests?difficulty=EASY&limit=6&page=1
```

### Reponse 200
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "mt_001",
        "title": "Calcul mental - Niveau debutant",
        "subject": { "_id": "sub_math", "name": "Mathematiques" },
        "level": { "_id": "lvl_1", "name": "6e" },
        "questionCount": 10,
        "difficulty": "EASY",
        "estimatedDurationSec": 300
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 6,
      "total": 24,
      "totalPages": 4
    }
  }
}
```

---

## 2) Recuperer le detail d'un mini-test public

```http
GET /api/public/mini-tests/:miniTestId
```

### Reponse 200
```json
{
  "success": true,
  "data": {
    "_id": "mt_001",
    "title": "Calcul mental - Niveau debutant",
    "description": "10 questions rapides pour evaluer les bases.",
    "subject": { "_id": "sub_math", "name": "Mathematiques" },
    "level": { "_id": "lvl_1", "name": "6e" },
    "questionCount": 10,
    "difficulty": "EASY",
    "estimatedDurationSec": 300,
    "instructions": [
      "Une seule reponse correcte par question",
      "Vous pouvez passer une question et revenir ensuite"
    ]
  }
}
```

---

## 3) Demarrer une tentative publique

```http
POST /api/public/mini-tests/:miniTestId/start
```

### Corps de requete
```json
{
  "nickname": "Invité",
  "consent": true
}
```

### Reponse 201
```json
{
  "success": true,
  "data": {
    "attemptId": "att_public_001",
    "miniTestId": "mt_001",
    "startedAt": "2026-04-17T10:00:00.000Z",
    "expiresAt": "2026-04-17T10:30:00.000Z"
  }
}
```

> Si le backend ne cree pas de tentative explicite, le frontend peut ignorer cette etape et soumettre directement les reponses en fin de test.

---

## 4) Recuperer les questions d'une tentative

```http
GET /api/public/mini-tests/attempts/:attemptId/questions
```

### Reponse 200
```json
{
  "success": true,
  "data": {
    "attemptId": "att_public_001",
    "questions": [
      {
        "_id": "q_001",
        "statement": "Combien font 8 x 7 ?",
        "choices": [
          { "_id": "c1", "label": "54" },
          { "_id": "c2", "label": "56" },
          { "_id": "c3", "label": "64" }
        ]
      }
    ]
  }
}
```

---

## 5) Soumettre une tentative publique

```http
POST /api/public/mini-tests/attempts/:attemptId/submit
```

### Corps de requete
```json
{
  "answers": [
    { "questionId": "q_001", "choiceId": "c2" },
    { "questionId": "q_002", "choiceId": "c7" }
  ],
  "timeSpentSec": 245
}
```

### Reponse 200
```json
{
  "success": true,
  "data": {
    "attemptId": "att_public_001",
    "score": 7,
    "totalQuestions": 10,
    "percentage": 70,
    "level": "INTERMEDIATE",
    "feedback": "Bon debut. Travaillez les operations a priorite.",
    "cta": {
      "title": "Creez un compte pour suivre votre progression",
      "action": "/register"
    }
  }
}
```

---

## 6) (Optionnel) Convertir une tentative invite en compte utilisateur

```http
POST /api/public/mini-tests/attempts/:attemptId/claim
```

### Auth requise
Oui (utilisateur connecte juste apres inscription/login).

### But
Rattacher la tentative publique au compte nouvellement cree.

---

## Codes erreurs a gerer cote frontend

- `400` : payload invalide (reponse manquante, format incorrect, consent absent).
- `404` : mini-test/tentative introuvable.
- `410` : tentative expiree.
- `429` : trop de tentatives en peu de temps.
- `500` : erreur interne.

---

## Flux frontend recommande

1. Charger la liste `GET /api/public/mini-tests`
2. Ouvrir le detail `GET /api/public/mini-tests/:miniTestId`
3. Demarrer `POST /start`
4. Charger les questions
5. Soumettre la tentative
6. Afficher score + recommandations + CTA inscription

---

## Exemple rapide (JavaScript)

```js
const listRes = await fetch("/api/public/mini-tests?limit=6");
const { data: listData } = await listRes.json();

const startRes = await fetch(`/api/public/mini-tests/${miniTestId}/start`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nickname: "Invite", consent: true })
});

const { data: startData } = await startRes.json();
```

---

## Checklist d'integration

- Verifier la compatibilite mobile (petits ecrans + clavier tactile).
- Empêcher la double soumission du formulaire final.
- Sauvegarder la progression locale en cas de refresh/fermeture onglet.
- Proteger contre le spam (cooldown client + gestion `429`).
- Instrumenter les events analytics (`mini_test_started`, `mini_test_submitted`, `mini_test_converted`).

---

## A valider avec l'equipe backend

- Noms definitifs des routes (`/api/public/mini-tests/...`).
- Existence de l'etape `start` et du `attemptId`.
- Structure exacte du payload des questions/reponses.
- Presence et format de l'endpoint `claim`.
