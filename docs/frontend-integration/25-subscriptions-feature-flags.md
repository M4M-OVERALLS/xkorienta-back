# Module 25 — Abonnements & Feature Flags (Xkorienta Orientation IA)

> **Audience** : Équipe frontend  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token` (Rôle : `STUDENT`)  
> **Fichiers clés** :
> - `src/contexts/SubscriptionContext.tsx` — Provider + hook `useFeatures()`
> - `src/hooks/useSubscription.ts` — hook autonome (hors dashboard)
> - `src/app/checkout/page.tsx` — page de paiement
> - `src/app/checkout/success/page.tsx` — confirmation post-paiement

---

## Vue d'ensemble

Le module Abonnements gère l'accès payant aux features de la plateforme via un système de **feature flags** basé sur les plans MongoDB.

### Principe

Chaque `Plan` en base contient un tableau `features: string[]`. Après paiement, le frontend vérifie ces features via le hook `useFeatures()` pour autoriser ou bloquer l'accès à une page/section. **Aucune logique d'accès n'est en dur dans le code** — tout se pilote depuis la base de données.

```
Plan ELEVE         → features: ["ORIENTATION_AI"]
Plan ASSISTANCE    → features: ["ASSISTANCE"]
Plan PRO           → features: ["FULL_ACCESS"]   ← bypass toutes les gates
Plan ETABLISSEMENT → features: ["ORIENTATION_AI", "ASSISTANCE"]
```

---

## 1. Endpoints API

### 1.1 Vérifier l'abonnement actif

```
GET /api/subscriptions/check
```

**Auth requise** : Oui  
**Usage** : Vérification rapide binaire (actif / non-actif), sans détail du plan.

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "hasActiveSubscription": true
  }
}
```

---

### 1.2 Récupérer l'abonnement complet

```
GET /api/subscriptions/mine
```

**Auth requise** : Oui  
**Usage** : Récupère le plan actif avec ses features — utilisé par `SubscriptionProvider`.

#### Réponse 200 — abonnement actif

```json
{
  "success": true,
  "data": {
    "_id": "664abc...",
    "status": "ACTIVE",
    "interval": "MONTHLY",
    "currentPeriodStart": "2026-06-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-07-01T00:00:00.000Z",
    "amount": 5000,
    "currency": "XAF",
    "autoRenew": true,
    "planId": {
      "_id": "663def...",
      "code": "ELEVE",
      "name": "Plan Élève",
      "features": ["ORIENTATION_AI"],
      "limits": {
        "aiAssistance": true,
        "prioritySupport": false
      }
    }
  }
}
```

#### Réponse 404 — aucun abonnement

```json
{
  "success": false,
  "message": "No active subscription found"
}
```

---

### 1.3 Souscrire à un plan

```
POST /api/subscriptions
```

**Auth requise** : Oui  
**Usage** : Initie le paiement NotchPay. Pour les plans gratuits, active immédiatement.

#### Body

```json
{
  "planCode": "ELEVE",
  "interval": "MONTHLY",
  "currency": "XAF",
  "phone": "699000000",
  "callbackUrl": "https://app.xkorin.com/checkout/success?plan=ELEVE&returnTo=/student/orientation/ai"
}
```

| Champ | Type | Valeurs | Requis |
|---|---|---|---|
| `planCode` | string | `DECOUVERTE`, `ELEVE`, `ETABLISSEMENT`, `PRO` | ✅ |
| `interval` | string | `MONTHLY`, `YEARLY` | ✅ |
| `currency` | string | `XAF`, `EUR`, `USD` | ✅ |
| `phone` | string | Numéro Mobile Money (sans +237) | ✅ |
| `callbackUrl` | string | URL de retour après paiement NotchPay | ✅ |

#### Réponse 200 — plan payant

```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://pay.notchpay.co/pay/ref_xxx",
    "paymentReference": "ref_xxx",
    "plan": { "code": "ELEVE", "name": "Plan Élève" },
    "isFree": false
  }
}
```

> **Action frontend** : Rediriger vers `data.paymentUrl` — NotchPay prend la main.

#### Réponse 200 — plan gratuit

```json
{
  "success": true,
  "data": {
    "subscription": { "_id": "...", "status": "ACTIVE" },
    "plan": { "code": "DECOUVERTE" },
    "isFree": true
  }
}
```

> **Action frontend** : Rediriger directement vers `returnTo` sans passer par NotchPay.

#### Réponse 409 — déjà abonné (idempotency guard)

```json
{
  "success": false,
  "message": "You already have an active subscription. Cancel it first to change plans."
}
```

> **Action frontend** : Afficher l'état "Déjà abonné" — ne pas recharger le paiement.

---

### 1.4 Renouveler l'abonnement

```
POST /api/subscriptions/mine/renew
```

**Auth requise** : Oui  
**Usage** : Renouvelle un abonnement expiré ou annulé. Même flow que la souscription initiale (retourne un `paymentUrl`).

#### Body

```json
{
  "interval": "MONTHLY",
  "currency": "XAF",
  "phone": "699000000",
  "callbackUrl": "https://app.xkorin.com/checkout/success?plan=ELEVE"
}
```

---

### 1.5 Annuler l'abonnement

```
DELETE /api/subscriptions/mine
```

**Auth requise** : Oui  
**Usage** : Annule l'abonnement actif (ne rembourse pas, désactive à la prochaine période).

#### Réponse 200

```json
{
  "success": true,
  "data": { "_id": "...", "status": "CANCELLED", "cancelledAt": "2026-06-02T..." }
}
```

---

### 1.6 Historique des abonnements

```
GET /api/subscriptions/history
```

**Auth requise** : Oui

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "status": "EXPIRED",
      "interval": "MONTHLY",
      "amount": 5000,
      "currency": "XAF",
      "currentPeriodStart": "2026-05-01T...",
      "currentPeriodEnd": "2026-06-01T...",
      "planId": { "code": "ELEVE", "name": "Plan Élève" }
    }
  ]
}
```

---

## 2. Feature Flags — Intégration Frontend

### 2.1 Catalogue des features

Défini dans `src/contexts/SubscriptionContext.tsx` — **source de vérité unique**.

| Constante | Valeur DB | Feature protégée |
|---|---|---|
| `FEATURES.ORIENTATION_AI` | `"ORIENTATION_AI"` | `/student/orientation/ai` — Conseiller IA |
| `FEATURES.ASSISTANCE` | `"ASSISTANCE"` | `/student/assistance` — Assistance enseignant |
| `FEATURES.MEDIATHEQUE_PREMIUM` | `"MEDIATHEQUE_PREMIUM"` | Livres & médias payants |
| `FEATURES.ANNALES` | `"ANNALES"` | Annales BTS/HND |
| `FEATURES.CHALLENGES` | `"CHALLENGES"` | Défis & gamification avancée |
| `FEATURES.ANALYTICS_PRO` | `"ANALYTICS_PRO"` | Analytics détaillés |
| `FEATURES.FULL_ACCESS` | `"FULL_ACCESS"` | **Bypass toutes les gates** (plan PRO) |

> `FULL_ACCESS` dans `features[]` d'un plan donne accès à toutes les features sans exception.

---

### 2.2 SubscriptionProvider

Placé dans `/(dashboard)/layout.tsx`. Fait **un seul appel** à `GET /api/subscriptions/mine` au montage du dashboard, puis partage le résultat à tous les composants enfants via Context.

```tsx
// layout.tsx — déjà configuré
<SubscriptionProvider>
  {children}
</SubscriptionProvider>
```

---

### 2.3 Hook `useFeatures()`

À utiliser dans tous les composants du dashboard pour vérifier l'accès.

```tsx
import { useFeatures, FEATURES } from "@/contexts/SubscriptionContext"

function MyPage() {
  const { status, can, isSubscribed, plan, refresh } = useFeatures()

  // Valeurs de status : "loading" | "active" | "inactive" | "unauthenticated"
}
```

#### Propriétés retournées

| Propriété | Type | Description |
|---|---|---|
| `status` | `"loading" \| "active" \| "inactive" \| "unauthenticated"` | État de l'abonnement |
| `can(feature)` | `(feature: string) => boolean` | Vérifie si la feature est accessible |
| `isSubscribed` | `boolean` | `true` si un plan actif existe |
| `plan` | `ActivePlan \| null` | Détails du plan actif |
| `plan.code` | `string` | Ex: `"ELEVE"` |
| `plan.name` | `string` | Ex: `"Plan Élève"` |
| `plan.features` | `string[]` | Liste des features du plan |
| `plan.expiresAt` | `Date` | Date d'expiration |
| `plan.interval` | `string` | `"MONTHLY"` ou `"YEARLY"` |
| `refresh()` | `() => void` | Recharge le statut (après paiement) |

---

### 2.4 Protéger une nouvelle page — Pattern standard

```tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFeatures, FEATURES } from "@/contexts/SubscriptionContext"
import { Loader2 } from "lucide-react"

export default function MaPageProtegee() {
  const router = useRouter()
  const { status, can } = useFeatures()

  const isLoading = status === "loading"
  const hasAccess = can(FEATURES.MA_FEATURE)   // ← changer ici

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?returnTo=/ma-page")
    }
  }, [status, router])

  if (isLoading) return <Loader2 className="animate-spin" />

  if (!hasAccess) {
    return (
      <div>
        <p>Abonnement requis</p>
        <a href="/checkout?plan=MON_PLAN&returnTo=/ma-page">
          S'abonner
        </a>
      </div>
    )
  }

  return <div>Contenu protégé</div>
}
```

---

### 2.5 Afficher des éléments conditionnels (sans redirection)

Pour griser un bouton ou afficher un badge "Premium" sans bloquer la page :

```tsx
const { can } = useFeatures()

<button disabled={!can(FEATURES.ANNALES)}>
  {can(FEATURES.ANNALES) ? "Télécharger l'annale" : "🔒 Premium"}
</button>
```

---

## 3. Flow de paiement complet

```
Visiteur clique "S'abonner"
  │
  ├─ Non connecté
  │    └─ /register?returnTo=/checkout?plan=ELEVE
  │         └─ après inscription → /checkout?plan=ELEVE
  │
  └─ Connecté
       └─ /checkout?plan=ELEVE&interval=MONTHLY&returnTo=/student/orientation/ai
            │
            ├─ GET /api/subscriptions/check
            │    ├─ hasActiveSubscription=true → "Déjà abonné" + accès direct
            │    └─ false → formulaire numéro MoMo
            │
            └─ POST /api/subscriptions
                 ├─ isFree=true → redirect returnTo (activation immédiate)
                 ├─ paymentUrl  → redirect NotchPay
                 └─ 409         → "Déjà abonné" (idempotency guard)

NotchPay → callbackUrl (/checkout/success?plan=ELEVE&returnTo=...)
  └─ bouton "Démarrer" → returnTo (/student/orientation/ai)

/student/orientation/ai
  ├─ status="loading"          → spinner
  ├─ status="unauthenticated"  → /login
  ├─ can(ORIENTATION_AI)=false → écran "Abonnement requis" + lien /checkout
  └─ can(ORIENTATION_AI)=true  → chat IA accessible
```

---

## 4. Ajouter une nouvelle feature — Checklist

- [ ] **DB** : Ajouter la valeur dans `features[]` du/des plans concernés (MongoDB)
- [ ] **Frontend** : Ajouter la constante dans `FEATURES` (`SubscriptionContext.tsx`)
- [ ] **Page** : Utiliser `can(FEATURES.MA_FEATURE)` pour protéger l'accès
- [ ] **Checkout** : Créer une URL `/checkout?plan=MON_PLAN&returnTo=/ma-page`
- [ ] **Orientation page** : Ajouter le plan dans le tableau `plans[]` si c'est un nouveau plan public

> Aucune modification du backend requise pour ajouter une feature à un plan existant — uniquement un update MongoDB sur le champ `features[]`.

---

## 5. Codes plans disponibles

| `planCode` | `features[]` | Prix | Intervalle |
|---|---|---|---|
| `DECOUVERTE` | `[]` | Gratuit | — |
| `ELEVE` | `["ORIENTATION_AI"]` | 3 000 – 8 000 FCFA | MONTHLY |
| `ASSISTANCE_BASIC` | `["ASSISTANCE"]` | À définir | MONTHLY |
| `PRO` | `["FULL_ACCESS"]` | À définir | MONTHLY / YEARLY |
| `ETABLISSEMENT` | `["ORIENTATION_AI", "ASSISTANCE"]` | 50 000 – 200 000 FCFA | YEARLY |

---

## 6. Pages frontend associées

| URL | Accès | Description |
|---|---|---|
| `/orientation` | Public | Landing + pricing. CTAs adaptés selon état auth/sub |
| `/checkout` | Connecté | Paiement — vérifie sub existante avant de charger |
| `/checkout/success` | Connecté | Confirmation post-paiement NotchPay |
| `/student/orientation/ai` | Connecté + `ORIENTATION_AI` | Chat IA Xkorienta |
| `/student/assistance` | Connecté + `ASSISTANCE` | Assistance enseignant |
