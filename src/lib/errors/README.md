# 📁 Structure du Système de Gestion d'Erreurs

Organisation propre et modulaire du système de gestion d'erreurs multilingue.

## 📂 Structure des Dossiers

```
src/lib/errors/
├── core/                       # 🔧 Code principal (classes, types, handlers)
│   ├── BaseError.ts           # Classe de base pour toutes les erreurs
│   ├── AuthenticationError.ts # Erreurs d'authentification
│   ├── errorHandler.ts        # Gestionnaire d'erreurs + withErrorHandler
│   ├── languageHelper.ts      # Détection de langue
│   ├── types.ts              # Types TypeScript
│   └── index.ts              # Exports du core
│
├── config/                     # ⚙️ Configuration
│   └── errorCatalog.json      # Catalogue des erreurs (FR + EN)
│
├── docs/                       # 📚 Documentation
│   ├── README.md              # Guide complet du système
│   ├── QUICK_START.md         # Guide de démarrage rapide
│   ├── MULTILINGUAL.md        # Guide du système multilingue
│   ├── ERROR_CODES.md         # Liste de tous les codes d'erreur
│   ├── CHANGELOG.md           # Historique des changements
│   └── _examples.ts.txt       # 10 exemples d'utilisation
│
├── examples/                   # 💡 Exemples de code
│   └── EXAMPLE_ROUTE.ts       # 6 exemples de routes API
│
├── index.ts                    # 🚪 Point d'entrée principal
└── README.md                   # 📖 Ce fichier

src/lib/middleware/
├── languageMiddleware.ts       # Middleware de détection de langue
└── index.ts                    # Exports des middlewares
```

## 🚀 Utilisation

### Import Principal

```typescript
import { AuthenticationError, withErrorHandler } from '@/lib/errors'
```

### Import du Middleware

```typescript
import { languageMiddleware } from '@/lib/middleware'
```

## 📖 Documentation

### Pour Démarrer
👉 **[docs/QUICK_START.md](./docs/QUICK_START.md)** - Guide de démarrage rapide (5 min)

### Guides Spécialisés
- 🌍 **[docs/MULTILINGUAL.md](./docs/MULTILINGUAL.md)** - Système multilingue complet
- 📋 **[docs/ERROR_CODES.md](./docs/ERROR_CODES.md)** - Liste de tous les codes
- 📚 **[docs/README.md](./docs/README.md)** - Documentation complète

### Exemples
- 💡 **[examples/EXAMPLE_ROUTE.ts](./examples/EXAMPLE_ROUTE.ts)** - 6 exemples de routes API
- 📝 **[docs/_examples.ts.txt](./docs/_examples.ts.txt)** - 10 exemples détaillés

### Historique
- 📅 **[docs/CHANGELOG.md](./docs/CHANGELOG.md)** - Changelog du projet

## 🔧 Core Components

### BaseError.ts
Classe de base pour toutes les erreurs avec :
- Support multilingue
- Logging automatique
- Contexte enrichi
- Sérialisation JSON

### AuthenticationError.ts
25 erreurs d'authentification avec factory methods :
- `missingCredentials()`
- `userNotFoundByEmail()`
- `invalidPassword()`
- etc.

### errorHandler.ts
Gestionnaire d'erreurs avec :
- `withErrorHandler()` - Wrapper pour routes API
- `ErrorHandler.handleError()` - Gestion manuelle
- Détection automatique de langue

### languageHelper.ts
Helper de détection de langue :
- Extraction depuis query params, headers
- Normalisation
- Fallback automatique

### types.ts
Types TypeScript :
- `SupportedLanguage`
- `ErrorSeverity`
- `ErrorCategory`
- `ErrorDefinition`
- etc.

## ⚙️ Configuration

### errorCatalog.json
Catalogue centralisé de toutes les erreurs avec traductions FR/EN :

```json
{
  "AUTH": {
    "AUTH_001": {
      "code": "AUTH_001",
      "message": {
        "fr": "Identifiant et mot de passe requis",
        "en": "Identifier and password are required"
      },
      "httpStatus": 400,
      "severity": "ERROR",
      "category": "VALIDATION"
    }
  }
}
```

## 🛠️ Middleware

### languageMiddleware.ts
Middleware Next.js pour :
- Détecter automatiquement la langue
- Injecter le header `X-Detected-Language`
- Rendre la langue accessible dans toutes les routes

**Setup dans `src/middleware.ts`** :
```typescript
import { languageMiddleware, LANGUAGE_MIDDLEWARE_MATCHER } from '@/lib/middleware'

export function middleware(request: NextRequest) {
  return languageMiddleware(request)
}

export const config = {
  matcher: LANGUAGE_MIDDLEWARE_MATCHER
}
```

## 📊 Statistiques

- **Fichiers Core** : 5
- **Erreurs Cataloguées** : 25 (AUTH)
- **Langues Supportées** : 2 (FR, EN)
- **Lignes de Documentation** : ~1500
- **Exemples** : 16 (6 routes + 10 snippets)

## 🔗 Liens Utiles

- [Guide de Démarrage Rapide](./docs/QUICK_START.md)
- [Guide Multilingue](./docs/MULTILINGUAL.md)
- [Liste des Codes d'Erreur](./docs/ERROR_CODES.md)
- [Documentation Complète](./docs/README.md)
- [Exemples de Routes](./examples/EXAMPLE_ROUTE.ts)
- [Changelog](./docs/CHANGELOG.md)

## 📞 Support

Pour toute question ou amélioration, consultez la documentation ou contactez l'équipe.

---

**Version** : 2.0.0
**Dernière mise à jour** : 2024-03-12
**Licence** : Propriétaire - QuizLock
