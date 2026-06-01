# CLAUDE.md — xkorienta-api (Next.js 16 Backend)

Ce fichier est la source de verite pour le developpement sur ce projet.

---

## Stack technique

- **Framework** : Next.js 16.1.3 (App Router, React 19, standalone output)
- **Langage** : TypeScript 5 (strict mode)
- **Base de donnees** : MongoDB via Mongoose 9.1.4
- **Auth** : next-auth 4.24.13 (JWT, 2h maxAge, strategy pattern)
- **Monitoring** : @sentry/nextjs 10.55.0
- **Validation** : Zod 4 + validator.js + mongoose-sanitize
- **Tests** : Jest 29 + supertest + mongodb-memory-server
- **Securite** : Helmet, express-rate-limit, bcryptjs, sanitize-html

---

## Architecture en couches

```
Route (src/app/api/) → Controller (src/lib/controllers/) → Service (src/lib/services/) → Repository (src/lib/repositories/)
```

### Regles strictes

- **Route** : authentification (getServerSession), validation basique des params, delegation au controller
- **Controller** : traduction HTTP <-> metier, formatage des reponses, AUCUNE logique metier
- **Service** : logique metier pure, throw d'erreurs typees, AUCUN acces BD direct
- **Repository** : acces aux donnees Mongoose, requetes optimisees, lean() pour les lectures

---

## Gestion des erreurs

### Pattern obligatoire dans les routes API

```typescript
import * as Sentry from '@sentry/nextjs'

} catch (error: any) {
    Sentry.captureException(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
}
```

### Regles

- **JAMAIS de `console.error`** dans les catch des routes API — utiliser `Sentry.captureException(error)`
- **JAMAIS de `console.log`** de debug en production
- Utiliser `BaseApplicationError` (src/lib/errors/core/BaseError.ts) pour les erreurs metier typees
- Utiliser `AuthenticationError` pour les erreurs d'authentification (25 codes disponibles)
- Les erreurs metier definissent : code, httpStatus, severity, category, language (fr/en)
- En production, ne jamais exposer les stack traces au client

### Systeme d'erreurs centralise

- Catalogue : `src/lib/errors/config/errorCatalog.json` (FR + EN)
- Base : `src/lib/errors/core/BaseError.ts` — etendre cette classe
- Handler : `src/lib/errors/core/errorHandler.ts` — `ErrorHandler.handleError(error)` ou `withErrorHandler(handler, req)`

---

## Authentification et autorisation

### Pattern dans les routes

```typescript
const session = await getServerSession(authOptions)
if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
}
```

### Configuration

- Sessions JWT (pas de sessions BD) — `src/lib/auth.ts`
- Duree max : 2 heures (exigence securite A-13)
- Refresh : toutes les 5 minutes d'activite
- Cookies : HttpOnly, Secure en prod, SameSite=lax
- Strategies extensibles : `src/lib/auth/strategies/` (Credentials, Google, GitHub)

### Controle d'acces

- Utiliser `withRole` (src/lib/middleware/withRole.ts) pour les routes protegees par role
- Roles disponibles dans `src/models/enums.ts` (UserRole)
- Verifier l'ownership des ressources (pas seulement le role)

---

## Securite

### Obligatoire

- Valider TOUTES les entrees avec Zod et/ou validator.js
- Assainir les entrees HTML avec sanitize-html
- Utiliser mongoose-sanitize contre les injections NoSQL
- Requetes parametrees uniquement — ZERO interpolation
- Hachage des mots de passe : bcryptjs (jamais MD5/SHA1)
- CORS strict whitelist dans `src/middleware.ts` — pas de wildcard

### Rate limiting

- Appliquer express-rate-limit sur les endpoints sensibles (login, register, reset password)

### Headers

- Helmet.js configure — ne pas desactiver les headers de securite

---

## Performance

### Requetes MongoDB

- **INTERDIT** : `SELECT *` equivalent — toujours specifier les champs avec `.select()` ou projection
- **INTERDIT** : requetes N+1 — utiliser `.populate()` ou requetes batch
- **INTERDIT** : boucles avec `await` sur des requetes individuelles — utiliser `Promise.all()` ou operations batch
- Toujours utiliser `.lean()` pour les lectures sans modification
- Indexer les champs utilises dans les filtres, tris et jointures
- Paginer toutes les listes (jamais de requete sans limit)

### Algorithmique

- Complexite toujours < O(n^2) — utiliser Map/Set pour les lookups
- Preferer les operations batch aux boucles unitaires

---

## Conventions de code

### Nommage

- **Fichiers** : PascalCase pour les classes (`ClassTeacherService.ts`), kebab-case pour les routes
- **Classes** : PascalCase (`ExamController`, `UserRepository`)
- **Methodes/variables** : camelCase
- **Constantes** : UPPER_SNAKE_CASE
- **Enums** : PascalCase avec valeurs UPPER_SNAKE_CASE

### Structure des fichiers

```
src/
  app/api/          — Routes API (App Router)
  lib/
    controllers/    — Controllers HTTP
    services/       — Logique metier
    repositories/   — Acces aux donnees
    errors/         — Systeme d'erreurs centralise
    auth/           — Strategies d'authentification
    middleware/     — Middleware custom (withRole, withAccessControl)
  models/           — Schemas Mongoose (72 modeles)
  types/            — Definitions TypeScript
__tests__/
  unit/             — Tests unitaires des services
  integration/      — Tests d'integration des endpoints
```

### TypeScript

- Mode strict active — pas de `any` sauf cas justifie
- Typer toutes les fonctions publiques (parametres + retour)
- Utiliser les interfaces/types du projet (`src/types/`)

---

## Tests

### Configuration

- Framework : Jest 29 avec ts-jest
- Couverture minimale : **80%** (branches, fonctions, lignes)
- Timeout : 10 secondes
- BD de test : mongodb-memory-server

### Commandes

```bash
npm test                          # Tous les tests
npm test -- --coverage            # Avec rapport de couverture
npm test -- __tests__/unit        # Tests unitaires uniquement
npm test -- __tests__/integration # Tests d'integration uniquement
```

### Convention

```typescript
describe('[FeatureName]', () => {
  describe('[methodName]', () => {
    it('should [comportement] when [condition]', async () => {
      // Arrange
      // Act
      // Assert
    })
  })
})
```

### Categories de tests

1. **Use cases** : parcours nominaux et alternatifs
2. **Cas limites** : null, vide, valeurs extremes
3. **Erreurs** : codes HTTP (400, 401, 403, 404, 409, 500)
4. **Performance** : temps d'execution sur volumes importants
5. **Securite** : injection, payloads malveillants

---

## API Routes — Pattern standard

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import * as Sentry from '@sentry/nextjs'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/mongodb'

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
        }

        await connectDB()
        // ... delegation au controller/service

        return NextResponse.json({ success: true, data: result })
    } catch (error: any) {
        Sentry.captureException(error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
```

### Reponses standard

- Succes : `{ success: true, data: ... }` avec status 200/201
- Erreur client : `{ error: "message" }` avec status 400/401/403/404/409
- Erreur serveur : `{ error: "message" }` avec status 500

---

## Monitoring — Sentry

### Configuration

- Serveur : `sentry.server.config.ts`
- Client : `src/instrumentation-client.ts` (replay 5%, traces 10%)
- Edge : `sentry.edge.config.ts`
- Tunnel : `/monitoring` (contourne les ad-blockers)
- Source maps : upload automatique en CI

### Utilisation

- Importer : `import * as Sentry from '@sentry/nextjs'`
- Capturer les exceptions : `Sentry.captureException(error)`
- Contexte additionnel : `Sentry.setContext('key', { ... })`

---

## Design Patterns utilises

| Pattern | Utilisation | Exemple |
|---------|-------------|---------|
| Strategy | Auth providers | `src/lib/auth/strategies/` |
| Factory | Construction d'objets complexes | ExamBuilder, ProfileFactory |
| Repository | Abstraction acces donnees | StudentRepository, RegistrationRepository |
| Observer | Events post-action | EmailNotificationObserver, BadgeAwardObserver |
| Builder | Construction incrementale | ExamBuilder |
| Decorator | Comportements additionnels | ExamDecorator |
| HOF | Middleware fonctionnel | withRole, withErrorHandler |

---

## Commandes projet

```bash
npm run dev                    # Serveur dev (port 3001)
npm run build                  # Build production
npm run start                  # Serveur production (port 3001)
npm run lint                   # ESLint
npm test                       # Tests Jest
npm run seed:plans             # Seeder les plans
npm run admin:create           # Creer un admin plateforme
```

---

## Anti-patterns interdits

```
INTERDIT                                      CORRECT
-------------------------------------------   -------------------------------------------
console.error dans les catch API              Sentry.captureException(error)
console.log de debug                          Supprimer ou utiliser Sentry
SELECT * (Model.find() sans select)           Model.find().select('field1 field2').lean()
Boucle N+1 (for + await db.find)              Requete batch ou populate
any sans justification                        Type explicite ou unknown
Logique metier dans le controller             Deleguer au service
Acces BD dans le service                      Deleguer au repository
Mot de passe en MD5/SHA1                      bcryptjs avec salt rounds >= 12
Interpolation dans les requetes               Requetes parametrees / Mongoose API
Stack trace exposee en production             Message generique + Sentry
Requete sans pagination                       Toujours limit + skip/cursor
```

---

## Deploiement

- Output : standalone (Docker-ready)
- Asset prefix en prod : `/xkorienta/backend`
- React Compiler active
- Variables d'environnement : voir `.env.example`
- Sentry source maps uploades en CI

---

*Ce fichier est la reference pour tout developpement sur xkorienta-api.*
