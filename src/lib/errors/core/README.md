# Core - Code Principal

Ce dossier contient le code principal du système de gestion d'erreurs.

## Fichiers

### BaseError.ts
Classe de base pour toutes les erreurs personnalisées.
- Gère le multilingue
- Logging automatique
- Contexte enrichi
- Sérialisation JSON

### AuthenticationError.ts
Classe spécialisée pour les erreurs d'authentification.
- 25 factory methods
- Support multilingue
- Hérité de BaseError

### errorHandler.ts
Gestionnaire centralisé d'erreurs.
- `withErrorHandler()` - Wrapper pour routes API
- `ErrorHandler.handleError()` - Gestion manuelle
- Détection automatique de langue

### languageHelper.ts
Helper pour la détection et gestion des langues.
- Extraction depuis requête
- Normalisation
- Langues supportées

### types.ts
Tous les types TypeScript du système.
- `SupportedLanguage`
- `ErrorSeverity`
- `ErrorCategory`
- `ErrorDefinition`
- etc.

## Usage

```typescript
import { AuthenticationError, withErrorHandler } from '@/lib/errors'
```

Tous les exports sont centralisés dans `/src/lib/errors/index.ts`.
