# Guide d'intégration — Authentification Xkorienta API

> **Base URL production** : `https://xkorienta.com/xkorienta/backend`  
> **Base URL développement** : `http://localhost:3001`  
> **Format** : JSON  
> **Auth** : NextAuth.js (session JWT + cookies)

---

## Table des matières

1. [Vue d'ensemble du flux](#1-vue-densemble-du-flux)
2. [Rôles disponibles](#2-rôles-disponibles)
3. [Étape 0 — Chercher une école (avant inscription)](#3-étape-0--chercher-une-école-avant-inscription)
4. [Étape 1 — Obtenir le token CSRF](#4-étape-1--obtenir-le-token-csrf)
5. [Étape 2 — Register (Professeur)](#5-étape-2--register-professeur)
6. [Étape 3 — Login](#6-étape-3--login)
7. [Étape 4 — Récupérer la session](#7-étape-4--récupérer-la-session)
8. [Étape 5 — Rejoindre une école (post-inscription)](#8-étape-5--rejoindre-une-école-post-inscription)
9. [Codes d'erreur](#9-codes-derreur)
10. [Exemples complets avec cURL](#10-exemples-complets-avec-curl)
11. [Variables d'environnement requises](#11-variables-denvironnement-requises)

---

## 1. Vue d'ensemble du flux

### Flux Register

```
Client                                    API
  |                                         |
  |── GET /api/schools/search?q=... ──────> |  (optionnel : chercher une école)
  |<─ { schools: [...] } ─────────────────  |
  |                                         |
  |── POST /api/register/v2 ─────────────> |
  |   { name, email, password, role, ... }  |
  |<─ 200 { success, user } ────────────── |
  |                                         |
  |  (enchaîner immédiatement avec le login)|
```

### Flux Login

```
Client                                    API (NextAuth)
  |                                         |
  |── GET /api/auth/csrf ─────────────────> |
  |<─ { csrfToken: "xxx" } + Set-Cookie ── |
  |                                         |
  |── POST /api/auth/callback/credentials > |
  |   csrfToken + identifier + password     |
  |<─ { url } + Set-Cookie (session JWT) ─ |
  |                                         |
  |── GET /api/auth/session ─────────────> |
  |<─ { user: { id, name, role, ... } } ── |
```

---

## 2. Rôles disponibles

| Valeur | Catégorie | Description | Inscription libre |
|--------|-----------|-------------|-------------------|
| `STUDENT` | Apprenant | Élève / étudiant | ✅ |
| `TEACHER` | Pédagogique | Professeur | ✅ |
| `SCHOOL_ADMIN` | Pédagogique | Directeur / administrateur d'école | ✅ |
| `INSPECTOR` | Pédagogique | Inspecteur | ❌ (assigné manuellement) |
| `SURVEILLANT` | Pédagogique | Surveillant | ❌ |
| `PREFET` | Pédagogique | Préfet de discipline | ❌ |
| `PRINCIPAL` | Pédagogique | Principal de collège | ❌ |
| `DG_ISIMMA` | Direction | Directeur général ISIMMA | ❌ |
| `RECTOR` | Direction | Recteur | ❌ |
| `DG_M4M` | Technique | DG M4M (super admin) | ❌ |
| `TECH_SUPPORT` | Technique | Support technique | ❌ |

> **Pour l'intégration front**, seuls `STUDENT`, `TEACHER` et `SCHOOL_ADMIN` sont utilisables lors de l'inscription.

---

## 3. Étape 0 — Chercher une école (avant inscription)

À appeler **pendant le wizard d'inscription** pour permettre à l'utilisateur de sélectionner une école existante validée.

### Option A — Recherche fuzzy (recommandée)

```http
GET /api/schools/search?q={terme}&city={ville}&type={type}&limit={n}
```

| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| `q` | string | ✅ | Terme de recherche (min 2 caractères) |
| `city` | string | Non | Filtrer par ville |
| `type` | string | Non | `PRIMARY` \| `SECONDARY` \| `HIGHER_ED` |
| `limit` | number | Non | Nombre de résultats (défaut: 10) |

**Réponse :**
```json
{
  "schools": [
    {
      "_id": "507f191e810c19729de860ea",
      "name": "Lycée Bilingue de Yaoundé",
      "type": "SECONDARY",
      "address": "Quartier Bastos",
      "city": "Yaoundé",
      "status": "VALIDATED"
    }
  ],
  "hasExactMatch": false
}
```

### Option B — Liste des écoles validées (simple)

```http
GET /api/schools/public?search={terme}
```

| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| `search` | string | Non | Filtre sur le nom de l'école |

**Réponse :**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f191e810c19729de860ea",
      "name": "Lycée Bilingue de Yaoundé",
      "type": "SECONDARY",
      "address": "Quartier Bastos",
      "logoUrl": null,
      "status": "VALIDATED",
      "contactInfo": {}
    }
  ]
}
```

> Utiliser l'`_id` retourné comme valeur du champ `schoolId` dans le payload d'inscription.

---

## 4. Étape 1 — Obtenir le token CSRF

Le token CSRF est **obligatoire** pour toutes les requêtes POST vers NextAuth.

```http
GET /api/auth/csrf
```

| Propriété | Valeur |
|-----------|--------|
| Méthode | `GET` |
| Auth requise | Non |

**Réponse :**
```json
{
  "csrfToken": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
}
```

**Exemple :**
```bash
curl -c cookies.txt \
  https://xkorienta.com/xkorienta/backend/api/auth/csrf
```

> **Critique** : Conserver le cookie retourné (`-c cookies.txt`). NextAuth valide le CSRF via ce cookie, pas uniquement via le token dans le body.

---

## 5. Étape 2 — Register (Professeur)

```http
POST /api/register/v2
Content-Type: application/json
```

### Body — Cas 1 : École existante (schoolId obtenu à l'étape 0)

```json
{
  "name": "Jean Dupont",
  "email": "prof@exemple.com",
  "password": "MonMotDePasse123",
  "role": "TEACHER",
  "schoolId": "507f191e810c19729de860ea"
}
```

### Body — Cas 2 : École non répertoriée (déclarée par l'utilisateur)

```json
{
  "name": "Jean Dupont",
  "email": "prof@exemple.com",
  "password": "MonMotDePasse123",
  "role": "TEACHER",
  "declaredSchoolData": {
    "name": "Lycée Bilingue de Yaoundé",
    "city": "Yaoundé",
    "country": "Cameroun",
    "type": "SECONDARY"
  }
}
```

> Le compte sera créé avec `awaitingSchoolValidation: true` en attendant la validation de l'école par un admin.

### Body — Cas 3 : Mode "Classe Libre" (sans école)

```json
{
  "name": "Jean Dupont",
  "email": "prof@exemple.com",
  "password": "MonMotDePasse123",
  "role": "TEACHER",
  "skipSchool": true
}
```

### Body — Cas 4 : Avec téléphone (sans email)

```json
{
  "name": "Jean Dupont",
  "phone": "+237691234567",
  "password": "MonMotDePasse123",
  "role": "TEACHER",
  "skipSchool": true
}
```

### Champs du body

| Champ | Type | Obligatoire | Contraintes |
|-------|------|-------------|-------------|
| `name` | string | ✅ | 2–100 caractères |
| `email` | string | ✅ si pas de `phone` | Format email valide |
| `phone` | string | ✅ si pas d'`email` | 8–15 chiffres, ex: `+237691234567` |
| `password` | string | ✅ | 6–128 caractères |
| `role` | string | ✅ | `TEACHER` \| `STUDENT` \| `SCHOOL_ADMIN` |
| `schoolId` | string | Non | `_id` d'une école existante validée |
| `declaredSchoolData.name` | string | Non | 2–200 caractères, pas de HTML |
| `declaredSchoolData.city` | string | Non | max 100 caractères |
| `declaredSchoolData.country` | string | Non | max 100 caractères |
| `declaredSchoolData.type` | string | Non | `PRIMARY` \| `SECONDARY` \| `HIGHER_ED` |
| `skipSchool` | boolean | Non | `true` = pas d'école au moment de l'inscription |

> **Règle** : `email` OU `phone` est obligatoire. Les deux peuvent être fournis simultanément.

### Réponse succès — 200

```json
{
  "success": true,
  "message": "Inscription réussie",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Jean Dupont",
    "email": "prof@exemple.com",
    "phone": null,
    "role": "TEACHER",
    "awaitingSchoolValidation": false
  }
}
```

### Réponse succès — Avec école créée (cas 2)

```json
{
  "success": true,
  "message": "Inscription réussie. Votre école a été créée et vous en êtes l'administrateur.",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Jean Dupont",
    "email": "prof@exemple.com",
    "phone": null,
    "role": "TEACHER",
    "awaitingSchoolValidation": true
  },
  "createdSchool": {
    "id": "507f191e810c19729de860ea",
    "name": "Lycée Bilingue de Yaoundé",
    "status": "PENDING"
  }
}
```

---

## 6. Étape 3 — Login

```http
POST /api/auth/callback/credentials
Content-Type: application/x-www-form-urlencoded
```

### Body (form-urlencoded)

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `csrfToken` | string | ✅ | Token de l'étape 1 |
| `identifier` | string | ✅ | Email **ou** numéro de téléphone |
| `password` | string | ✅ | Mot de passe |
| `callbackUrl` | string | Non | URL de redirection (défaut: `/dashboard`) |
| `json` | string | Non | `"true"` pour recevoir JSON au lieu d'un redirect |

### Exemples de payload

**Email :**
```
csrfToken=a1b2c3d4...&identifier=prof@exemple.com&password=MonMotDePasse123&json=true
```

**Téléphone :**
```
csrfToken=a1b2c3d4...&identifier=%2B237691234567&password=MonMotDePasse123&json=true
```

> Le `+` du numéro doit être encodé URL : `+237...` → `%2B237...`

### Réponse succès

```json
{
  "url": "https://xkorienta.com/dashboard"
}
```

Headers de réponse :
```
Set-Cookie: next-auth.session-token=...; HttpOnly; Secure; SameSite=Lax; Path=/
Set-Cookie: next-auth.csrf-token=...; HttpOnly; Secure; SameSite=Lax; Path=/
```

### Réponse échec

```json
{
  "url": "https://xkorienta.com/login?error=CredentialsSignin"
}
```

---

## 7. Étape 4 — Récupérer la session

```http
GET /api/auth/session
Cookie: next-auth.session-token=...
```

### Réponse — Connecté

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Jean Dupont",
    "email": "prof@exemple.com",
    "role": "TEACHER",
    "image": null,
    "schools": ["507f191e810c19729de860ea"]
  },
  "expires": "2026-05-08T14:00:00.000Z"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `user.id` | string | ID MongoDB de l'utilisateur |
| `user.name` | string | Nom complet |
| `user.email` | string | Email (ou phone pour comptes phone-only) |
| `user.role` | string | Rôle de l'utilisateur (voir section 2) |
| `user.image` | string \| null | Avatar |
| `user.schools` | string[] | IDs des écoles associées |
| `expires` | ISO date | Expiration de la session (30 jours) |

### Réponse — Non connecté

```json
{}
```

---

## 8. Étape 5 — Rejoindre une école (post-inscription)

Pour un professeur inscrit en mode "Classe Libre" qui veut rejoindre une école après coup.

```http
POST /api/schools/apply
Content-Type: application/json
Cookie: next-auth.session-token=...  ← session requise
```

### Body

```json
{
  "schoolId": "507f191e810c19729de860ea"
}
```

> La demande passe en statut `PENDING` jusqu'à validation par le `SCHOOL_ADMIN` de l'école.

---

## 9. Codes d'erreur

### Register (`POST /api/register/v2`)

| Code HTTP | Message | Cause |
|-----------|---------|-------|
| `400` | `"Un compte existe déjà avec cet email"` | Email déjà utilisé |
| `400` | `"Ce numéro de téléphone est déjà utilisé"` | Téléphone déjà utilisé |
| `400` | `"Email ou numéro de téléphone requis"` | Ni email ni phone fourni |
| `400` | `"Invalid role"` | Rôle non reconnu |
| `400` | `"Caractères invalides détectés"` | Injection dans `declaredSchoolData` |
| `400` | `"L'email est requis pour ce type de compte"` | SCHOOL_ADMIN sans email |
| `429` | `"Too many requests"` | Rate limit atteint (5 tentatives / 15 min / IP) |
| `500` | `"Erreur interne du serveur"` | Erreur serveur |

### Login (`POST /api/auth/callback/credentials`)

| Erreur dans l'URL | Cause |
|-------------------|-------|
| `?error=CredentialsSignin` | Identifiants incorrects |
| `?error=Configuration` | Mauvaise config NextAuth (NEXTAUTH_SECRET) |

### Recherche d'écoles (`GET /api/schools/search`)

| Code HTTP | Cause |
|-----------|-------|
| `200` avec `schools: []` | Terme `q` trop court (< 2 caractères) |
| `500` | Erreur serveur |

---

## 10. Exemples complets avec cURL

### Flux complet Register + Login

```bash
# 0. Chercher une école
curl -s "https://xkorienta.com/xkorienta/backend/api/schools/search?q=Lycee+Bilingue&city=Yaoundé"

# 1. Créer le compte (avec école existante)
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jean Dupont",
    "email": "prof@exemple.com",
    "password": "MonMotDePasse123",
    "role": "TEACHER",
    "schoolId": "507f191e810c19729de860ea"
  }' \
  https://xkorienta.com/xkorienta/backend/api/register/v2

# 2. Obtenir le CSRF token (et sauvegarder le cookie)
CSRF=$(curl -s -c cookies.txt \
  https://xkorienta.com/xkorienta/backend/api/auth/csrf \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")

echo "CSRF Token: $CSRF"

# 3. Se connecter
curl -s -b cookies.txt -c cookies.txt \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "identifier=prof@exemple.com" \
  --data-urlencode "password=MonMotDePasse123" \
  --data-urlencode "json=true" \
  https://xkorienta.com/xkorienta/backend/api/auth/callback/credentials

# 4. Vérifier la session
curl -s -b cookies.txt \
  https://xkorienta.com/xkorienta/backend/api/auth/session
```

---

## 11. Variables d'environnement requises

Le front doit définir :

```env
NEXT_PUBLIC_API_URL=https://xkorienta.com/xkorienta/backend
NEXTAUTH_URL=https://xkorienta.com
NEXTAUTH_SECRET=<même valeur que le backend>
```

> **NEXTAUTH_SECRET** : doit être **identique** entre le front et le back. Un secret différent rend les tokens JWT invalides.

---

## Notes d'intégration importantes

1. **Cookies obligatoires** : NextAuth utilise des cookies `HttpOnly`. Le navigateur les gère automatiquement mais un client HTTP (Axios, Fetch) doit être configuré avec `credentials: 'include'` (navigateur) ou gérer les cookies manuellement (Node.js / mobile).

2. **CSRF obligatoire** : Sans le token CSRF dans le body, le POST login retournera `403 Forbidden`.

3. **Register ≠ session** : Le register ne crée PAS de session. Il faut enchaîner avec le flux login (étapes 1→2→3).

4. **Rate limiting register** : 5 tentatives / IP / 15 minutes. En cas de `429`, attendre `retryAfter` secondes.

5. **Après `awaitingSchoolValidation: true`** : Le professeur peut se connecter mais ses droits sont limités jusqu'à validation de son école par un `SCHOOL_ADMIN`.

6. **Recherche d'écoles** : Préférer `/api/schools/search` (fuzzy) à `/api/schools/public` (exact) pour une meilleure UX dans les formulaires d'autocomplétion.

7. **Swagger interactif** : `https://xkorienta.com/xkorienta/backend/swagger`

---

*Dernière mise à jour : 2026-04-08*
