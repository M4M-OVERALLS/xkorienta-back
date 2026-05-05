# Guide de Démarrage Rapide - Gestion d'Erreurs

## Installation

Le système est déjà installé dans `/src/lib/errors/`. Aucune dépendance supplémentaire requise.

## Utilisation en 3 Étapes

### 1️⃣ Importer

```typescript
import { AuthenticationError, withErrorHandler } from '@/lib/errors'
```

### 2️⃣ Envelopper votre route

```typescript
export async function POST(req: Request) {
  return withErrorHandler(async () => {
    // Votre code ici
  })
}
```

### 3️⃣ Lever des erreurs

```typescript
// Au lieu de: throw new Error("...")
throw AuthenticationError.missingCredentials()
```

## Exemples Rapides

### Login
```typescript
export async function POST(req: Request) {
  return withErrorHandler(async () => {
    const { email, password } = await req.json()

    if (!email || !password) {
      throw AuthenticationError.missingCredentials()
    }

    const user = await User.findOne({ email })
    if (!user) {
      throw AuthenticationError.userNotFoundByEmail(email)
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw AuthenticationError.invalidPassword()
    }

    return NextResponse.json({ success: true, user })
  })
}
```

### Register
```typescript
export async function POST(req: Request) {
  return withErrorHandler(async () => {
    const { email, password } = await req.json()

    if (password.length < 8) {
      throw AuthenticationError.weakPassword()
    }

    const exists = await User.findOne({ email })
    if (exists) {
      throw AuthenticationError.emailAlreadyExists(email)
    }

    const user = await User.create({ email, password })
    return NextResponse.json({ success: true, user })
  })
}
```

## Liste des Erreurs Disponibles

### Validation (400)
- `AuthenticationError.missingCredentials()`
- `AuthenticationError.invalidEmailFormat(email)`
- `AuthenticationError.invalidPhoneFormat(phone)`
- `AuthenticationError.weakPassword()`
- `AuthenticationError.invalidVerificationCode()`
- `AuthenticationError.invalidResetToken()`

### Authentication (401)
- `AuthenticationError.invalidPassword()`
- `AuthenticationError.invalidToken()`
- `AuthenticationError.sessionExpired()`

### Authorization (403)
- `AuthenticationError.accessDenied()`
- `AuthenticationError.accountDisabled()`
- `AuthenticationError.emailNotVerified()`

### Not Found (404)
- `AuthenticationError.userNotFoundByEmail(email)`
- `AuthenticationError.userNotFoundByPhone(phone)`

### Conflict (409)
- `AuthenticationError.emailAlreadyExists(email)`
- `AuthenticationError.phoneAlreadyExists(phone)`
- `AuthenticationError.googleAccountConflict(email)`
- `AuthenticationError.githubAccountConflict(email)`

### Rate Limit (429)
- `AuthenticationError.rateLimitExceeded()`

### Server Error (500)
- `AuthenticationError.databaseError(operation)`
- `AuthenticationError.oauthError(provider)`
- `AuthenticationError.userCreationFailed()`
- `AuthenticationError.emailSendingFailed()`

## Ajouter du Contexte

Toutes les méthodes acceptent un paramètre `context` optionnel:

```typescript
throw AuthenticationError.invalidPassword({
  userId: user.id,
  attempt: attemptNumber,
  ip: req.headers.get('x-forwarded-for')
})
```

## Format de Réponse

Toutes les erreurs retournent:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Mot de passe incorrect",
    "severity": "ERROR",
    "category": "AUTHENTICATION",
    "timestamp": "2024-01-20T10:30:00.000Z",
    "context": { "userId": "123" }
  }
}
```

## Ajouter une Nouvelle Erreur

### 1. Ajouter dans errorCatalog.json

```json
"AUTH_026": {
  "code": "AUTH_026",
  "message": "Votre message",
  "httpStatus": 400,
  "severity": "ERROR",
  "category": "VALIDATION"
}
```

### 2. Ajouter le factory method dans AuthenticationError.ts

```typescript
static myNewError(context?: ErrorContext): AuthenticationError {
  return new AuthenticationError("AUTH_026", context)
}
```

### 3. Utiliser

```typescript
throw AuthenticationError.myNewError()
```

## Voir Aussi

- 📖 [README.md](./README.md) - Documentation complète
- 💡 [examples.ts](./examples.ts) - 10 exemples détaillés
- 📁 [errorCatalog.json](./errorCatalog.json) - Tous les codes d'erreur

## Support

Pour toute question, consultez la documentation complète ou contactez l'équipe.
