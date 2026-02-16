# Xkorienta - OAuth Authentication avec Strategy Pattern

Ce document explique comment le système d'authentification OAuth fonctionne et comment ajouter de nouveaux providers.

## 🏗️ Architecture - Strategy Pattern

Le système utilise le **Strategy Pattern** pour gérer différents providers d'authentification. Cela permet d'ajouter facilement de nouveaux providers sans modifier le code existant.

### Structure

```
lib/auth/
├── auth.ts                      # Configuration NextAuth principale
└── strategies/
    ├── AuthStrategy.ts          # Interface et classe de base
    ├── CredentialsStrategy.ts   # Email/Password
    ├── GoogleStrategy.ts        # Google OAuth
    ├── GitHubStrategy.ts        # GitHub OAuth
    ├── AuthStrategyManager.ts   # Gestionnaire de stratégies
    └── index.ts                 # Exports
```

### Diagramme de Classes

```
┌─────────────────────────┐
│   IAuthStrategy         │ <-- Interface
├─────────────────────────┤
│ + id: string            │
│ + name: string          │
│ + icon?: string         │
│ + getProvider()         │
│ + handleSignIn()        │
│ + isEnabled()           │
└─────────────────────────┘
           △
           │ implements
           │
┌──────────────────────────┐
│   BaseAuthStrategy       │ <-- Classe abstraite
├──────────────────────────┤
│ + checkEnvVars()         │
└──────────────────────────┘
           △
           │ extends
    ┌──────┴───────┬─────────────┬───────────┐
    │              │             │           │
┌───────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
│Credentials│ │  Google  │ │  GitHub  │ │ Future  │
│Strategy   │ │Strategy  │ │Strategy  │ │Providers│
└───────────┘ └──────────┘ └──────────┘ └─────────┘
```

## 📚 Comment ça marche

### 1. Stratégies d'Authentification

Chaque provider (Google, GitHub, etc.) est une **stratégie** qui implémente l'interface `IAuthStrategy`:

```typescript
interface IAuthStrategy {
    readonly id: string              // 'google', 'github', etc.
    readonly name: string             // Nom pour l'affichage
    readonly icon?: string            // Icône (optionnel)

    getProvider(): Provider           // Retourne le provider NextAuth
    handleSignIn?(): Promise<boolean> // Gère la création/mise à jour user
    isEnabled(): boolean              // Vérifie si configuré
}
```

### 2. AuthStrategyManager

Le gestionnaire centralise toutes les stratégies:

- **Singleton Pattern** pour une seule instance
- Enregistre automatiquement toutes les stratégies
- Fournit les providers activés à NextAuth
- Gère les callbacks de connexion

```typescript
// Récupérer le gestionnaire
const manager = AuthStrategyManager.getInstance()

// Obtenir les providers activés
const providers = manager.getEnabledProviders()

// Vérifier si Google est activé
const isGoogleEnabled = manager.isProviderEnabled('google')
```

### 3. Flux d'Authentification OAuth

```
┌─────────┐                                    ┌────────────┐
│         │  1. Click "Google"                 │            │
│  User   ├────────────────────────────────────► Frontend  │
│         │                                    │ (Login)    │
└─────────┘                                    └─────┬──────┘
                                                     │
                                                     │ 2. signIn('google')
                                                     ▼
┌──────────────────────────────────────────────────────────┐
│                     NextAuth.js                          │
│  - Utilise GoogleStrategy.getProvider()                  │
│  - Redirige vers Google OAuth                           │
└──────────────────┬───────────────────────────────────────┘
                   │
                   │ 3. Authentification Google
                   ▼
         ┌─────────────────┐
         │  Google OAuth   │
         │  Serveurs       │
         └─────────┬───────┘
                   │
                   │ 4. Retour avec profile
                   ▼
┌──────────────────────────────────────────────────────────┐
│              GoogleStrategy.handleSignIn()                │
│  - Vérifie si user existe (email)                        │
│  - Crée ou met à jour user dans MongoDB                  │
│  - Assigne rôle par défaut (STUDENT)                     │
└──────────────────┬───────────────────────────────────────┘
                   │
                   │ 5. Session créée
                   ▼
              ┌─────────┐
              │Dashboard│
              └─────────┘
```

## 🚀 Providers Disponibles

### 1. Credentials (Email/Password) ✅
- **Toujours activé**
- Authentification traditionnelle
- Hashage bcrypt

### 2. Google OAuth ✅
- Connexion avec compte Google
- Création automatique du user
- Photo de profil incluse

### 3. GitHub OAuth ✅
- Connexion avec compte GitHub
- Création automatique du user
- Avatar GitHub

### 4. À venir
- Facebook
- Microsoft
- Apple
- LinkedIn

## 🔧 Configuration

### Google OAuth

#### 1. Créer le projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez **Google+ API**

#### 2. Créer les credentials OAuth

1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **OAuth 2.0 Client ID**
3. Type: **Web application**
4. Configurez les **Authorized redirect URIs**:
   - Développement: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://votre-domaine.com/api/auth/callback/google`

#### 3. Copier les credentials

```env
GOOGLE_CLIENT_ID="votre-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="votre-client-secret"
```

### GitHub OAuth

#### 1. Créer l'app GitHub

1. Allez sur [GitHub Developer Settings](https://github.com/settings/developers)
2. Cliquez sur **New OAuth App**
3. Remplissez:
   - **Application name**: Xkorienta
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

#### 2. Copier les credentials

```env
GITHUB_CLIENT_ID="votre-github-client-id"
GITHUB_CLIENT_SECRET="votre-github-client-secret"
```

## ➕ Ajouter un Nouveau Provider

Suivez ces étapes pour ajouter un nouveau provider (exemple: Facebook):

### Étape 1: Créer la Strategy

Créez `lib/auth/strategies/FacebookStrategy.ts`:

```typescript
import FacebookProvider from "next-auth/providers/facebook"
import { Provider } from "next-auth/providers/index"
import { BaseAuthStrategy } from "./AuthStrategy"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"

export class FacebookAuthStrategy extends BaseAuthStrategy {
    readonly id = "facebook"
    readonly name = "Facebook"
    readonly icon = "facebook"

    getProvider(): Provider {
        return FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID!,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
        })
    }

    async handleSignIn(profile: any, account: any): Promise<boolean> {
        try {
            await connectDB()

            let user = await User.findOne({ email: profile.email })

            if (user) {
                user.name = profile.name || user.name
                user.image = profile.picture?.data?.url || user.image
                user.facebookId = profile.id

                if (!user.role) {
                    user.role = "STUDENT"
                }

                await user.save()
            } else {
                user = await User.create({
                    name: profile.name,
                    email: profile.email.toLowerCase(),
                    image: profile.picture?.data?.url,
                    facebookId: profile.id,
                    role: "STUDENT",
                    studentCode: Math.random().toString(36).substring(2, 10).toUpperCase()
                })
            }

            return true
        } catch (error) {
            console.error("[FacebookStrategy] Error:", error)
            return false
        }
    }

    isEnabled(): boolean {
        return this.checkEnvVars("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET")
    }
}
```

### Étape 2: Enregistrer dans le Manager

Dans `lib/auth/strategies/AuthStrategyManager.ts`:

```typescript
private registerStrategies() {
    this.registerStrategy(new CredentialsAuthStrategy())
    this.registerStrategy(new GoogleAuthStrategy())
    this.registerStrategy(new GitHubAuthStrategy())
    this.registerStrategy(new FacebookAuthStrategy()) // ← Ajouter ici
}
```

### Étape 3: Mettre à jour le User Model

Si le provider nécessite des champs supplémentaires, ajoutez-les dans `models/User.ts`:

```typescript
export interface IUser extends Document {
    // ... autres champs
    facebookId?: string // ← Ajouter ici
}

const UserSchema = new Schema<IUser>({
    // ... autres champs
    facebookId: {
        type: String,
        unique: true,
        sparse: true,
    },
})
```

### Étape 4: Ajouter les variables d'environnement

Dans `.env`:

```env
FACEBOOK_CLIENT_ID="votre-facebook-app-id"
FACEBOOK_CLIENT_SECRET="votre-facebook-app-secret"
```

### Étape 5: (Optionnel) Ajouter l'icône

Dans `components/auth/OAuthButtons.tsx`, ajoutez le style pour l'icône Facebook:

```typescript
const getProviderStyles = (providerId: string) => {
    const styles = {
        // ... autres styles
        facebook: {
            bg: "bg-blue-600 hover:bg-blue-700",
            text: "text-white",
            border: "",
            icon: <FacebookIcon className="h-5 w-5" /> // Votre icône
        },
    }
    return styles[providerId] || styles.default
}
```

### C'est tout! ✅

Le nouveau provider apparaîtra automatiquement dans la page de login si les variables d'environnement sont configurées.

## 🎨 Interface Utilisateur

### Boutons OAuth

Les boutons OAuth s'affichent automatiquement en fonction des providers activés:

- ✅ Provider configuré → Bouton visible
- ❌ Provider non configuré → Bouton masqué

Pas besoin de modifier le frontend pour ajouter/retirer des providers!

### Personnalisation

Le composant `OAuthButtons` gère automatiquement:
- Les icônes des providers
- Les couleurs (Google blanc, GitHub noir, etc.)
- Les états de chargement
- Les erreurs

## 🔒 Sécurité

### Validation des Providers

Chaque strategy vérifie si elle est correctement configurée:

```typescript
isEnabled(): boolean {
    return this.checkEnvVars("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET")
}
```

Si les variables d'environnement manquent, le provider est désactivé automatiquement.

### Gestion des Utilisateurs OAuth

- **Email unique**: Un email ne peut être associé qu'à un seul compte
- **Pas de mot de passe**: Les users OAuth n'ont pas de mot de passe
- **Vérification email**: `emailVerified` est true pour OAuth
- **Rôle par défaut**: STUDENT (modifiable après création)

## 📊 Debugging

### Vérifier les providers activés

```typescript
// Dans une API route ou page serveur
import { authStrategyManager } from "@/lib/auth/strategies"

const status = authStrategyManager.getConfigStatus()
console.log(status)
// { credentials: true, google: true, github: false, ... }
```

### Logs

Les événements d'authentification sont loggés automatiquement:

```
[Auth] User signed in: user@example.com via google
[Auth] New user created: newuser@example.com
[GoogleStrategy] Error during sign-in: ...
```

## 🧪 Tests

Pour tester OAuth en local:

1. Configurez les credentials dans `.env`
2. Ajoutez `http://localhost:3000/api/auth/callback/google` dans Google Console
3. Lancez l'app: `npm run dev`
4. Allez sur `/login`
5. Cliquez sur "Continuer avec Google"

## 📝 Checklist de Production

- [ ] Générer `NEXTAUTH_SECRET` fort
- [ ] Configurer tous les providers OAuth
- [ ] Ajouter les URLs de callback production
- [ ] Activer HTTPS
- [ ] Tester chaque provider
- [ ] Vérifier les logs
- [ ] Documenter les credentials (vault sécurisé)

## 🆘 Troubleshooting

### "Provider not enabled"
→ Vérifiez les variables d'environnement

### "Redirect URI mismatch"
→ Vérifiez l'URL de callback dans la console OAuth

### "User already exists"
→ Normal, le système met à jour l'utilisateur existant

### Bouton OAuth ne s'affiche pas
→ Vérifiez que les env vars sont correctes et redémarrez le serveur

---

**Créé avec le Strategy Pattern** 🎨
**Extensible et maintenable** ✨
**Production ready** 🚀
