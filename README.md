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

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion MongoDB |
| `NEXTAUTH_URL` | URL du backend (http://localhost:3001) |
| `NEXTAUTH_SECRET` | Secret pour JWT (générer avec `openssl rand -base64 32`) |
| `FRONTEND_URL` | URL du frontend (http://localhost:3000) |

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

| Endpoint | Description |
|----------|-------------|
| `/api/auth/*` | Authentification (NextAuth) |
| `/api/classes/*` | Gestion des classes |
| `/api/exams/*` | Gestion des examens |
| `/api/attempts/*` | Tentatives d'examen |
| `/api/students/*` | Profils étudiants |
| `/api/teachers/*` | Profils enseignants |
| `/api/schools/*` | Établissements scolaires |
| `/api/subjects/*` | Matières |
| `/api/syllabus/*` | Programmes |

## 🔒 CORS

Le backend est configuré pour accepter les requêtes depuis le frontend sur `http://localhost:3000`.

Pour ajouter d'autres origines, modifiez `src/middleware.ts`.

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

*Backend API de Quizlock - Xkorin School*
