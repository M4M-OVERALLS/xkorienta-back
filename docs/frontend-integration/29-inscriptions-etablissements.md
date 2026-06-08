# Module 29 — Inscriptions aux établissements

> **Audience** : Équipe frontend  
> **Base URL backend** : `{{baseUrl}}` (ex: `http://localhost:3001`)  
> **Auth** : Mixte — liste/détail publics ; candidature + paiement acceptent anonymes (`guestEmail`) ou session NextAuth  
> **Paiement** : NotchPay (Mobile Money / Carte)  
> **Dernière mise à jour** : juin 2026

---

## Vue d'ensemble

Le module **Inscriptions** permet aux candidats de postuler à des établissements scolaires via des **fiches d'inscription** publiées par les admins d'école. Chaque fiche définit :

- un **formulaire dynamique** (champs candidat + parent),
- des **domaines / filières** à choisir,
- une **liste de documents** à fournir,
- un **prix** (frais d'inscription en FCFA).

Le parcours se termine par un **paiement NotchPay**. Après paiement, l'établissement peut **approuver** ou **rejeter** la candidature.

### Deux modes candidat

| Mode               | Auth                                        | Email requis                          | Suivi dossier             | Lien post-login                           |
| ------------------ | ------------------------------------------- | ------------------------------------- | ------------------------- | ----------------------------------------- |
| **Public (guest)** | Aucune                                      | `guestEmail` dans le body apply + pay | Email + page confirmation | Auto-lié au compte si même email au login |
| **Connecté**       | Session NextAuth (`credentials: 'include'`) | Email session                         | `/student/inscriptions`   | Candidatures liées à `userId`             |

---

## Flux utilisateur complet

### Mode public (non connecté)

```
/inscriptions                          [GET /api/inscriptions/forms]
  └─ Clic fiche → /inscriptions/:formId   [GET /api/inscriptions/forms/:id]
       └─ CTA → /inscriptions/:formId/apply
            1. Infos candidat (+ saisie guestEmail)
            2. Infos parent (si champs group="parent")
            3. Choix domaines / filières
            4. Upload documents [POST /api/inscriptions/applications/upload-doc]
            5. Récapitulatif → Submit + Pay
                 ├─ [POST /api/inscriptions/forms/:id/apply]  → applicationId
                 └─ [POST /api/inscriptions/applications/:id/pay]  → paymentUrl
                      └─ Redirect NotchPay
                           └─ Retour → /inscriptions/confirmation?appId=...
                                ├─ [POST confirm-payment] (si status=complete dans URL)
                                └─ [GET status] polling jusqu'à PAID
                                     └─ CTA "Créer un compte" → /register
```

### Mode connecté (étudiant)

```
/student/inscriptions                  [auth requise]
  ├─ Onglet "Établissements disponibles"  → GET /api/inscriptions/forms
  └─ Onglet "Mes candidatures"            → GET /api/inscriptions/applications/mine
       └─ Clic "Candidater" → /inscriptions/:formId/apply
            (même wizard — nom/email pré-remplis depuis session)
            └─ Après paiement → /student/inscriptions
```

> ℹ️ Les routes `/inscriptions/*` sont **publiques** (pas de layout dashboard). Le dashboard `/student/inscriptions` redirige vers `/login` si non authentifié.

---

## 1. Catalogue public — fiches publiées

### GET /api/inscriptions/forms

Liste paginée des fiches **PUBLISHED**, **ouvertes** (`opensAt ≤ now ≤ closesAt`), triées par deadline (`closesAt` ASC).

```
GET /api/inscriptions/forms?page=1&limit=12&search=lycee
```

**Auth** : Aucune

#### Query params

| Param      | Type     | Défaut | Description                                      |
| ---------- | -------- | ------ | ------------------------------------------------ |
| `page`     | `number` | `1`    | Page (min 1)                                     |
| `limit`    | `number` | `20`   | Taille page (max 50)                             |
| `search`   | `string` | —      | Filtre regex sur `title` (insensible à la casse) |
| `schoolId` | `string` | —      | Filtrer par école                                |
| `priceMin` | `number` | —      | Prix minimum (FCFA)                              |
| `priceMax` | `number` | —      | Prix maximum (FCFA)                              |

#### Réponse `200`

```json
{
  "success": true,
  "data": {
    "forms": [
      {
        "_id": "674a1b2c3d4e5f6a7b8c9d0e",
        "title": "Inscription Terminale 2026",
        "description": "Session d'admission...",
        "status": "PUBLISHED",
        "price": 15000,
        "currentCandidates": 42,
        "maxCandidates": 100,
        "opensAt": "2026-01-01T00:00:00.000Z",
        "closesAt": "2026-08-31T23:59:59.000Z",
        "schoolId": {
          "_id": "...",
          "name": "Lycée Exemple",
          "logoUrl": "https://...",
          "city": { "name": "Douala" }
        },
        "createdAt": "2026-01-15T10:00:00.000Z"
      }
    ],
    "total": 24,
    "page": 1,
    "limit": 12,
    "totalPages": 2
  }
}
```

#### Intégration frontend

```typescript
import { inscriptionsApi } from "@/lib/api-client";

const res = await inscriptionsApi.listPublished({
  page: 1,
  limit: 12,
  search: "douala",
});
const { forms, total, totalPages } = (res.data as { data: ListResponse }).data;
```

---

## 2. Détail d'une fiche

### GET /api/inscriptions/forms/:id

Retourne la fiche complète avec **champs dynamiques**, **documents requis** et **groupes de domaines**. Enrichi avec `spotsLeft` si `maxCandidates` est défini.

```
GET /api/inscriptions/forms/674a1b2c3d4e5f6a7b8c9d0e
```

**Auth** : Aucune

#### Réponse `200`

```json
{
  "success": true,
  "data": {
    "_id": "674a1b2c3d4e5f6a7b8c9d0e",
    "title": "Inscription Terminale 2026",
    "description": "...",
    "status": "PUBLISHED",
    "price": 15000,
    "currentCandidates": 42,
    "maxCandidates": 100,
    "spotsLeft": 58,
    "opensAt": "2026-01-01T00:00:00.000Z",
    "closesAt": "2026-08-31T23:59:59.000Z",
    "formFields": [
      {
        "id": "nom_complet",
        "type": "TEXT",
        "label": "Nom complet",
        "required": true,
        "options": [],
        "group": null
      },
      {
        "id": "serie",
        "type": "SELECT",
        "label": "Série",
        "required": true,
        "options": ["C", "D", "TI"],
        "group": null
      },
      {
        "id": "tel_parent",
        "type": "TEXT",
        "label": "Téléphone du parent",
        "required": false,
        "options": [],
        "group": "parent"
      }
    ],
    "docsRequired": [
      "Acte de naissance",
      "Relevé de notes",
      "Photo d'identité"
    ],
    "domainGroups": [
      {
        "name": "Sciences",
        "fields": [
          "Filière Scientifique : Génie Logiciel | Réseaux | Cybersécurité",
          "Filière Médicale : Médecine | Pharmacie"
        ]
      }
    ],
    "schoolId": {
      "_id": "...",
      "name": "Lycée Exemple",
      "logoUrl": "https://...",
      "city": { "name": "Douala" }
    }
  }
}
```

#### Types de champs (`FormFieldType`)

| Type             | Rendu frontend                  | Valeur dans `candidateData` / `parentData`        |
| ---------------- | ------------------------------- | ------------------------------------------------- |
| `TEXT`           | `<input type="text">`           | `string`                                          |
| `SELECT`         | `<select>`                      | `string` (une option)                             |
| `CHECKBOX_GROUP` | Cases à cocher multiples        | `string[]`                                        |
| `FILE`           | Upload séparé (étape documents) | Non utilisé dans formFields — voir `docsRequired` |

**Convention groupes** :

- Champs **sans** `group` ou `group !== "parent"` → `candidateData[field.id]`
- Champs `group: "parent"` → `parentData[field.id]`

**Convention domaines** : chaque entrée de `domainGroups[].fields` suit le format :

```
"Filière X : spécialité1 | spécialité2 | spécialité3"
```

Le frontend parse le texte après `:` (séparateur `|`) pour afficher les checkboxes. Les valeurs sélectionnées vont dans `domainChoices: string[]` (noms des spécialités).

#### Codes d'erreur

| Status | Code      | Cause             |
| ------ | --------- | ----------------- |
| `404`  | `INS_001` | Fiche introuvable |

---

## 3. Upload de documents

### POST /api/inscriptions/applications/upload-doc

Upload **avant** la soumission finale. Les URLs retournées sont incluses dans `docsUploaded` au moment du `apply`.

```
POST /api/inscriptions/applications/upload-doc
Content-Type: multipart/form-data
```

**Auth** : Optionnelle (anonymes autorisés)

#### Body (multipart)

| Champ     | Type     | Requis | Description                                  |
| --------- | -------- | ------ | -------------------------------------------- |
| `file`    | `File`   | Oui    | PDF, JPG, PNG ou WebP — max **10 MB**        |
| `fieldId` | `string` | Oui    | Identifiant stable (ex: `acte_de_naissance`) |

#### Réponse `201`

```json
{
  "success": true,
  "data": {
    "fieldId": "acte_de_naissance",
    "fileUrl": "http://localhost:3001/uploads/inscriptions/acte_de_naissance-a1b2c3d4.pdf",
    "fileName": "acte.pdf",
    "size": 245760
  }
}
```

#### Intégration frontend

```typescript
const fd = new FormData();
fd.append("file", file);
fd.append("fieldId", docName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase());

const res = await fetch("/api/inscriptions/applications/upload-doc", {
  method: "POST",
  credentials: "include",
  body: fd,
});
```

> Les documents ne sont **pas obligatoires** pour soumettre — l'établissement peut demander les pièces manquantes ensuite.

---

## 4. Soumettre une candidature

### POST /api/inscriptions/forms/:id/apply

Crée une candidature en statut `SUBMITTED` + `paymentStatus: PENDING`. Incrémente `currentCandidates` sur la fiche.

```
POST /api/inscriptions/forms/:formId/apply
Content-Type: application/json
```

**Auth** : Optionnelle — si pas de session, **`guestEmail` obligatoire**

#### Body

```json
{
  "guestEmail": "candidat@example.com",
  "candidateData": {
    "nom_complet": "Jean Dupont",
    "serie": "C"
  },
  "parentData": {
    "tel_parent": "+237612345678"
  },
  "domainChoices": ["Génie Logiciel", "Médecine"],
  "docsUploaded": [
    {
      "fieldId": "acte_de_naissance",
      "fileUrl": "http://localhost:3001/uploads/inscriptions/acte-xxx.pdf",
      "uploadedAt": "2026-06-08T14:30:00.000Z"
    }
  ]
}
```

| Champ           | Type       | Requis          | Description                                      |
| --------------- | ---------- | --------------- | ------------------------------------------------ |
| `guestEmail`    | `string`   | Si non connecté | Email de suivi — lié au compte au prochain login |
| `candidateData` | `object`   | Oui             | Clés = `formFields[].id` (hors parent)           |
| `parentData`    | `object`   | Non             | Clés = champs `group: "parent"`                  |
| `domainChoices` | `string[]` | Non             | Spécialités sélectionnées                        |
| `docsUploaded`  | `array`    | Non             | Docs uploadés préalablement                      |

> Si l'utilisateur est **connecté**, omettre `guestEmail` — le backend utilise `session.user.id`.

#### Réponse `201`

```json
{
  "success": true,
  "data": {
    "_id": "674b2c3d4e5f6a7b8c9d0e1f",
    "inscriptionFormId": "674a1b2c3d4e5f6a7b8c9d0e",
    "schoolId": "...",
    "userId": "...",
    "guestEmail": null,
    "candidateData": { "nom_complet": "Jean Dupont" },
    "parentData": {},
    "domainChoices": ["Génie Logiciel"],
    "docsUploaded": [],
    "appStatus": "SUBMITTED",
    "paymentStatus": "PENDING",
    "submittedAt": "2026-06-08T14:35:00.000Z",
    "createdAt": "2026-06-08T14:35:00.000Z"
  }
}
```

#### Règles métier (validées côté serveur)

| Règle                            | Code erreur | HTTP |
| -------------------------------- | ----------- | ---- |
| Fiche inexistante                | `INS_001`   | 404  |
| Fiche non publiée ou hors dates  | `INS_002`   | 400  |
| Capacité max atteinte            | `INS_003`   | 409  |
| Doublon (même user + même fiche) | `INS_004`   | 409  |
| Ni session ni `guestEmail`       | —           | 400  |

#### Intégration frontend

```typescript
const payload = { candidateData, parentData, domainChoices, docsUploaded };
if (!session?.user) payload.guestEmail = guestEmail;

const res = await inscriptionsApi.apply(formId, payload);
const applicationId = (res.data as { data: { _id: string } }).data._id;
```

---

## 5. Initier le paiement

### POST /api/inscriptions/applications/:id/pay

Après `apply`, initie le paiement NotchPay et retourne l'URL de redirection.

```
POST /api/inscriptions/applications/:applicationId/pay
Content-Type: application/json
```

**Auth** : Optionnelle — email requis via session ou `guestEmail`

#### Body

```json
{
  "callbackUrl": "https://app.xkorin.com/inscriptions/confirmation?appId=674b2c3d4e5f6a7b8c9d0e1f",
  "paymentCurrency": "XAF",
  "guestEmail": "candidat@example.com"
}
```

| Champ             | Type     | Requis          | Description                           |
| ----------------- | -------- | --------------- | ------------------------------------- |
| `callbackUrl`     | `string` | **Oui**         | URL de retour après paiement NotchPay |
| `paymentCurrency` | `string` | Non             | Défaut `XAF`                          |
| `guestEmail`      | `string` | Si non connecté | Même email que lors du `apply`        |

#### Réponse `201`

```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://pay.notchpay.co/...",
    "reference": "INS-GUEST-abc123-xyz",
    "finalAmount": 15000,
    "currency": "XAF"
  }
}
```

#### Comportement selon le mode

| Mode         | Mécanisme backend                                              | Webhook                                                 |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| **Connecté** | `paymentSDK.payments.initiatePayment` — crée une `Transaction` | Webhook EventBus met à jour `appStatus → PAID`          |
| **Guest**    | Appel direct provider NotchPay (`INS-GUEST-...`)               | Pas de Transaction — confirmation via `confirm-payment` |

#### Flux frontend

```typescript
const callbackUrl = `${window.location.origin}/inscriptions/confirmation?appId=${applicationId}`;

const payRes = await fetch(
  `/api/inscriptions/applications/${applicationId}/pay`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      callbackUrl,
      ...(guestEmail ? { guestEmail } : {}),
    }),
  },
);

const { data } = await payRes.json();
window.location.href = data.paymentUrl;
```

#### Préconditions

- `appStatus` doit être `SUBMITTED`
- `paymentStatus` doit être `PENDING`
- La fiche doit encore être ouverte

---

## 6. Confirmation et suivi du paiement

### GET /api/inscriptions/applications/:id/status

Polling public du statut après retour NotchPay.

```
GET /api/inscriptions/applications/:applicationId/status
```

**Auth** : Aucune (l'ID d'application sert d'identifiant)

#### Réponse `200`

```json
{
  "success": true,
  "data": {
    "appStatus": "PAID",
    "paymentStatus": "PAID",
    "paymentRef": "INS-GUEST-abc123-xyz",
    "paidAt": "2026-06-08T14:40:00.000Z"
  }
}
```

#### Logique de polling (recommandée)

```
Toutes les 2s, max 10 tentatives :
  SI appStatus === "PAID" OU paymentStatus === "PAID" → succès
  SI paymentStatus === "FAILED" OU appStatus === "CANCELLED" → échec
  SINON → continuer
```

### POST /api/inscriptions/applications/:id/confirm-payment

**Requis pour les paiements guest** quand NotchPay renvoie `status=complete` dans l'URL de callback.

```
POST /api/inscriptions/applications/:applicationId/confirm-payment
Content-Type: application/json
```

#### Body

```json
{
  "reference": "INS-GUEST-abc123-xyz",
  "status": "complete"
}
```

| Champ       | Type     | Description                                                    |
| ----------- | -------- | -------------------------------------------------------------- |
| `reference` | `string` | Lire depuis query : `trxref`, `reference` ou `notchpay_trxref` |
| `status`    | `string` | Doit être `"complete"`                                         |

#### Réponse `200`

```json
{
  "success": true,
  "data": {
    "appStatus": "PAID",
    "paymentStatus": "PAID",
    "paidAt": "2026-06-08T14:40:00.000Z"
  }
}
```

> Endpoint **idempotent** — si déjà `PAID`, retourne le statut actuel sans erreur. Génère aussi une **facture** (reçu d'inscription) de façon non-bloquante.

#### Séquence confirmation (page `/inscriptions/confirmation`)

```
1. Lire appId depuis ?appId=
2. SI URL contient status=complete ET une reference NotchPay :
     → POST confirm-payment
     → SI PAID → afficher succès
     → SINON → démarrer polling GET status
3. SINON → polling GET status directement
```

---

## 7. Mes candidatures (mode connecté)

### GET /api/inscriptions/applications/mine

Liste paginée des candidatures de l'étudiant connecté.

```
GET /api/inscriptions/applications/mine?page=1&limit=10
```

**Auth** : **Requise** (session NextAuth)

#### Réponse `200`

```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "_id": "674b2c3d4e5f6a7b8c9d0e1f",
        "appStatus": "PAID",
        "paymentStatus": "PAID",
        "domainChoices": ["Génie Logiciel"],
        "submittedAt": "2026-06-08T14:35:00.000Z",
        "paidAt": "2026-06-08T14:40:00.000Z",
        "createdAt": "2026-06-08T14:35:00.000Z",
        "inscriptionFormId": {
          "title": "Inscription Terminale 2026",
          "price": 15000,
          "closesAt": "2026-08-31T23:59:59.000Z"
        },
        "schoolId": {
          "name": "Lycée Exemple",
          "logoUrl": "https://..."
        }
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

#### Intégration frontend

```typescript
const res = await inscriptionsApi.myApplications({ page: 1, limit: 10 });
const { applications, total, totalPages } = (
  res.data as { data: ApplicationsResponse }
).data;
```

#### Lien candidatures guest → compte

Au **login** (callback JWT NextAuth), le backend appelle automatiquement :

```
SchoolApplicationService.linkGuestApplications(email, userId)
```

Toute candidature avec `guestEmail === email` et sans `userId` est rattachée au compte. Aucun appel frontend requis.

---

## 8. Machine à états

### Statuts fiche (`InscriptionFormStatus`)

```
DRAFT → PUBLISHED → CLOSED
                  ↘ ARCHIVED (futur)
```

Seules les fiches `PUBLISHED` dans la fenêtre `opensAt`–`closesAt` apparaissent dans le catalogue public.

### Statuts candidature (`ApplicationStatus`)

```
SUBMITTED → PAID → APPROVED
              ↘      ↘
            CANCELLED  REJECTED
```

| Statut      | Label UI (référence) | Signification                          |
| ----------- | -------------------- | -------------------------------------- |
| `SUBMITTED` | Soumise              | Candidature créée, paiement en attente |
| `PAID`      | Payée                | Paiement confirmé, en attente de revue |
| `APPROVED`  | Approuvée            | Acceptée par l'établissement           |
| `REJECTED`  | Refusée              | Refusée par l'établissement            |
| `CANCELLED` | Annulée              | Annulée (candidat ou système)          |

### Statuts paiement (`PaymentStatus`)

| Valeur     | Description                     |
| ---------- | ------------------------------- |
| `PENDING`  | Paiement non initié ou en cours |
| `PAID`     | Paiement réussi                 |
| `FAILED`   | Paiement échoué                 |
| `REFUNDED` | Remboursé                       |

---

## 9. Pages & routes frontend

### Routes publiques

| Route                         | API utilisées                                                 | Auth        |
| ----------------------------- | ------------------------------------------------------------- | ----------- |
| `/inscriptions`               | `GET /forms`                                                  | Aucune      |
| `/inscriptions/:formId`       | `GET /forms/:id`                                              | Aucune      |
| `/inscriptions/:formId/apply` | `GET /forms/:id`, `POST upload-doc`, `POST apply`, `POST pay` | Optionnelle |
| `/inscriptions/confirmation`  | `POST confirm-payment`, `GET status`                          | Aucune      |

### Routes dashboard étudiant

| Route                   | API utilisées                          | Auth        |
| ----------------------- | -------------------------------------- | ----------- |
| `/student/inscriptions` | `GET /forms`, `GET /applications/mine` | **Requise** |

| État session      | Comportement `/student/inscriptions`     |
| ----------------- | ---------------------------------------- |
| `loading`         | Spinner                                  |
| `unauthenticated` | Redirect `/login`                        |
| `authenticated`   | 2 onglets : catalogue + mes candidatures |

Le lien « Candidater » depuis le dashboard pointe vers `/inscriptions/:formId/apply` (wizard public partagé).

---

## 10. Wrapper `inscriptionsApi`

Référence complète dans `src/lib/api-client.ts` :

```typescript
export const inscriptionsApi = {
  // ── Public / Candidat ──
  listPublished: (params?) => GET  /api/inscriptions/forms
  getForm:       (id)      => GET  /api/inscriptions/forms/:id
  apply:         (formId, data) => POST /api/inscriptions/forms/:formId/apply
  myApplications: (params?) => GET  /api/inscriptions/applications/mine  // auth

  // ── Admin école (hors scope candidat) ──
  createForm, updateForm, publishForm, closeForm,
  getSchoolForms, adminApplications, adminUpdateApplication,
}
```

Toutes les requêtes passent par `credentials: 'include'` pour transmettre le cookie de session NextAuth.

---

## 11. Codes d'erreur inscription

Les erreurs métier utilisent le format `BaseApplicationError.toJSON()` :

```json
{
  "error": {
    "code": "INS_004",
    "message": "Vous avez déjà soumis une candidature pour cet établissement",
    "httpStatus": 409
  }
}
```

| Code      | HTTP | Message FR                                  |
| --------- | ---- | ------------------------------------------- |
| `INS_001` | 404  | Fiche d'inscription introuvable             |
| `INS_002` | 400  | Cette inscription est fermée ou expirée     |
| `INS_003` | 409  | Capacité maximale atteinte                  |
| `INS_004` | 409  | Candidature déjà soumise (doublon)          |
| `INS_005` | 400  | Seul un brouillon peut être modifié         |
| `INS_006` | 400  | Transition de statut invalide               |
| `INS_007` | 400  | Champs obligatoires manquants (publication) |
| `INS_008` | 403  | Accès non autorisé                          |
| `INS_009` | 400  | Document requis manquant                    |
| `INS_010` | 404  | Pas de fiche publiée pour cet établissement |

---

## 12. Variables d'environnement

**Backend (`xkorienta-api/.env`)** :

| Variable       | Description                            |
| -------------- | -------------------------------------- |
| `NOTCHPAY_*`   | Clés API NotchPay (via `paymentSDK`)   |
| `APP_BASE_URL` | URL absolue pour les fichiers uploadés |
| `NEXTAUTH_URL` | Fallback pour URL absolue uploads      |

**Frontend (`xkorienta-app/.env`)** :

| Variable              | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | URL backend pour le proxy (`next.config.ts` rewrites) |

Le proxy Next.js redirige `/api/*` (sauf `/api/auth/*`) vers le backend — le frontend appelle toujours des **URLs relatives** (`/api/inscriptions/...`).

---

## 13. Checklist intégration

- [ ] Backend démarré sur port 3001
- [ ] Frontend démarré sur port 3000 avec `NEXT_PUBLIC_API_URL=http://localhost:3001`
- [ ] Proxy `/api/inscriptions/*` → backend configuré (`next.config.ts` rewrites)
- [ ] Au moins une fiche `PUBLISHED` avec dates valides en base
- [ ] NotchPay configuré (sandbox ou prod) pour tester le paiement
- [ ] Mode guest : champ `guestEmail` sur apply **et** pay
- [ ] `callbackUrl` inclut `?appId=` pour la page confirmation
- [ ] Polling `GET status` + `POST confirm-payment` pour guests
- [ ] Upload docs via `multipart/form-data` (pas JSON)
- [ ] Gestion erreurs `INS_00x` affichée à l'utilisateur
- [ ] Mode connecté : `credentials: 'include'` sur tous les appels

---

## 14. Test rapide

### Catalogue (curl)

```bash
curl "http://localhost:3001/api/inscriptions/forms?page=1&limit=5"
```

### Détail fiche

```bash
curl "http://localhost:3001/api/inscriptions/forms/<FORM_ID>"
```

### Candidature guest

```bash
curl -X POST "http://localhost:3001/api/inscriptions/forms/<FORM_ID>/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "guestEmail": "test@example.com",
    "candidateData": { "nom_complet": "Test Candidat" },
    "domainChoices": ["Génie Logiciel"]
  }'
```

### Initier paiement

```bash
curl -X POST "http://localhost:3001/api/inscriptions/applications/<APP_ID>/pay" \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "http://localhost:3000/inscriptions/confirmation?appId=<APP_ID>",
    "guestEmail": "test@example.com"
  }'
```

### Mes candidatures (session cookie requis)

```bash
curl "http://localhost:3001/api/inscriptions/applications/mine?page=1&limit=10" \
  -H "Cookie: next-auth.session-token=<TOKEN>"
```

---

## Annexe — Endpoints admin école (référence)

Ces endpoints sont utilisés par `/school-admin/inscriptions/*` — **non requis** pour le parcours candidat.

| Méthode | Endpoint                                   | Auth | Rôle                     |
| ------- | ------------------------------------------ | ---- | ------------------------ |
| `POST`  | `/api/inscriptions/forms`                  | Oui  | Créer fiche (DRAFT)      |
| `PUT`   | `/api/inscriptions/forms/:id`              | Oui  | Modifier fiche           |
| `POST`  | `/api/inscriptions/forms/:id/publish`      | Oui  | Publier                  |
| `POST`  | `/api/inscriptions/forms/:id/close`        | Oui  | Fermer                   |
| `GET`   | `/api/inscriptions/admin/forms`            | Oui  | Fiches de l'école        |
| `GET`   | `/api/inscriptions/admin/applications`     | Oui  | Candidatures d'une fiche |
| `PATCH` | `/api/inscriptions/admin/applications/:id` | Oui  | Approuver / rejeter      |
