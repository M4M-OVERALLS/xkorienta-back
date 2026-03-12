# 📋 Catalogue des Codes d'Erreur - Authentification

## Légende

- 🔴 **CRITICAL** - Erreur critique
- ❌ **ERROR** - Erreur
- ⚠️ **WARNING** - Avertissement
- ℹ️ **INFO** - Information

---

## AUTH - Erreurs d'Authentification

### Validation (HTTP 400)

| Code | Sévérité | Message | Factory Method |
|------|----------|---------|----------------|
| `AUTH_001` | ❌ ERROR | Identifiant et mot de passe requis | `missingCredentials()` |
| `AUTH_011` | ❌ ERROR | Format d'email invalide | `invalidEmailFormat(email)` |
| `AUTH_012` | ❌ ERROR | Format de numéro de téléphone invalide | `invalidPhoneFormat(phone)` |
| `AUTH_013` | ❌ ERROR | Le mot de passe doit contenir au moins 8 caractères | `weakPassword()` |
| `AUTH_014` | ❌ ERROR | Code de vérification invalide ou expiré | `invalidVerificationCode()` |
| `AUTH_018` | ❌ ERROR | Token de réinitialisation invalide ou expiré | `invalidResetToken()` |
| `AUTH_005` | ❌ ERROR | Ce compte utilise une autre méthode de connexion | `differentAuthMethod()` |

### Authentication (HTTP 401)

| Code | Sévérité | Message | Factory Method |
|------|----------|---------|----------------|
| `AUTH_004` | ❌ ERROR | Mot de passe incorrect | `invalidPassword()` |
| `AUTH_006` | ❌ ERROR | Token d'authentification invalide ou expiré | `invalidToken()` |
| `AUTH_007` | ❌ ERROR | Session expirée, veuillez vous reconnecter | `sessionExpired()` |

### Authorization (HTTP 403)

| Code | Sévérité | Message | Factory Method |
|------|----------|---------|----------------|
| `AUTH_008` | ❌ ERROR | Accès refusé. Permissions insuffisantes | `accessDenied()` |
| `AUTH_016` | ❌ ERROR | Compte désactivé. Contactez l'administrateur | `accountDisabled()` |
| `AUTH_017` | ❌ ERROR | Email non vérifié. Veuillez vérifier votre email | `emailNotVerified()` |

### Not Found (HTTP 404)

| Code | Sévérité | Message | Factory Method |
|------|----------|---------|----------------|
| `AUTH_002` | ❌ ERROR | Aucun utilisateur trouvé avec cet email | `userNotFoundByEmail(email)` |
| `AUTH_003` | ❌ ERROR | Aucun compte trouvé avec ce numéro de téléphone | `userNotFoundByPhone(phone)` |

### Conflict (HTTP 409)

| Code | Sévérité | Message | Factory Method |
|------|----------|---------|----------------|
| `AUTH_009` | ❌ ERROR | Email déjà utilisé | `emailAlreadyExists(email)` |
| `AUTH_010` | ❌ ERROR | Numéro de téléphone déjà utilisé | `phoneAlreadyExists(phone)` |
| `AUTH_022` | ❌ ERROR | Compte Google déjà lié à un autre utilisateur | `googleAccountConflict(email)` |
| `AUTH_023` | ❌ ERROR | Compte GitHub déjà lié à un autre utilisateur | `githubAccountConflict(email)` |

### Rate Limiting (HTTP 429)

| Code | Sévérité | Message | Factory Method |
|------|----------|---------|----------------|
| `AUTH_015` | ⚠️ WARNING | Trop de tentatives de connexion. Veuillez réessayer plus tard | `rateLimitExceeded()` |

### Server Errors (HTTP 500)

| Code | Sévérité | Message | Factory Method |
|------|----------|---------|----------------|
| `AUTH_019` | ❌ ERROR | Erreur lors de l'authentification OAuth | `oauthError(provider)` |
| `AUTH_020` | ❌ ERROR | Provider OAuth non configuré | `oauthNotConfigured(provider)` |
| `AUTH_021` | 🔴 CRITICAL | Erreur de connexion à la base de données | `databaseError(operation)` |
| `AUTH_024` | ❌ ERROR | Impossible de créer le compte utilisateur | `userCreationFailed()` |
| `AUTH_025` | ❌ ERROR | Erreur lors de l'envoi de l'email de vérification | `emailSendingFailed()` |

---

## Exemples d'Utilisation

### Validation
```typescript
// Credentials manquants
throw AuthenticationError.missingCredentials()

// Email invalide
throw AuthenticationError.invalidEmailFormat("invalid-email")

// Mot de passe faible
throw AuthenticationError.weakPassword()
```

### Authentication
```typescript
// Mot de passe incorrect
throw AuthenticationError.invalidPassword({ userId: user.id })

// Token invalide
throw AuthenticationError.invalidToken()

// Session expirée
throw AuthenticationError.sessionExpired()
```

### Authorization
```typescript
// Accès refusé
throw AuthenticationError.accessDenied({ userId: user.id, requiredRole: 'admin' })

// Compte désactivé
throw AuthenticationError.accountDisabled()

// Email non vérifié
throw AuthenticationError.emailNotVerified()
```

### Not Found
```typescript
// Utilisateur non trouvé
throw AuthenticationError.userNotFoundByEmail(email)
throw AuthenticationError.userNotFoundByPhone(phone)
```

### Conflict
```typescript
// Email déjà existant
throw AuthenticationError.emailAlreadyExists(email)

// Conflit OAuth
throw AuthenticationError.googleAccountConflict(email, {
  existingProvider: 'github'
})
```

### Rate Limiting
```typescript
// Trop de tentatives
throw AuthenticationError.rateLimitExceeded({
  userId: user.id,
  attempts: 5,
  limit: 5
})
```

### Server Errors
```typescript
// Erreur OAuth
throw AuthenticationError.oauthError('google', {
  reason: 'Invalid state parameter'
})

// Erreur DB
throw AuthenticationError.databaseError('findUser', {
  collection: 'users',
  operation: 'findOne'
})

// Échec création utilisateur
throw AuthenticationError.userCreationFailed({ email })
```

---

## Catégories

- **VALIDATION** - Erreurs de validation des données entrantes
- **AUTHENTICATION** - Erreurs d'authentification (identité)
- **AUTHORIZATION** - Erreurs d'autorisation (permissions)
- **NOT_FOUND** - Ressources non trouvées
- **CONFLICT** - Conflits de données (duplicatas, etc.)
- **RATE_LIMIT** - Limites de taux dépassées
- **DATABASE** - Erreurs de base de données
- **EXTERNAL_SERVICE** - Erreurs de services externes (OAuth, email, etc.)
- **CONFIGURATION** - Erreurs de configuration

---

## Ajouter un Nouveau Code d'Erreur

### 1. Choisir le prochain numéro disponible
Actuellement: `AUTH_001` à `AUTH_025` (26 serait le prochain)

### 2. Déterminer les propriétés
- **httpStatus**: 400, 401, 403, 404, 409, 429, 500
- **severity**: INFO, WARNING, ERROR, CRITICAL
- **category**: Voir liste ci-dessus

### 3. Ajouter dans errorCatalog.json
```json
"AUTH_026": {
  "code": "AUTH_026",
  "message": "Votre message d'erreur",
  "httpStatus": 400,
  "severity": "ERROR",
  "category": "VALIDATION"
}
```

### 4. Ajouter le factory method
```typescript
static myNewError(context?: ErrorContext): AuthenticationError {
  return new AuthenticationError("AUTH_026", context)
}
```

### 5. Mettre à jour cette documentation

---

**Total**: 25 codes d'erreur d'authentification
