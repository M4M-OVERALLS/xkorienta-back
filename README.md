# Quizlock API - Backend

Backend API pour l'application Quizlock, construit avec Next.js.

## 🚀 Démarrage

### Prérequis

- Node.js 18+
- MongoDB

### Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Modifier .env avec vos vraies valeurs
```

### Configuration

Éditez le fichier `.env` avec vos configurations :

| Variable              | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `DATABASE_URL`        | URL de connexion MongoDB                                 |
| `NEXTAUTH_URL`        | URL du backend (http://localhost:3001)                   |
| `NEXTAUTH_SECRET`     | Secret pour JWT (générer avec `openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | URL de fallback (détection dynamique par défaut)         |

### Lancement

```bash
# Mode développement (port 3001)
npm run dev

# Mode production
npm run build
npm start
```

## 📚 API Endpoints

Tous les endpoints sont disponibles sous `/api/*` :

| Endpoint          | Description                 |
| ----------------- | --------------------------- |
| `/api/auth/*`     | Authentification (NextAuth) |
| `/api/classes/*`  | Gestion des classes         |
| `/api/exams/*`    | Gestion des examens         |
| `/api/attempts/*` | Tentatives d'examen         |
| `/api/students/*` | Profils étudiants           |
| `/api/teachers/*` | Profils enseignants         |
| `/api/schools/*`  | Établissements scolaires    |
| `/api/subjects/*` | Matières                    |
| `/api/syllabus/*` | Syllabuss                   |

## 🔒 CORS & Architecture multi-domaines

### Domaines supportés

Le backend accepte automatiquement les requêtes depuis :

- **Production** : `gradeforcast.com` et `xkorin.com` (incluant tous les sous-domaines)
- **Développement** : `localhost:3000`, `localhost:3001`, `localhost:3002`

### Détection dynamique du domaine

**Fonctionnement intelligent** : Le backend détecte automatiquement le domaine frontend depuis les headers HTTP (`Origin` ou `Referer`) de chaque requête.

**Avantages** :

- ✅ Un seul backend VPS pour plusieurs domaines
- ✅ Pas de configuration manuelle par domaine
- ✅ Les liens générés dans les emails pointent automatiquement vers le bon domaine
- ✅ Support de `gradeforcast.com` ET `xkorin.com` simultanément

**Comment ça marche** :

```
1. L'utilisateur visite gradeforcast.com
2. Le frontend envoie une requête API avec le header Origin: https://gradeforcast.com
3. Le backend détecte l'origine et génère des liens vers gradeforcast.com

1. Un autre utilisateur visite xkorin.com
2. Le frontend envoie une requête API avec le header Origin: https://xkorin.com
3. Le backend détecte l'origine et génère des liens vers xkorin.com
```

### Configuration

La variable `NEXT_PUBLIC_APP_URL` dans `.env` sert uniquement de **fallback** si l'origine ne peut pas être détectée :

```bash
# En développement
NEXT_PUBLIC_APP_URL=http://localhost:3000

# En production (fallback uniquement)
NEXT_PUBLIC_APP_URL=https://gradeforcast.com
```

**Note** : Tous les liens générés (emails d'invitation, réinitialisation de mot de passe, etc.) utilisent le domaine détecté dynamiquement, PAS cette variable.

## 📦 Structure

```
src/
├── app/
│   └── api/          # Routes API
├── lib/
│   ├── services/     # Services métier
│   ├── security/     # Sécurité (rate limiting, sanitization)
│   └── auth/         # Stratégies d'authentification
├── models/           # Modèles Mongoose
└── middleware.ts     # Middleware CORS
```

## 🔗 Communication avec le Frontend

Le frontend (`xkorienta-front`) communique avec ce backend via des requêtes HTTP.

**Base URL**: `http://localhost:3001` (développement)

---

_Backend API de Quizlock - Xkorienta_
