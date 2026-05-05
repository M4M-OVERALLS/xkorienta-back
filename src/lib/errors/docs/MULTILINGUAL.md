# 🌍 Système Multilingue - Guide Complet

Le système de gestion d'erreurs supporte maintenant plusieurs langues (FR, EN).

## Langues Supportées

- 🇫🇷 **Français (fr)** - Langue par défaut
- 🇬🇧 **Anglais (en)**

## Détection Automatique de la Langue

Le système détecte automatiquement la langue dans cet ordre de priorité :

### 1️⃣ Query Parameter (Priorité la plus haute)
```
GET /api/auth/login?lang=en
```

### 2️⃣ Header X-Language
```http
X-Language: en
```

### 3️⃣ Header Accept-Language
```http
Accept-Language: en-US,en;q=0.9,fr;q=0.8
```

### 4️⃣ Langue par défaut
Si aucune langue n'est spécifiée, le système utilise le français (fr).

## Utilisation dans les Routes API

### Méthode Recommandée (Avec détection automatique)

```typescript
import { AuthenticationError, withErrorHandler } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // La langue est automatiquement extraite de la requête
  return withErrorHandler(async (lang) => {
    const { email, password } = await req.json()

    // Validation
    if (!email || !password) {
      throw AuthenticationError.missingCredentials(lang)
    }

    // Recherche utilisateur
    const user = await User.findOne({ email })
    if (!user) {
      throw AuthenticationError.userNotFoundByEmail(email, lang)
    }

    // Vérification mot de passe
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw AuthenticationError.invalidPassword(lang, { userId: user.id })
    }

    return NextResponse.json({ success: true, user })
  }, req) // ⚠️ Important: passer 'req' en second paramètre
}
```

### Méthode Try-Catch Manuelle

```typescript
import { AuthenticationError, LanguageHelper, ErrorHandler } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    // Extraire la langue manuellement
    const lang = LanguageHelper.getLanguageFromRequest(req)

    const { email, password } = await req.json()

    if (!user) {
      throw AuthenticationError.userNotFoundByEmail(email, lang)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return ErrorHandler.handleError(error)
  }
}
```

## Exemples de Réponses

### En Français (par défaut ou lang=fr)

**Requête:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "wrong"
}
```

**Réponse:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Mot de passe incorrect",
    "severity": "ERROR",
    "category": "AUTHENTICATION",
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

### En Anglais (lang=en)

**Requête:**
```http
POST /api/auth/login?lang=en
Content-Type: application/json
X-Language: en

{
  "email": "test@example.com",
  "password": "wrong"
}
```

**Réponse:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Incorrect password",
    "severity": "ERROR",
    "category": "AUTHENTICATION",
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

## Tous les Messages Traduits

| Code | Français | English |
|------|----------|---------|
| `AUTH_001` | Identifiant et mot de passe requis | Identifier and password are required |
| `AUTH_002` | Aucun utilisateur trouvé avec cet email | No user found with this email |
| `AUTH_003` | Aucun compte trouvé avec ce numéro de téléphone | No account found with this phone number |
| `AUTH_004` | Mot de passe incorrect | Incorrect password |
| `AUTH_005` | Ce compte utilise une autre méthode de connexion | This account uses a different login method |
| `AUTH_006` | Token d'authentification invalide ou expiré | Invalid or expired authentication token |
| `AUTH_007` | Session expirée, veuillez vous reconnecter | Session expired, please log in again |
| `AUTH_008` | Accès refusé. Permissions insuffisantes | Access denied. Insufficient permissions |
| `AUTH_009` | Email déjà utilisé | Email already in use |
| `AUTH_010` | Numéro de téléphone déjà utilisé | Phone number already in use |
| `AUTH_011` | Format d'email invalide | Invalid email format |
| `AUTH_012` | Format de numéro de téléphone invalide | Invalid phone number format |
| `AUTH_013` | Le mot de passe doit contenir au moins 8 caractères | Password must contain at least 8 characters |
| `AUTH_014` | Code de vérification invalide ou expiré | Invalid or expired verification code |
| `AUTH_015` | Trop de tentatives de connexion | Too many login attempts |
| `AUTH_016` | Compte désactivé. Contactez l'administrateur | Account disabled. Contact the administrator |
| `AUTH_017` | Email non vérifié | Email not verified |
| `AUTH_018` | Token de réinitialisation invalide ou expiré | Invalid or expired reset token |
| `AUTH_019` | Erreur lors de l'authentification OAuth | Error during OAuth authentication |
| `AUTH_020` | Provider OAuth non configuré | OAuth provider not configured |
| `AUTH_021` | Erreur de connexion à la base de données | Database connection error |
| `AUTH_022` | Compte Google déjà lié à un autre utilisateur | Google account already linked to another user |
| `AUTH_023` | Compte GitHub déjà lié à un autre utilisateur | GitHub account already linked to another user |
| `AUTH_024` | Impossible de créer le compte utilisateur | Unable to create user account |
| `AUTH_025` | Erreur lors de l'envoi de l'email | Error sending verification email |

## Utilisation Avancée

### Extraire la Langue Manuellement

```typescript
import { LanguageHelper } from '@/lib/errors'

export async function GET(req: Request) {
  const lang = LanguageHelper.getLanguageFromRequest(req)
  console.log('Detected language:', lang) // 'fr' or 'en'
}
```

### Normaliser une Langue

```typescript
import { LanguageHelper } from '@/lib/errors'

const lang1 = LanguageHelper.normalize('EN') // => 'en'
const lang2 = LanguageHelper.normalize('fr-FR') // => 'fr'
const lang3 = LanguageHelper.normalize('es') // => 'fr' (fallback)
const lang4 = LanguageHelper.normalize(null) // => 'fr' (default)
```

### Obtenir les Langues Supportées

```typescript
import { LanguageHelper } from '@/lib/errors'

const languages = LanguageHelper.getSupportedLanguages()
// => ['fr', 'en']

const defaultLang = LanguageHelper.getDefaultLanguage()
// => 'fr'
```

## Compatibilité avec le Code Existant

### Sans Langue (Utilise FR par défaut)

```typescript
// Toujours valide, utilise français par défaut
throw AuthenticationError.invalidPassword()
```

### Avec Langue Explicite

```typescript
// Spécifie la langue explicitement
throw AuthenticationError.invalidPassword('en')
```

### Avec Contexte

```typescript
// Langue + contexte
throw AuthenticationError.invalidPassword('en', { userId: '123' })
```

## Test des Langues

### Avec cURL

```bash
# Français (par défaut)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'

# Anglais (query parameter)
curl -X POST "http://localhost:3001/api/auth/login?lang=en" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'

# Anglais (header)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Language: en" \
  -d '{"email":"test@test.com","password":"wrong"}'

# Anglais (Accept-Language)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept-Language: en-US,en;q=0.9" \
  -d '{"email":"test@test.com","password":"wrong"}'
```

### Avec fetch (Frontend)

```typescript
// Français
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})

// Anglais (query parameter)
const response = await fetch('/api/auth/login?lang=en', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})

// Anglais (header)
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Language': 'en'
  },
  body: JSON.stringify({ email, password })
})
```

## Ajouter une Nouvelle Langue

Pour ajouter une nouvelle langue (ex: Espagnol):

### 1. Modifier types.ts

```typescript
export type SupportedLanguage = "fr" | "en" | "es"
```

### 2. Modifier languageHelper.ts

```typescript
private static readonly DEFAULT_LANGUAGE: SupportedLanguage = "fr"
private static readonly SUPPORTED_LANGUAGES: SupportedLanguage[] = ["fr", "en", "es"]
```

### 3. Ajouter les Traductions dans errorCatalog.json

```json
{
  "AUTH": {
    "AUTH_001": {
      "code": "AUTH_001",
      "message": {
        "fr": "Identifiant et mot de passe requis",
        "en": "Identifier and password are required",
        "es": "Se requiere identificador y contraseña"
      },
      "httpStatus": 400,
      "severity": "ERROR",
      "category": "VALIDATION"
    }
  }
}
```

## Best Practices

### ✅ À FAIRE

- Toujours passer `req` à `withErrorHandler`
- Utiliser le paramètre `lang` fourni automatiquement
- Tester avec différentes langues
- Documenter les nouvelles erreurs dans les deux langues

### ❌ À ÉVITER

- Ne pas hardcoder la langue (`'fr'` ou `'en'`)
- Ne pas oublier de traduire les nouveaux messages
- Ne pas créer de messages d'erreur en dehors du catalogue

## Frontend Integration

### React Hook

```typescript
import { useState, useEffect } from 'react'

export function useLanguage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  useEffect(() => {
    // Détecter la langue du navigateur
    const browserLang = navigator.language.split('-')[0]
    setLang(browserLang === 'en' ? 'en' : 'fr')
  }, [])

  return lang
}

// Utilisation
function LoginPage() {
  const lang = useLanguage()

  const handleLogin = async () => {
    const response = await fetch(`/api/auth/login?lang=${lang}`, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  }
}
```

---

**Le système est maintenant prêt pour le multilinguisme ! 🎉**
