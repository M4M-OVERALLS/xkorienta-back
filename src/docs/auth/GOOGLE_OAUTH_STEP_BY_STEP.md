# Guide Étape par Étape - Obtenir Google Client ID et Secret

Guide complet avec captures d'écran pour configurer Google OAuth pour Xkorienta.

## 📋 Prérequis

- Un compte Google (Gmail)
- 10 minutes de temps
- Accès à https://console.cloud.google.com/

---

## 🚀 Étape 1: Accéder à Google Cloud Console

1. **Ouvrez votre navigateur** et allez sur:
   ```
   https://console.cloud.google.com/
   ```

2. **Connectez-vous** avec votre compte Google

3. Vous arriverez sur le **Dashboard** de Google Cloud Console

---

## 📦 Étape 2: Créer un Nouveau Projet

### 2.1 Cliquer sur le sélecteur de projet

En haut de la page, vous verrez:
- À gauche du nom "Google Cloud", il y a un menu déroulant
- Cliquez dessus (il affiche probablement "Select a project" ou le nom d'un projet existant)

### 2.2 Créer le projet

1. Dans la popup qui s'ouvre, cliquez sur **"NEW PROJECT"** (en haut à droite)

2. Remplissez les informations:
   - **Project name**: `Xkorienta` (ou le nom de votre choix)
   - **Organization**: Laissez par défaut ou sélectionnez votre organisation
   - **Location**: Laissez par défaut

3. Cliquez sur **"CREATE"**

4. **Attendez** quelques secondes que le projet soit créé
   - Une notification apparaîtra en haut à droite

5. **Sélectionnez votre nouveau projet** dans le menu déroulant

---

## 🔌 Étape 3: Activer Google+ API

### 3.1 Ouvrir la bibliothèque d'APIs

1. Dans le menu de gauche (☰), cliquez sur:
   ```
   APIs & Services > Library
   ```

   Ou utilisez la barre de recherche en haut et tapez: **"API Library"**

### 3.2 Rechercher Google+ API

1. Dans la barre de recherche de la bibliothèque, tapez:
   ```
   Google+ API
   ```

2. Cliquez sur **"Google+ API"** dans les résultats

3. Cliquez sur le bouton **"ENABLE"** (Activer)

4. Attendez quelques secondes que l'API soit activée

> **Note**: Si vous voyez "API enabled" ou "Manage", l'API est déjà activée ✅

---

## 🔐 Étape 4: Configurer l'Écran de Consentement OAuth

Avant de créer les credentials, vous devez configurer l'écran de consentement.

### 4.1 Accéder à OAuth consent screen

1. Dans le menu de gauche, allez à:
   ```
   APIs & Services > OAuth consent screen
   ```

### 4.2 Choisir le type d'utilisateur

1. Sélectionnez **"External"** (car votre app sera accessible publiquement)
2. Cliquez sur **"CREATE"**

### 4.3 Remplir les informations de l'app

**Page 1: App information**

Remplissez les champs suivants:

- **App name**: `Xkorienta`
- **User support email**: Votre email
- **App logo**: (optionnel, vous pouvez passer)
- **Application home page**: `http://localhost:3000` (pour l'instant)
- **Application privacy policy link**: Laissez vide pour le développement
- **Application terms of service link**: Laissez vide pour le développement
- **Authorized domains**:
  - Laissez vide pour localhost
  - En production, ajoutez votre domaine (ex: `Xkorienta.com`)
- **Developer contact information**: Votre email

Cliquez sur **"SAVE AND CONTINUE"**

**Page 2: Scopes**

1. Cliquez sur **"ADD OR REMOVE SCOPES"**
2. Sélectionnez:
   - ✅ `.../auth/userinfo.email`
   - ✅ `.../auth/userinfo.profile`
   - ✅ `openid`

3. Cliquez sur **"UPDATE"**
4. Cliquez sur **"SAVE AND CONTINUE"**

**Page 3: Test users** (optionnel pour développement)

1. Cliquez sur **"ADD USERS"**
2. Ajoutez votre email de test
3. Cliquez sur **"ADD"**
4. Cliquez sur **"SAVE AND CONTINUE"**

**Page 4: Summary**

1. Vérifiez les informations
2. Cliquez sur **"BACK TO DASHBOARD"**

---

## 🎫 Étape 5: Créer les Credentials OAuth 2.0

C'est ici que vous obtiendrez votre Client ID et Client Secret!

### 5.1 Accéder à Credentials

1. Dans le menu de gauche, cliquez sur:
   ```
   APIs & Services > Credentials
   ```

### 5.2 Créer OAuth Client ID

1. En haut de la page, cliquez sur **"+ CREATE CREDENTIALS"**

2. Dans le menu déroulant, sélectionnez:
   ```
   OAuth client ID
   ```

### 5.3 Configurer le Client ID

1. **Application type**: Sélectionnez **"Web application"**

2. **Name**: Donnez un nom descriptif
   ```
   Xkorienta Development
   ```

3. **Authorized JavaScript origins** (optionnel):
   ```
   http://localhost:3000
   ```

4. **Authorized redirect URIs** ⚠️ **IMPORTANT**:

   Cliquez sur **"+ ADD URI"** et ajoutez **EXACTEMENT**:

   **Pour le développement (localhost):**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

   **Pour la production (ajoutez aussi):**
   ```
   https://votre-domaine.com/api/auth/callback/google
   ```

   > ⚠️ **ATTENTION**:
   > - Pas de trailing slash (/) à la fin
   > - Doit être EXACTEMENT comme indiqué
   > - Respectez http:// pour localhost et https:// pour production

5. Cliquez sur **"CREATE"**

---

## 🎉 Étape 6: Récupérer vos Credentials

### 6.1 Popup de confirmation

Après avoir cliqué sur "CREATE", une popup apparaît avec:

```
OAuth client created

Your Client ID
[un long texte].apps.googleusercontent.com

Your Client Secret
[une chaîne de caractères]
```

### 6.2 Copier les credentials

**Option 1: Copier immédiatement**

1. Cliquez sur l'icône 📋 à côté de **Client ID** pour le copier
2. Collez-le quelque part (Notepad, etc.)
3. Cliquez sur l'icône 📋 à côté de **Client Secret** pour le copier
4. Collez-le aussi

**Option 2: Télécharger le JSON**

1. Cliquez sur **"DOWNLOAD JSON"**
2. Un fichier sera téléchargé avec vos credentials

**Option 3: Récupérer plus tard**

1. Cliquez sur **"OK"** pour fermer la popup
2. Dans la page Credentials, vous verrez votre client OAuth 2.0
3. Cliquez sur le nom (ex: "Xkorienta Development")
4. Vous verrez vos credentials à nouveau

---

## 📝 Étape 7: Configurer votre Application

### 7.1 Ouvrir votre fichier .env

Dans votre projet Xkorienta, ouvrez ou créez le fichier `.env`:

```bash
# Si le fichier n'existe pas
cp .env.example .env
```

### 7.2 Ajouter les credentials

Ajoutez ces lignes dans votre `.env`:

```env
# Database (ne changez pas si déjà configuré)
DATABASE_URL="mongodb+srv://..."

# NextAuth (ne changez pas si déjà configuré)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="votre-secret-existant"

# Google OAuth - NOUVEAU
GOOGLE_CLIENT_ID="collez-votre-client-id-ici.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="collez-votre-client-secret-ici"
```

**Exemple de ce que ça devrait ressembler:**

```env
GOOGLE_CLIENT_ID="123456789-abcdefgh12345678.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-AbCdEf123456789"
```

### 7.3 Sauvegarder le fichier

**Important**:
- ✅ Sauvegardez le fichier `.env`
- ⚠️ Ne commitez JAMAIS ce fichier sur Git
- ✅ Vérifiez que `.env` est dans `.gitignore`

---

## ✅ Étape 8: Tester l'Installation

### 8.1 Redémarrer le serveur

```bash
# Arrêtez le serveur si il tourne (Ctrl+C)

# Relancez le serveur
npm run dev
```

### 8.2 Accéder à la page de login

1. Ouvrez votre navigateur
2. Allez sur: http://localhost:3000/login
3. Vous devriez voir le bouton **"Continuer avec Google"** ✨

### 8.3 Tester la connexion

1. Cliquez sur **"Continuer avec Google"**
2. Sélectionnez votre compte Google
3. Autorisez l'accès à Xkorienta
4. Vous serez redirigé vers `/dashboard`

**Si ça marche**: 🎉 Félicitations! Google OAuth est configuré!

---

## 🐛 Problèmes Courants et Solutions

### ❌ "Redirect URI mismatch"

**Problème**: L'URL de callback ne correspond pas

**Solution**:
1. Retournez dans Google Cloud Console > Credentials
2. Cliquez sur votre OAuth 2.0 Client ID
3. Vérifiez que l'URL est EXACTEMENT:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. Pas d'espace, pas de trailing slash
5. Cliquez sur SAVE

### ❌ Le bouton Google ne s'affiche pas

**Solutions**:
1. Vérifiez que `.env` contient bien les credentials
2. Redémarrez le serveur (Ctrl+C puis `npm run dev`)
3. Vérifiez qu'il n'y a pas d'espaces avant/après les credentials
4. Ouvrez la console du navigateur (F12) pour voir les erreurs

### ❌ "Access blocked: Xkorienta has not completed the Google verification process"

**C'est normal en développement!**

**Solution temporaire**:
1. Retournez dans OAuth consent screen
2. Dans la section "Test users", ajoutez votre email
3. Utilisez cet email pour tester

**Solution permanente (pour production)**:
1. Complétez le processus de vérification Google
2. Soumettez votre app pour review

### ❌ "Invalid client"

**Solutions**:
1. Vérifiez que vous avez bien copié le Client ID (avec .apps.googleusercontent.com)
2. Vérifiez que le Client Secret est correct
3. Pas d'espaces avant/après dans le `.env`

### ❌ Erreur 400: "admin_policy_enforced"

**Solution**:
1. Utilisez un compte Google personnel (pas un compte workspace d'entreprise)
2. Ou demandez à l'admin de votre workspace d'autoriser l'app

---

## 🌐 Configuration pour la Production

Quand vous déployez votre app:

### 1. Retournez dans Google Cloud Console

1. Allez dans **Credentials**
2. Cliquez sur votre OAuth Client ID

### 2. Ajoutez l'URL de production

Dans **Authorized redirect URIs**, ajoutez:

```
https://votre-domaine.com/api/auth/callback/google
```

### 3. Mettez à jour vos variables d'environnement

Sur votre plateforme de déploiement (Vercel, Netlify, etc.):

```env
NEXTAUTH_URL="https://votre-domaine.com"
GOOGLE_CLIENT_ID="votre-client-id"
GOOGLE_CLIENT_SECRET="votre-client-secret"
```

### 4. Vérification Google (optionnel mais recommandé)

Pour retirer le message "app non vérifiée":

1. Dans OAuth consent screen, cliquez sur **"PUBLISH APP"**
2. Soumettez votre app pour vérification Google
3. Complétez le questionnaire de sécurité
4. Attendez la validation (peut prendre quelques jours)

---

## 📱 Récapitulatif Visuel

```
┌─────────────────────────────────────────────┐
│  1. Google Cloud Console                    │
│     https://console.cloud.google.com        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  2. Créer un Projet                         │
│     "Xkorienta"                              │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  3. Activer Google+ API                     │
│     APIs & Services > Library               │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  4. OAuth Consent Screen                    │
│     External + App info                     │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  5. Créer OAuth 2.0 Client ID               │
│     Web application                         │
│     Redirect: /api/auth/callback/google     │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  6. Copier Client ID & Secret               │
│     📋 Sauvegarder dans .env                │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  7. Tester                                  │
│     npm run dev                             │
│     http://localhost:3000/login             │
└─────────────────────────────────────────────┘
```

---

## 💡 Astuces

1. **Gardez une copie de vos credentials** dans un gestionnaire de mots de passe sécurisé

2. **Pour tester avec plusieurs comptes**: Ajoutez les emails dans "Test users"

3. **Logs de debugging**: Regardez la console (F12) pour voir les erreurs

4. **Variables d'environnement**: Après modification, toujours redémarrer le serveur

5. **Git**: Assurez-vous que `.env` est dans `.gitignore`:
   ```bash
   # Vérifier
   cat .gitignore | grep .env
   ```

---

## 🆘 Besoin d'Aide?

Si vous rencontrez toujours des problèmes:

1. **Vérifiez la documentation officielle**:
   - https://developers.google.com/identity/protocols/oauth2

2. **Console du navigateur** (F12):
   - Onglet "Console" pour voir les erreurs JavaScript
   - Onglet "Network" pour voir les requêtes HTTP

3. **Logs du serveur**:
   - Regardez le terminal où tourne `npm run dev`
   - Recherchez les messages d'erreur

4. **Fichier de config**:
   - Vérifiez que `lib/auth.ts` n'a pas été modifié
   - Vérifiez que les stratégies sont bien dans `lib/auth/strategies/`

---

## ✅ Checklist Finale

Avant de dire que c'est terminé, vérifiez:

- [ ] Projet créé dans Google Cloud Console
- [ ] Google+ API activée
- [ ] OAuth consent screen configuré
- [ ] OAuth 2.0 Client ID créé
- [ ] Redirect URI correct: `http://localhost:3000/api/auth/callback/google`
- [ ] Client ID copié dans `.env`
- [ ] Client Secret copié dans `.env`
- [ ] Serveur redémarré
- [ ] Bouton "Continuer avec Google" visible sur `/login`
- [ ] Test de connexion réussi

---

🎉 **Félicitations!** Vous avez configuré Google OAuth avec succès!

**Prochaines étapes**:
- Testez avec différents comptes
- Ajoutez GitHub OAuth (similaire)
- Déployez en production
- Configurez d'autres providers (Facebook, Microsoft, etc.)

---

**Créé pour Xkorienta** 🔐
**Dernière mise à jour**: 2025-01-29
