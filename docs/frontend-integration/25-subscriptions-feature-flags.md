# Module 25 — Abonnements & Feature Flags

> **Audience** : Équipe frontend (web, mobile Flutter, intégrations externes)  
> **Base URL backend** : `{{baseUrl}}` (ex: `http://localhost:3001` · prod `https://xkorienta.com/xkorienta/backend`)  
> **Auth** : Cookie session NextAuth (`credentials: 'include'` sur web) ou équivalent mobile  
> **Principe** : les features sont pilotées par MongoDB (`plans.features[]`) — pas de logique d'accès en dur côté API  
> **Dernière mise à jour** : juin 2026

---

## En bref

Les abonnements débloquent des **fonctionnalités premium** (Conseiller IA, Assistance, etc.).  
Chaque plan en base contient un tableau `features: string[]`. Le client appelle `GET /api/subscriptions/mine`, lit `plan.features`, puis décide d'afficher ou masquer une section.

Le paiement passe par **NotchPay** (Mobile Money / carte). Après retour sur `callbackUrl`, le webhook backend active l'abonnement.

---

## 1. Enums & types (kit d'implémentation)

### Enums backend

```typescript
type SubscriptionInterval = 'MONTHLY' | 'YEARLY'

type SubscriptionPlanStatus =
  | 'ACTIVE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PAST_DUE'

type Currency = 'XAF' | 'EUR' | 'USD'

type TransactionType = 'SUBSCRIPTION' | 'BOOK_PURCHASE' | 'MEDIA_PURCHASE' | /* … */
```

### Catalogue des feature flags

Valeurs possibles dans `plan.features[]` — **source de vérité MongoDB** :

| Constante client | Valeur DB | Feature protégée |
|---|---|---|
| `ORIENTATION_AI` | `"ORIENTATION_AI"` | Rapport d'orientation complet (paywall module 26) |
| `ASSISTANCE` | `"ASSISTANCE"` | Assistance enseignant / IA |
| `MEDIATHEQUE_PREMIUM` | `"MEDIATHEQUE_PREMIUM"` | Livres & médias payants |
| `ANNALES` | `"ANNALES"` | Annales BTS/HND |
| `CHALLENGES` | `"CHALLENGES"` | Défis & gamification avancée |
| `ANALYTICS_PRO` | `"ANALYTICS_PRO"` | Analytics détaillés |
| `FULL_ACCESS` | `"FULL_ACCESS"` | **Bypass toutes les gates** |

```typescript
const FEATURES = {
  ORIENTATION_AI:      'ORIENTATION_AI',
  ASSISTANCE:          'ASSISTANCE',
  MEDIATHEQUE_PREMIUM: 'MEDIATHEQUE_PREMIUM',
  ANNALES:             'ANNALES',
  CHALLENGES:          'CHALLENGES',
  ANALYTICS_PRO:       'ANALYTICS_PRO',
  FULL_ACCESS:         'FULL_ACCESS',
} as const

type Feature = (typeof FEATURES)[keyof typeof FEATURES]
```

### Types client

```typescript
interface PlanPrice {
  currency: Currency
  amount: number
  interval: SubscriptionInterval
}

interface PlanLimits {
  maxExamsPerMonth?: number
  maxClassesJoined?: number
  downloadBooks: boolean
  prioritySupport: boolean
  aiAssistance: boolean
  offlineAccess: boolean
}

interface Plan {
  _id: string
  code: string           // ex: "ELEVE"
  name: string
  description: string
  prices: PlanPrice[]
  features: string[]
  limits: PlanLimits
  isActive: boolean
  isFree: boolean
  sortOrder: number
}

interface Subscription {
  _id: string
  userId: string
  planId: string | Plan   // peut être peuplé
  status: SubscriptionPlanStatus
  interval: SubscriptionInterval
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelledAt?: string
  currency: string
  amount: number
  autoRenew: boolean
}

interface SubscriptionMineResponse {
  subscription: Subscription | null
  plan: Plan | null
  isActive: boolean
  daysRemaining: number
}

interface ActivePlanUI {
  code: string
  name: string
  features: string[]
  expiresAt: Date
  interval: SubscriptionInterval
}

type SubStatus = 'loading' | 'active' | 'inactive' | 'unauthenticated'
```

### Logique `can(feature)` — à implémenter côté client

```typescript
function can(feature: string, status: SubStatus, plan: ActivePlanUI | null): boolean {
  if (status !== 'active' || !plan) return false
  if (plan.features.includes(FEATURES.FULL_ACCESS)) return true
  return plan.features.includes(feature)
}

// isSubscribed = status === 'active'
```

> Le chat IA (`POST /api/xkorienta/chat`) reste **public**. Seul l'**affichage du rapport payant** (module 26) utilise `can(FEATURES.ORIENTATION_AI)`.

---

## 2. Endpoints API

### 2.1 Lister les plans publics

```
GET {{baseUrl}}/api/plans
```

**Auth** : Aucune

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "663def...",
      "code": "ELEVE",
      "name": "Plan Élève",
      "description": "Accès au conseiller IA d'orientation",
      "prices": [
        { "currency": "XAF", "amount": 5000, "interval": "MONTHLY" }
      ],
      "features": ["ORIENTATION_AI"],
      "limits": {
        "downloadBooks": false,
        "prioritySupport": false,
        "aiAssistance": true,
        "offlineAccess": false
      },
      "isActive": true,
      "isFree": false,
      "sortOrder": 1
    }
  ]
}
```

### 2.2 Détail d'un plan

```
GET {{baseUrl}}/api/plans/:code
```

Exemple : `GET /api/plans/ELEVE` — **404** si plan inconnu.

---

### 2.3 Vérifier abonnement actif (binaire)

```
GET {{baseUrl}}/api/subscriptions/check
```

**Auth** : Oui

#### Réponse 200

```json
{
  "success": true,
  "data": {
    "hasActiveSubscription": true
  }
}
```

Usage : écran checkout — éviter de relancer un paiement si déjà abonné.

---

### 2.4 Abonnement complet de l'utilisateur

```
GET {{baseUrl}}/api/subscriptions/mine
```

**Auth** : Oui

#### Réponse 200 — abonnement actif

```json
{
  "success": true,
  "data": {
    "subscription": {
      "_id": "664abc...",
      "status": "ACTIVE",
      "interval": "MONTHLY",
      "currentPeriodStart": "2026-06-01T00:00:00.000Z",
      "currentPeriodEnd": "2026-07-01T00:00:00.000Z",
      "amount": 5000,
      "currency": "XAF",
      "autoRenew": true
    },
    "plan": {
      "_id": "663def...",
      "code": "ELEVE",
      "name": "Plan Élève",
      "features": ["ORIENTATION_AI"],
      "limits": {
        "aiAssistance": true,
        "prioritySupport": false,
        "downloadBooks": false,
        "offlineAccess": false
      }
    },
    "isActive": true,
    "daysRemaining": 28
  }
}
```

#### Réponse 200 — pas d'abonnement

```json
{
  "success": true,
  "data": {
    "subscription": null,
    "plan": null,
    "isActive": false,
    "daysRemaining": 0
  }
}
```

> **Important** : l'API retourne toujours **200** (pas de 404). Tester `data.isActive === true` **et** `currentPeriodEnd > now`.

#### Mapping client recommandé

```typescript
async function fetchSubscription(baseUrl: string): Promise<{
  status: SubStatus
  plan: ActivePlanUI | null
}> {
  const res = await fetch(`${baseUrl}/api/subscriptions/mine`, {
    credentials: 'include',
  })
  if (res.status === 401) return { status: 'unauthenticated', plan: null }

  const json = await res.json()
  const { subscription: sub, plan, isActive } = json.data ?? {}

  if (!sub || !isActive) return { status: 'inactive', plan: null }

  const expiresAt = new Date(sub.currentPeriodEnd)
  if (expiresAt < new Date()) return { status: 'inactive', plan: null }

  return {
    status: 'active',
    plan: {
      code: plan?.code ?? '',
      name: plan?.name ?? 'Plan actif',
      features: plan?.features ?? [],
      expiresAt,
      interval: sub.interval,
    },
  }
}
```

---

### 2.5 Souscrire à un plan

```
POST {{baseUrl}}/api/subscriptions
Content-Type: application/json
```

**Auth** : Oui

#### Body

```json
{
  "planCode": "ELEVE",
  "interval": "MONTHLY",
  "currency": "XAF",
  "callbackUrl": "https://xkorienta.com/checkout/success?plan=ELEVE&returnTo=/orientation"
}
```

| Champ | Type | Requis | Description |
|---|---|---|---|
| `planCode` | `string` | ✅ | Code plan (`ELEVE`, `DECOUVERTE`, …) |
| `interval` | `MONTHLY` \| `YEARLY` | ✅ | Période de facturation |
| `currency` | `XAF` \| `EUR` \| `USD` | ✅ | Doit correspondre à un `prices[]` du plan |
| `callbackUrl` | `string` | ✅ | URL de retour après paiement NotchPay |

> Pas de champ `phone` côté API — NotchPay gère le Mobile Money sur sa page de paiement. L'email est pris depuis la session ou le profil utilisateur.

#### Réponse 201 — plan payant

```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://pay.notchpay.co/pay/ref_xxx",
    "paymentReference": "ref_xxx",
    "plan": { "code": "ELEVE", "name": "Plan Élève", "features": ["ORIENTATION_AI"], "…": "…" },
    "isFree": false
  }
}
```

**Action client** : `window.location.href = data.paymentUrl` (ou WebView mobile).

#### Réponse 201 — plan gratuit (`isFree: true`)

```json
{
  "success": true,
  "data": {
    "subscription": { "_id": "...", "status": "ACTIVE", "…": "…" },
    "plan": { "code": "DECOUVERTE", "…": "…" },
    "isFree": true
  }
}
```

**Action client** : rediriger vers `returnTo` sans NotchPay.

#### Erreurs

| Status | Message typique | Action client |
|---|---|---|
| `400` | Champs manquants / interval invalide / pas de prix pour currency+interval | Afficher erreur |
| `401` | Unauthorized | Rediriger login |
| `404` | Plan not found | Plan invalide |
| `409` | Already have an active subscription | Accès direct ou écran « Déjà abonné » |
| `500` | Erreur serveur | Retry |

---

### 2.6 Renouveler l'abonnement

```
POST {{baseUrl}}/api/subscriptions/mine/renew
```

**Auth** : Oui

#### Body

```json
{
  "callbackUrl": "https://xkorienta.com/checkout/success?plan=ELEVE"
}
```

Seul `callbackUrl` est requis — le plan/interval/currency sont repris de l'abonnement actif.

Réponse identique à **2.5** (`paymentUrl` ou `isFree: true`).

---

### 2.7 Annuler l'abonnement

```
DELETE {{baseUrl}}/api/subscriptions/mine
```

**Auth** : Oui

#### Réponse 200

```json
{
  "success": true,
  "message": "Subscription cancelled successfully. You will retain access until the end of your current period.",
  "data": {
    "_id": "...",
    "status": "CANCELLED",
    "cancelledAt": "2026-06-02T..."
  }
}
```

L'accès reste actif jusqu'à `currentPeriodEnd`.

---

### 2.8 Historique

```
GET {{baseUrl}}/api/subscriptions/history
```

**Auth** : Oui

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

## 3. Plans connus (exemples MongoDB)

> Les prix réels viennent de `GET /api/plans` — ne pas les coder en dur.

| `planCode` | `features[]` typiques | `isFree` | Intervalle |
|---|---|---|---|
| `DECOUVERTE` | `[]` | `true` | MONTHLY |
| `ELEVE` | `["ORIENTATION_AI"]` | `false` | MONTHLY |
| `ASSISTANCE` | `["ASSISTANCE"]` | `false` | MONTHLY |
| `PRO` | `["FULL_ACCESS"]` | `false` | MONTHLY / YEARLY |
| `ETABLISSEMENT` | `["ORIENTATION_AI", "ASSISTANCE"]` | `false` | YEARLY |

---

## 4. Flux de paiement complet

```
Utilisateur clique « S'abonner »
  │
  ├─ Non connecté → /login?returnTo=/checkout?plan=ELEVE&returnTo=...
  │
  └─ Connecté → /checkout?plan=ELEVE&interval=MONTHLY&returnTo=...
       │
       ├─ GET /api/subscriptions/check
       │    └─ hasActiveSubscription=true → redirect returnTo
       │
       └─ POST /api/subscriptions { planCode, interval, currency, callbackUrl }
            ├─ isFree=true  → redirect returnTo
            ├─ paymentUrl   → redirect NotchPay
            └─ 409          → redirect returnTo (déjà abonné)

NotchPay → callbackUrl (/checkout/success?plan=ELEVE&returnTo=...)
  └─ Bouton « Continuer » → returnTo
       └─ GET /api/subscriptions/mine (refresh) → isActive=true

Page protégée (ex: orientation rapport payant)
  ├─ status=loading           → spinner
  ├─ status=unauthenticated   → login
  ├─ can(ORIENTATION_AI)=false → paywall + lien checkout
  └─ can(ORIENTATION_AI)=true  → contenu débloqué
```

### Query params checkout recommandés

| Param | Exemple | Description |
|---|---|---|
| `plan` | `ELEVE` | Code plan |
| `interval` | `MONTHLY` | Période |
| `returnTo` | `/orientation` | URL post-paiement |

---

## 5. Protéger une page — pattern client

```typescript
// 1. Au montage : fetchSubscription()
// 2. Gate :

if (status === 'loading') return <Spinner />
if (status === 'unauthenticated') redirect('/login?returnTo=...')
if (!can(FEATURES.ORIENTATION_AI, status, plan)) {
  return (
    <Paywall
      ctaUrl={`/checkout?plan=ELEVE&returnTo=${encodeURIComponent(currentPath)}`}
    />
  )
}
return <ProtectedContent />
```

### Élément conditionnel (sans bloquer la page)

```typescript
const showPremium = can(FEATURES.ANNALES, status, plan)
<Button disabled={!showPremium}>
  {showPremium ? 'Télécharger' : '🔒 Premium'}
</Button>
```

---

## 6. Ajouter une nouvelle feature

1. **MongoDB** : ajouter la string dans `plans.features[]` du plan concerné
2. **Client** : ajouter la constante dans `FEATURES`
3. **UI** : `can(FEATURES.MA_FEATURE)` sur la page ou le bouton
4. **Checkout** : s'assurer que le plan vendu inclut la feature

Aucune modification backend obligatoire si le plan existe déjà.

---

## 7. Auth & CORS

| Plateforme | Appel API |
|---|---|
| Web même domaine (proxy `/api`) | `fetch('/api/subscriptions/mine', { credentials: 'include' })` |
| Mobile / web externe | `{{baseUrl}}/api/subscriptions/mine` + cookie session ou token selon votre auth |

Origines web autorisées (CORS backend) : `xkorienta.com`, `gradeforcast.com`, `localhost:3000`.

---

## 8. Checklist intégration

- [ ] `GET /api/plans` pour afficher le catalogue tarifaire
- [ ] `GET /api/subscriptions/mine` au démarrage des écrans premium
- [ ] Tester `isActive` + date `currentPeriodEnd` (pas seulement HTTP status)
- [ ] `can(feature)` avec bypass `FULL_ACCESS`
- [ ] Checkout : `POST /api/subscriptions` → redirect `paymentUrl`
- [ ] Page succès : `refresh()` puis redirect `returnTo`
- [ ] Paywall rapport IA : voir **Module 26** § 7.12
- [ ] Gérer 409 (déjà abonné) sans double paiement

---

## 9. Liens

| Module | Sujet |
|---|---|
| **26** | Chat IA + paywall rapport `ORIENTATION_AI` |
| **FACTURATION.md** | Factures achats livres / relevés vendeurs |
