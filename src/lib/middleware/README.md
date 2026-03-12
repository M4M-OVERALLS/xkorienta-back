# Middleware - Middlewares Next.js

Ce dossier contient les middlewares Next.js de l'application.

## Fichiers

### languageMiddleware.ts
Middleware pour détecter automatiquement la langue de la requête.

**Fonctionnalités :**
- Détecte la langue depuis : query params, headers, Accept-Language
- Injecte le header `X-Detected-Language`
- Rend la langue accessible dans toutes les routes API

**Setup dans `src/middleware.ts` :**
```typescript
import { languageMiddleware, LANGUAGE_MIDDLEWARE_MATCHER } from '@/lib/middleware'

export function middleware(request: NextRequest) {
  return languageMiddleware(request)
}

export const config = {
  matcher: LANGUAGE_MIDDLEWARE_MATCHER
}
```

**Usage dans les routes API :**
```typescript
import { getDetectedLanguage } from '@/lib/middleware'

export async function POST(req: Request) {
  const lang = getDetectedLanguage(req)
  // lang = 'fr' ou 'en'
}
```

## Ajouter un Nouveau Middleware

1. Créer un fichier dans ce dossier : `monMiddleware.ts`
2. Exporter depuis `index.ts`
3. L'utiliser dans `src/middleware.ts`

## Documentation

Pour plus d'informations sur le système multilingue, consultez :
- [Guide Multilingue](../errors/docs/MULTILINGUAL.md)
- [Documentation Complète](../errors/docs/README.md)
