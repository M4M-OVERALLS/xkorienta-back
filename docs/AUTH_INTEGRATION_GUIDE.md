# Guide d'intégration — Authentification Xkorienta API

> **Base URL production** : `https://xkorienta.com/xkorienta/backend`  
> **Base URL développement** : `http://localhost:3001`  
> **Format** : JSON  
> **Auth** : NextAuth.js (session JWT + cookies)

---

## Table des matières

1. [Vue d'ensemble du flux](#1-vue-densemble-du-flux)
2. [Étape 1 — Obtenir le token CSRF](#2-étape-1--obtenir-le-token-csrf)
3. [Étape 2 — Login (Professeur)](#3-étape-2--login-professeur)
4. [Étape 3 — Récupérer la session](#4-étape-3--récupérer-la-session)
5. [Étape 4 — Register (Professeur)](#5-étape-4--register-professeur)
6. [Codes d'erreur](#6-codes-derreur)
7. [Exemples complets avec cURL](#7-exemples-complets-avec-curl)
8. [Variables d'environnement requises](#8-variables-denvironnement-requises)

---

## 1. Vue d'ensemble du flux

### Flux Login

```
Client                          API (NextAuth)
  |                                  |
  |── GET /api/auth/csrf ──────────> |
  |<─ { csrfToken: "xxx" } ──────── |
  |                                  |
  |── POST /api/auth/callback/credentials ──> |
  |   { csrfToken, identifier, password }     |
  |<─ 302 redirect + Set-Cookie ──── |  (session JWT dans cookie)
  |                                  |
  |── GET /api/auth/session ───────> |
  |<─ { user: { id, name, role } } ─ |
```

### Flux Register

```
Client                          API
  |                                  |
  |── POST /api/register/v2 ───────> |
  |   { name, email, password,       |
  |     role: "TEACHER", ... }       |
  |<─ 200 { success, user } ──────── |
  |                                  |
  |  (auto-login : suivre flux Login)|
```

---

## 2. Étape 1 — Obtenir le token CSRF

Le token CSRF est **obligatoire** pour toutes les requêtes POST vers NextAuth.

### Requête

```http
GET /api/auth/csrf
```

| Propriété | Valeur |
|-----------|--------|
| Méthode | `GET` |
| Auth requise | Non |
| Headers | `Content-Type: application/json` |

### Réponse

```json
{
  "csrfToken": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
}
```

### Exemple

```bash
curl -c cookies.txt \
  https://xkorienta.com/xkorienta/backend/api/auth/csrf
```

> **Important** : Sauvegarder le cookie retourné (`-c cookies.txt`). NextAuth valide le CSRF via ce cookie.

---

## 3. Étape 2 — Login (Professeur)

### Requête

```http
POST /api/auth/callback/credentials
Content-Type: application/x-www-form-urlencoded
```

| Propriété | Valeur |
|-----------|--------|
| Méthode | `POST` |
| Content-Type | `application/x-www-form-urlencoded` |
| Auth requise | Non |

### Body (form-urlencoded)

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `csrfToken` | string | ✅ | Token obtenu à l'étape 1 |
| `identifier` | string | ✅ | Email **ou** numéro de téléphone |
| `password` | string | ✅ | Mot de passe (min 6 caractères) |
| `callbackUrl` | string | Non | URL de redirection après login (défaut: `/dashboard`) |
| `json` | string | Non | Mettre `"true"` pour recevoir JSON au lieu d'un redirect |

### Exemples de payload

**Login avec email :**
```
csrfToken=a1b2c3d4...&identifier=prof@exemple.com&password=MonMotDePasse123&json=true
```

**Login avec téléphone :**
```
csrfToken=a1b2c3d4...&identifier=%2B237691234567&password=MonMotDePasse123&json=true
```

> Le numéro de téléphone doit être encodé URL : `+237...` → `%2B237...`

### Réponse succès (avec `json=true`)

```json
{
  "url": "https://xkorienta.com/dashboard"
}
```

Les cookies de session sont automatiquement définis dans les headers de réponse :
```
Set-Cookie: next-auth.session-token=...; HttpOnly; Secure; SameSite=Lax
Set-Cookie: next-auth.csrf-token=...; HttpOnly; Secure; SameSite=Lax
```

### Réponse erreur

```json
{
  "url": "https://xkorienta.com/login?error=CredentialsSignin"
}
```

---

## 4. Étape 3 — Récupérer la session

Après login, vérifier que la session est active et récupérer les données utilisateur.

### Requête

```http
GET /api/auth/session
Cookie: next-auth.session-token=...
```

### Réponse — Professeur connecté

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
| `user.role` | string | `TEACHER`, `STUDENT`, `SCHOOL_ADMIN` |
| `user.schools` | string[] | IDs des écoles associées |
| `expires` | ISO date | Date d'expiration de la session (30 jours) |

### Réponse — Non connecté

```json
{}
```

---

## 5. Étape 4 — Register (Professeur)

### Requête

```http
POST /api/register/v2
Content-Type: application/json
```

### Body — Cas 1 : Professeur avec école existante

```json
{
  "name": "Jean Dupont",
  "email": "prof@exemple.com",
  "password": "MonMotDePasse123",
  "role": "TEACHER",
  "schoolId": "507f191e810c19729de860ea"
}
```

### Body — Cas 2 : Professeur déclarant une école non répertoriée

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

### Body — Cas 3 : Professeur en mode "Classe Libre" (sans école)

```json
{
  "name": "Jean Dupont",
  "email": "prof@exemple.com",
  "password": "MonMotDePasse123",
  "role": "TEACHER",
  "skipSchool": true
}
```

### Body — Cas 4 : Professeur avec téléphone (sans email)

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
| `email` | string | ✅ (si pas de phone) | Format email valide |
| `phone` | string | ✅ (si pas d'email) | 8–15 chiffres, format `+237...` |
| `password` | string | ✅ | 6–128 caractères |
| `role` | string | ✅ | `"TEACHER"` \| `"STUDENT"` \| `"SCHOOL_ADMIN"` |
| `schoolId` | string | Non | ID MongoDB d'une école existante |
| `declaredSchoolData.name` | string | Non | 2–200 caractères, pas de HTML/injection |
| `declaredSchoolData.city` | string | Non | max 100 caractères |
| `declaredSchoolData.country` | string | Non | max 100 caractères |
| `declaredSchoolData.type` | string | Non | `"PRIMARY"` \| `"SECONDARY"` \| `"HIGHER_ED"` |
| `skipSchool` | boolean | Non | `true` pour ignorer l'association école |

> **Règle** : `email` OU `phone` est obligatoire. Les deux peuvent être fournis.

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

### Réponse succès — Avec école créée

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

## 6. Codes d'erreur

### Register (`POST /api/register/v2`)

| Code HTTP | Message | Cause |
|-----------|---------|-------|
| `400` | `"Un compte existe déjà avec cet email"` | Email déjà utilisé |
| `400` | `"Ce numéro de téléphone est déjà utilisé"` | Téléphone déjà utilisé |
| `400` | `"Email ou numéro de téléphone requis"` | Ni email ni phone fourni |
| `400` | `"Invalid role"` | Role non reconnu |
| `400` | `"Caractères invalides détectés"` | Injection détectée dans schoolData |
| `429` | `"Too many requests"` | Rate limit atteint (max 5 tentatives / 15 min) |
| `500` | `"Erreur interne du serveur"` | Erreur serveur |

### Login (`POST /api/auth/callback/credentials`)

| Erreur dans l'URL | Cause |
|-------------------|-------|
| `?error=CredentialsSignin` | Identifiants incorrects |
| `?error=Configuration` | Erreur de config NextAuth |

---

## 7. Exemples complets avec cURL

### Flux complet Login

```bash
# 1. Récupérer le CSRF token
CSRF=$(curl -s -c cookies.txt \
  https://xkorienta.com/xkorienta/backend/api/auth/csrf \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")

echo "CSRF Token: $CSRF"

# 2. Se connecter
curl -s -b cookies.txt -c cookies.txt \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "identifier=prof@exemple.com" \
  --data-urlencode "password=MonMotDePasse123" \
  --data-urlencode "json=true" \
  https://xkorienta.com/xkorienta/backend/api/auth/callback/credentials

# 3. Vérifier la session
curl -s -b cookies.txt \
  https://xkorienta.com/xkorienta/backend/api/auth/session
```

### Register + Auto-login

```bash
# 1. Créer le compte
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jean Dupont",
    "email": "prof@exemple.com",
    "password": "MonMotDePasse123",
    "role": "TEACHER",
    "skipSchool": true
  }' \
  https://xkorienta.com/xkorienta/backend/api/register/v2

# 2. Puis suivre le flux Login (étapes 1→2→3 ci-dessus)
```

---

## 8. Variables d'environnement requises

Le front doit définir :

```env
NEXT_PUBLIC_API_URL=https://xkorienta.com/xkorienta/backend
NEXTAUTH_URL=https://xkorienta.com
NEXTAUTH_SECRET=<même valeur que le backend>
```

> **NEXTAUTH_SECRET** : doit être **identique** entre le front et le back pour valider les tokens JWT.

---

## Notes d'intégration importantes

1. **Cookies** : NextAuth utilise des cookies `HttpOnly`. Les SPA qui ne peuvent pas gérer les cookies doivent utiliser un serveur proxy intermédiaire.

2. **CSRF obligatoire** : Sans le token CSRF dans le body, le POST login retournera `403`.

3. **Après register** : Le register ne crée pas de session. Il faut enchaîner avec le flux login.

4. **Rate limiting** : L'endpoint register est limité à **5 tentatives par IP / 15 minutes**.

5. **Role TEACHER** : Un professeur peut s'inscrire sans école (`skipSchool: true`) et rejoindre une école plus tard via `POST /api/schools/apply`.

---

*Dernière mise à jour : 2026-04-08*
