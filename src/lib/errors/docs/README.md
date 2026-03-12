# Système de Gestion d'Erreurs

Un système professionnel de gestion d'erreurs centralisé pour l'API QuizLock.

## Architecture

```
src/lib/errors/
├── errorCatalog.json         # Catalogue centralisé de toutes les erreurs
├── types.ts                  # Types TypeScript
├── BaseError.ts             # Classe de base pour toutes les erreurs
├── AuthenticationError.ts   # Erreurs d'authentification
├── errorHandler.ts          # Gestionnaire d'erreurs centralisé
├── index.ts                 # Point d'entrée pour les exports
└── README.md               # Documentation
```

## Principes de Conception

### 1. Centralisation
Toutes les erreurs sont définies dans `errorCatalog.json`, ce qui permet:
- Une gestion cohérente des messages d'erreur
- Une facilité de traduction
- Une documentation automatique des erreurs possibles
- Un audit facile des codes d'erreur

### 2. Typage Fort
Utilisation de TypeScript pour garantir la sécurité des types et l'autocomplétion.

### 3. Codes d'Erreur Structurés
Format: `DOMAIN_XXX` (ex: `AUTH_001`, `AUTH_002`)
- **DOMAIN**: Domaine fonctionnel (AUTH, USER, QUIZ, etc.)
- **XXX**: Numéro séquentiel sur 3 chiffres

### 4. Catégorisation
Chaque erreur appartient à une catégorie:
- `VALIDATION`: Erreurs de validation des données
- `AUTHENTICATION`: Erreurs d'authentification
- `AUTHORIZATION`: Erreurs de permissions
- `NOT_FOUND`: Ressource non trouvée
- `CONFLICT`: Conflit (ex: email déjà existant)
- `RATE_LIMIT`: Limite de taux dépassée
- `DATABASE`: Erreurs base de données
- `EXTERNAL_SERVICE`: Erreurs de services externes
- `CONFIGURATION`: Erreurs de configuration
- `UNKNOWN`: Erreur non catégorisée

### 5. Niveaux de Sévérité
- `INFO`: Information
- `WARNING`: Avertissement
- `ERROR`: Erreur
- `CRITICAL`: Erreur critique nécessitant une attention immédiate

## Utilisation

### 1. Dans les Routes API

#### Méthode Simple
```typescript
import { AuthenticationError, withErrorHandler } from '@/lib/errors'

export async function POST(req: Request) {
  return withErrorHandler(async () => {
    const { email, password } = await req.json()

    // Validation
    if (!email || !password) {
      throw AuthenticationError.missingCredentials()
    }

    // Recherche utilisateur
    const user = await User.findOne({ email })
    if (!user) {
      throw AuthenticationError.userNotFoundByEmail(email)
    }

    // Vérification mot de passe
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw AuthenticationError.invalidPassword({ userId: user.id })
    }

    return NextResponse.json({ success: true, user })
  })
}
```

#### Méthode Try-Catch
```typescript
import { AuthenticationError, ErrorHandler } from '@/lib/errors'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      throw AuthenticationError.missingCredentials()
    }

    // Votre logique...

    return NextResponse.json({ success: true })
  } catch (error) {
    return ErrorHandler.handleError(error)
  }
}
```

### 2. Factory Methods

Les factory methods offrent une API ergonomique et type-safe:

```typescript
// Sans contexte
throw AuthenticationError.missingCredentials()

// Avec contexte
throw AuthenticationError.userNotFoundByEmail(email, {
  requestId: 'abc123',
  path: '/api/auth/login'
})

// Avec plusieurs propriétés de contexte
throw AuthenticationError.invalidPassword({
  userId: user.id,
  attempt: attemptNumber,
  ip: req.ip
})
```

### 3. Logging Automatique

Les erreurs sont automatiquement loggées avec des émojis pour faciliter le débogage:

```
🔴 CRITICAL ERROR: { code: 'AUTH_021', message: '...' }
❌ ERROR: { code: 'AUTH_004', message: '...' }
⚠️  WARNING: { code: 'AUTH_015', message: '...' }
ℹ️  INFO: { code: 'AUTH_XXX', message: '...' }
```

### 4. Réponses API Standardisées

Toutes les erreurs retournent un format cohérent:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Mot de passe incorrect",
    "severity": "ERROR",
    "category": "AUTHENTICATION",
    "timestamp": "2024-01-20T10:30:00.000Z",
    "context": {
      "userId": "123",
      "identifier": "user@example.com"
    },
    "stack": "Error: ..." // Uniquement en développement
  }
}
```

## Ajouter une Nouvelle Erreur

### 1. Ajouter dans errorCatalog.json

```json
{
  "AUTH": {
    "AUTH_026": {
      "code": "AUTH_026",
      "message": "Votre nouveau message d'erreur",
      "httpStatus": 400,
      "severity": "ERROR",
      "category": "VALIDATION"
    }
  }
}
```

### 2. Ajouter un Factory Method

Dans `AuthenticationError.ts`:

```typescript
static myNewError(context?: ErrorContext): AuthenticationError {
  return new AuthenticationError("AUTH_026", context)
}
```

### 3. Utiliser

```typescript
throw AuthenticationError.myNewError({ userId: '123' })
```

## Créer une Nouvelle Catégorie d'Erreurs

Pour d'autres domaines (QUIZ, USER, SCHOOL, etc.):

### 1. Ajouter dans errorCatalog.json

```json
{
  "QUIZ": {
    "QUIZ_001": {
      "code": "QUIZ_001",
      "message": "Quiz non trouvé",
      "httpStatus": 404,
      "severity": "ERROR",
      "category": "NOT_FOUND"
    }
  }
}
```

### 2. Créer la Classe d'Erreur

Créer `src/lib/errors/QuizError.ts`:

```typescript
import { BaseApplicationError } from "./BaseError"
import { ErrorContext } from "./types"
import errorCatalog from "./errorCatalog.json"

export class QuizError extends BaseApplicationError {
  constructor(errorCode: keyof typeof errorCatalog.QUIZ, context?: ErrorContext) {
    const errorDef = errorCatalog.QUIZ[errorCode]

    if (!errorDef) {
      super(
        "QUIZ_UNKNOWN",
        "Erreur de quiz inconnue",
        500,
        "ERROR",
        "UNKNOWN",
        context
      )
    } else {
      super(
        errorDef.code,
        errorDef.message,
        errorDef.httpStatus,
        errorDef.severity,
        errorDef.category,
        context
      )
    }

    Object.setPrototypeOf(this, QuizError.prototype)
  }

  static notFound(quizId: string, context?: ErrorContext): QuizError {
    return new QuizError("QUIZ_001", { ...context, quizId })
  }
}
```

### 3. Exporter

Dans `src/lib/errors/index.ts`:

```typescript
export * from "./QuizError"
```

## Best Practices

### ✅ DO

- Utilisez les factory methods pour créer des erreurs
- Ajoutez du contexte pertinent aux erreurs
- Loggez les erreurs critiques
- Utilisez des messages clairs et en français
- Documentez les nouveaux codes d'erreur

### ❌ DON'T

- N'utilisez pas `throw new Error()` directement
- N'exposez pas d'informations sensibles dans les messages
- N'utilisez pas le même code pour des erreurs différentes
- Ne modifiez pas les codes d'erreur existants (ajoutez-en de nouveaux)

## Intégration avec des Services Externes

Pour l'intégration avec Sentry, DataDog, etc., modifiez `ErrorHandler.logProgrammingError()`:

```typescript
static logProgrammingError(error: Error) {
  console.error("🔴 PROGRAMMING ERROR:", error)

  if (process.env.NODE_ENV === "production") {
    // Sentry
    Sentry.captureException(error)

    // DataDog
    // datadogLogs.error(error.message, { error })

    // CloudWatch
    // cloudwatch.putMetricData(...)
  }
}
```

## Tests

Exemple de test d'erreur:

```typescript
import { AuthenticationError } from '@/lib/errors'

describe('AuthenticationError', () => {
  it('should create error with correct properties', () => {
    const error = AuthenticationError.missingCredentials()

    expect(error.code).toBe('AUTH_001')
    expect(error.httpStatus).toBe(400)
    expect(error.severity).toBe('ERROR')
    expect(error.category).toBe('VALIDATION')
  })

  it('should include context', () => {
    const context = { userId: '123' }
    const error = AuthenticationError.invalidPassword(context)

    expect(error.context).toEqual(context)
  })
})
```

## Migration du Code Existant

Pour migrer du code existant:

### Avant
```typescript
if (!user) {
  throw new Error("Utilisateur non trouvé")
}
```

### Après
```typescript
if (!user) {
  throw AuthenticationError.userNotFoundByEmail(email)
}
```

## Support

Pour toute question ou amélioration, contactez l'équipe de développement.
