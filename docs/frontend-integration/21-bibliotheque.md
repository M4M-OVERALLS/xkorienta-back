# 📚 21 — Bibliothèque (Books)

## Vue d'ensemble

La bibliothèque permet aux enseignants de publier des livres pédagogiques (PDF ou EPUB), soumis à validation avant publication. Les étudiants peuvent parcourir, accéder aux livres gratuits et acheter les livres payants avec des remises automatiques basées sur leur niveau de gamification. Une page publique accessible sans connexion présente le catalogue global.

---

## Acteurs et permissions

| Acteur | Droits |
|---|---|
| **Visiteur (non connecté)** | Parcourir `GET /api/books/public` uniquement |
| **TEACHER** | Soumettre, voir ses propres livres, modifier/supprimer en DRAFT |
| **STUDENT** | Parcourir le catalogue approuvé, accéder aux gratuits, acheter |
| **SCHOOL_ADMIN** (admin d'école) | Valider/rejeter les livres SCHOOL **de son école uniquement** |
| **DG_M4M / TECH_SUPPORT** (admin plateforme) | Super-admin : valider/rejeter **n'importe quel livre** (GLOBAL ou SCHOOL, toutes écoles) + configurer la plateforme |

> **Hiérarchie des admins** :
> - `SCHOOL_ADMIN` = admin d'une école → portée limitée à son école.
> - `DG_M4M` / `TECH_SUPPORT` = admin de la plateforme → portée totale (peut valider à la place d'un `SCHOOL_ADMIN` absent, ou corriger une décision).
> Le `SCHOOL_ADMIN` ne peut **jamais** agir sur les livres `GLOBAL` ni sur les livres d'une autre école.

---

## Endpoints

### Public (sans authentification)

```
GET /api/books/public
```
Retourne les livres `APPROVED` de portée `GLOBAL`.

**Query params** : `search`, `format` (`PDF`|`EPUB`), `free` (`1`=gratuits seulement), `page`, `limit` (max 50)

**Réponse 200** :
```json
{
  "success": true,
  "data": {
    "books": [ ...BookObject ],
    "total": 42,
    "page": 1,
    "limit": 24,
    "totalPages": 2
  }
}
```

---

### Catalogue authentifié

```
GET /api/books
```
Idem mais accepte `scope` (`GLOBAL`|`SCHOOL`) et `schoolId` en plus.

---

### Soumettre un livre (TEACHER)

```
POST /api/books
Content-Type: multipart/form-data
```

**Body FormData** :

| Champ | Type | Requis | Description |
|---|---|---|---|
| `file` | File | Oui | Fichier PDF ou EPUB, max 50 Mo |
| `title` | string | Oui | Titre (max 200 car.) |
| `description` | string | Oui | Description (max 2000 car.) |
| `price` | number | Non | Prix en entier (0 = gratuit, défaut 0) |
| `currency` | string | Non | `XAF`, `EUR`, `USD` (défaut `XAF`) |
| `scope` | string | Non | `GLOBAL` ou `SCHOOL` (défaut `GLOBAL`) |
| `schoolId` | string | Cond. | Obligatoire si `scope=SCHOOL` |
| `copyrightAccepted` | string | Oui | Doit être `"true"` |

**Réponse 201** : `{ success: true, data: BookObject }`  
**Erreurs** : `400` validation, `413` fichier trop lourd

---

### Détail d'un livre

```
GET /api/books/:id
```
Les livres non approuvés ne sont visibles que par leur auteur ou un admin.

---

### Modifier un livre (TEACHER — DRAFT seulement)

```
PUT /api/books/:id
Content-Type: application/json
```
```json
{ "title": "...", "description": "...", "price": 0, "currency": "XAF" }
```

---

### Supprimer un livre (TEACHER — DRAFT seulement)

```
DELETE /api/books/:id
```

---

### Mes livres (TEACHER / SCHOOL_ADMIN)

```
GET /api/books/my?page=1&limit=20
```

---

### File de validation (SCHOOL_ADMIN / DG_M4M)

```
GET /api/books/admin/pending
```
- `SCHOOL_ADMIN` → reçoit les livres SCHOOL de ses écoles uniquement.
- `DG_M4M` / `TECH_SUPPORT` → reçoit **tous** les livres en attente (GLOBAL + toutes les écoles).

---

### Approuver un livre

```
POST /api/books/:id/approve
```
- `SCHOOL_ADMIN` : uniquement les livres `SCHOOL` de son école.
- `DG_M4M` / `TECH_SUPPORT` : n'importe quel livre (GLOBAL ou SCHOOL, toutes écoles).

**Erreurs** : `403` permission insuffisante, `409` déjà traité

---

### Rejeter un livre

```
POST /api/books/:id/reject
Content-Type: application/json
```
```json
{ "comment": "Le contenu ne respecte pas les standards pédagogiques." }
```
Le `comment` est obligatoire et visible par l'enseignant.

---

### Accès / téléchargement

```
GET /api/books/:id/access
```
Vérifie les droits (gratuit = accès direct, payant = vérification achat).

**Réponse 200** :
```json
{ "success": true, "data": { "downloadUrl": "books/nom-du-fichier.pdf" } }
```
**Erreur 403** : livre non acheté.

---

### Initier un achat (STUDENT)

```
POST /api/books/:id/purchase
Content-Type: application/json
```
```json
{ "callbackUrl": "https://app.xkorienta.com/bibliotheque/ID?purchased=1" }
```

**Réponse 201** :
```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://pay.notchpay.co/...",
    "reference": "BOOK-XYZ-ABCD1234",
    "provider": "notchpay",
    "originalPrice": 2000,
    "discountPercent": 10,
    "finalAmount": 1800,
    "currency": "XAF"
  }
}
```
→ Rediriger l'utilisateur vers `paymentUrl`.

**Erreurs** : `409` déjà acheté, `400` livre gratuit / non disponible

---

### Webhook paiement (NotchPay → serveur)

```
POST /api/books/purchase/webhook
```
Reçoit les notifications NotchPay. Pas d'authentification — signature HMAC vérifiée en interne.  
**Ne pas appeler depuis le frontend.**

---

### Livres achetés (STUDENT)

```
GET /api/books/purchased?page=1&limit=20
```

---

### Configuration plateforme (DG_M4M)

```
GET  /api/admin/books/config
PUT  /api/admin/books/config
```

**Body PUT** :
```json
{
  "commissionRate": 5,
  "discountRules": [
    { "minLevel": 1,  "maxLevel": 5,   "discountPercent": 0  },
    { "minLevel": 6,  "maxLevel": 10,  "discountPercent": 10 },
    { "minLevel": 11, "maxLevel": 20,  "discountPercent": 20 },
    { "minLevel": 21, "maxLevel": 999, "discountPercent": 30 }
  ],
  "maxFileSizeBytes": 52428800,
  "storageProvider": "local",
  "paymentProvider": "notchpay"
}
```

---

## Modèle Book

```typescript
{
  _id: string
  title: string                   // max 200 car.
  description: string             // max 2000 car.
  format: "PDF" | "EPUB"
  fileKey: string                 // clé opaque de stockage (interne)
  coverImageKey?: string
  price: number                   // 0 = gratuit
  currency: string                // "XAF" | "EUR" | "USD"
  scope: "GLOBAL" | "SCHOOL"
  schoolId?: string
  submittedBy: { _id, name, image }
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
  validatedBy?: string
  validationComment?: string      // visible si REJECTED
  validatedAt?: string
  copyrightAccepted: boolean
  downloadCount: number
  purchaseCount: number
  createdAt: string
  updatedAt: string
}
```

---

## Statuts d'un livre

```
DRAFT    → Brouillon, non encore soumis (éditable / supprimable)
PENDING  → En attente de validation admin
APPROVED → Publié et accessible
REJECTED → Refusé (validationComment explique la raison)
```

---

## Système de remises

Les remises sont calculées automatiquement depuis `BookConfig.discountRules` selon le niveau gamification de l'utilisateur (`user.gamification.level`).

Configuration par défaut :

| Niveau | Remise |
|---|---|
| 1 – 5 | 0 % |
| 6 – 10 | 10 % |
| 11 – 20 | 20 % |
| 21 + | 30 % |

La remise est appliquée **à l'initiation du paiement** et stockée dans `BookPurchase.discountPercent`.

---

## Commission plateforme

Configurable via `BookConfig.commissionRate` (défaut : **5%**).  
Prélevée sur `finalAmount` (après remise) :

```
platformCommission = finalAmount × (commissionRate / 100)
teacherAmount      = finalAmount - platformCommission
```

---

## Paiement NotchPay

**Variables d'environnement requises** (côté API) :

```env
NOTCHPAY_PUBLIC_KEY=pk_xxxxx
NOTCHPAY_HASH=your_webhook_hash_secret
```

**Flux** :
1. `POST /api/books/:id/purchase` → API crée un `BookPurchase` PENDING + appelle NotchPay
2. API retourne `{ paymentUrl }` → frontend redirige l'utilisateur
3. Utilisateur paie sur NotchPay
4. NotchPay envoie `POST /api/books/purchase/webhook` (signature HMAC)
5. API met à jour `BookPurchase.status` → COMPLETED
6. Utilisateur accède au livre via `GET /api/books/:id/access`

---

## Stockage des fichiers (Strategy Pattern)

Le provider est configurable dans `BookConfig.storageProvider` :

| Provider | Valeur | Prêt |
|---|---|---|
| Filesystem local | `local` | Oui (MVP) |
| AWS S3 / MinIO | `s3` | Scaffold (nécessite `@aws-sdk/client-s3`) |
| Cloudflare R2 | `cloudflare_r2` | Scaffold (route vers S3Strategy) |

Pour passer en production : changer `storageProvider` via `PUT /api/admin/books/config` — aucun changement de code nécessaire.

---

## Pages frontend

| Route | Rôle | Auth |
|---|---|---|
| `/bibliotheque` | Catalogue public | Non |
| `/student/bibliotheque` | Catalogue étudiant + remises + achats | Oui (STUDENT) |
| `/teacher/bibliotheque` | Mes livres soumis | Oui (TEACHER) |
| `/teacher/bibliotheque/publier` | Formulaire de soumission | Oui (TEACHER) |
| `/admin/bibliotheque` | File de validation | Oui (SCHOOL_ADMIN / DG_M4M) |

---

## Variables d'environnement

```env
# API
NOTCHPAY_PUBLIC_KEY=pk_xxxxx
NOTCHPAY_HASH=your_webhook_hash_secret

# Optionnel si passage à S3
AWS_BUCKET=quizlock-books
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
```
