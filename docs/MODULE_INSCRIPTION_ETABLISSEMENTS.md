# Module — Inscription Établissements

> **Statut** : Analyse validée — prêt pour implémentation  
> **Date** : juin 2026  
> **Référence** : Fiche ISIMMA v2 (OR-FICHE D'ORIENTATION ET DE CHOIX DES FORMATIONS & DE PRÉ-INSCRIPTION v2.md)

---

## 1. Acteurs

| Acteur | Accès | Rôle |
|---|---|---|
| **Admin École** | Dashboard → Inscriptions | Crée/publie la fiche, fixe le prix, consulte candidatures + factures |
| **Apprenant anonyme** | `/inscriptions` (public) | Parcourt, remplit, paie sans compte |
| **Apprenant connecté** | Sidebar student → Inscriptions | Idem + info pré-remplie, historique dans le compte |
| **Platform Admin** | Back-office | Configure taux de commission, gère litiges, déclenche virements |

---

## 2. Modèles de Données

### 2.1 `InscriptionForm` *(nouvelle collection)*

```typescript
{
  schoolId         : ObjectId → School
  title            : string          // "Pré-inscription 2025-2026"
  status           : "draft" | "published" | "closed" | "archived"
  formFields       : FormField[]     // voir 2.3
  docsRequired     : string[]        // ["acte_naissance","diplome","cni","photo_4x4"]
  price            : number          // FCFA — fixé par l'école
  commissionRate   : number          // % snapshot au moment de la publication
  opensAt          : Date
  closesAt         : Date
  maxCandidates    : number | null   // null = illimité
  description      : string
  createdBy        : ObjectId → User
}
```

### 2.2 `SchoolApplication` *(nouvelle collection)*

```typescript
{
  inscriptionFormId : ObjectId → InscriptionForm
  schoolId          : ObjectId → School
  userId            : ObjectId → User | null    // null si anonyme
  guestEmail        : string | null             // anonyme uniquement
  candidateData     : Record<string, unknown>   // réponses du formulaire
  docsUploaded      : { field: string, fileUrl: string, uploadedAt: Date }[]
  domainChoices     : string[]
  paymentStatus     : "pending" | "paid" | "failed" | "refunded"
  paymentRef        : string                    // référence NotchPay
  transactionId     : ObjectId → Transaction | null
  invoiceId         : ObjectId → Invoice | null
  appStatus         : "draft" | "submitted" | "paid" | "approved" | "rejected" | "cancelled"
  submittedAt       : Date
  paidAt            : Date | null
}
```

### 2.3 `FormField`

```typescript
{
  id       : string
  type     : "text" | "select" | "checkbox_group" | "file"
  label    : string
  required : boolean
  options  : string[]   // pour select et checkbox_group
}
```

### 2.4 Enums à ajouter dans `enums.ts`

```typescript
// TransactionType
SCHOOL_INSCRIPTION = "SCHOOL_INSCRIPTION"

// InvoiceType
SCHOOL_INSCRIPTION = "SCHOOL_INSCRIPTION"
```

---

## 3. Modèle de Commission

```
Prix étudiant          : 50 000 FCFA  (fixé par l'école)
Commission plateforme  : 5%  = 2 500 FCFA  (taux fixé par platform-admin)
Net école              : 47 500 FCFA

Règles :
- Taux fixé par platform-admin uniquement (pas l'école)
- Snapshot du taux dans InscriptionForm à la publication
  → un changement de taux n'affecte pas les candidatures en cours
- Commission incluse dans le prix affiché (pas ajoutée par-dessus)
- Affichage admin : "Vous recevrez 47 500 FCFA par candidature payée"
- Affichage étudiant : "Frais d'inscription : 50 000 FCFA"
```

---

## 4. Flux Normaux

### 4.1 Admin École — Créer et publier une fiche

```
Inscriptions tab → "+ Nouvelle inscription"
  │
  ├─ [A] Création manuelle
  │     Titre → Champs → Domaines → Documents requis → Prix → Aperçu → Publier
  │
  └─ [B] Upload fichier (PDF/Word/Image) + IA
        Upload → Claude parse le document
        → Pré-remplit les champs détectés (step de review OBLIGATOIRE)
        → Admin corrige/valide → Prix → Aperçu → Publier
```

À la publication :
- `status: published`, `opensAt` = maintenant ou date choisie
- La fiche apparaît dans la liste publique

---

### 4.2 Apprenant Anonyme

```
/inscriptions  (page publique)
  └─ Liste établissements  [filtre : région / domaine / prix]
       └─ Détail établissement (price, docs requis, deadline, domaines)
            └─ "Candidater"
                 Étape 1 : Infos candidat  (nom, téléphone, email, série)
                 Étape 2 : Infos parent  (nom, téléphone, email)
                 Étape 3 : Choix domaines/filières  (checkboxes)
                 Étape 4 : Upload documents  (CNI, diplôme, photos…)
                 Étape 5 : Récapitulatif + Prix
                 └─ Paiement NotchPay
                      ├─ Succès
                      │   → /inscriptions/confirmation?ref=XXX
                      │   → "Votre candidature est reçue et payée ✓"
                      │   → Invoice envoyée par email
                      │   → "Retrouvez votre facture dans Paramètres > Factures"
                      │   → CTA "Créer un compte pour suivre votre dossier"
                      │
                      └─ Échec
                          → Page erreur + "Réessayer le paiement"
```

---

### 4.3 Apprenant Connecté

```
Dashboard → Sidebar → "Inscriptions établissements"
  └─ Même liste publique +
       • Infos candidat pré-remplies depuis le profil
       • Doublon détecté automatiquement (même form + même user)
       • Historique de ses candidatures + statuts
       • Factures accessibles dans Paramètres → Factures
```

---

### 4.4 Admin École — Suivi post-publication

```
Dashboard → Inscriptions → [Ma fiche]
  ├─ Onglet "Candidatures"
  │   Filtres : statut | date | domaine
  │   Actions : voir détail dossier, approuver, rejeter, télécharger documents
  │
  └─ Onglet "Factures"
      Montant brut | Commission plateforme | Net reçu
      Statut des virements (en attente / transféré)
      Export CSV
```

---

## 5. Flux Alternatifs & Cas Limites

### 5.1 Anonyme crée un compte après paiement
Au signup/login : si `user.email === application.guestEmail`
→ lier automatiquement toutes les `SchoolApplication` orphelines au compte.

### 5.2 Paiement échoué
- **Anonyme** : email avec lien de reprise (token signé, expire 24h)
- **Connecté** : candidature en "En attente de paiement" + bouton "Finaliser"

### 5.3 Parsing IA insuffisant
Upload réussi → champs partiellement détectés
→ Formulaire pré-rempli avec les champs trouvés, tous éditables
→ Message : *"X champs détectés automatiquement — vérifiez avant de continuer"*

### 5.4 Inscription fermée pendant le remplissage
Bloquer à la soumission (jamais mid-étape), sauvegarder le brouillon
→ Message : *"Cette inscription a fermé le [date]. Vos données sont conservées."*

### 5.5 Capacité maximale atteinte
- Badge "Complet" sur la fiche publique
- Si dernier slot pris pendant le paiement : bloquer + proposer liste d'attente

### 5.6 Candidature en double (connecté)
Détecter via `{ inscriptionFormId, userId, appStatus != cancelled }`
→ Rediriger vers la candidature existante + son statut

### 5.7 Remboursement
Politique définie par l'école à la publication (remboursable / non-remboursable)
Si remboursable + rejet → refund NotchPay + `paymentStatus: refunded` + `appStatus: cancelled`

---

## 6. Problèmes UX Identifiés

### Côté Admin École

| Problème | Solution |
|---|---|
| Formulaire long à créer manuellement | Template ISIMMA pré-chargé, admin ajuste |
| Pas de prévisualisation avant publication | Step "Aperçu" obligatoire avant activation |
| Prix + commission pas clair | Afficher en temps réel : "Vous recevrez X FCFA par candidature" |
| Délais de virement flous | Dashboard "Solde en attente" + date estimée de virement |

### Côté Apprenant

| Problème | Solution |
|---|---|
| Formulaire long sur mobile | Multi-étapes + barre de progression + sauvegarde auto par étape |
| Upload documents sur mobile | Autoriser photo directe (camera) + upload fichier |
| Anonyme ne sait pas où trouver sa facture | Email avec PDF joint + rappel CTA compte |
| Statut "approuvé" immédiat confusant | Dire "Candidature reçue et payée ✓" — l'admission définitive vient de l'école |
| Peur de payer sans garantie | Badge "Paiement sécurisé" + politique remboursement visible avant paiement |

---

## 7. Design Patterns Retenus

### 7.1 Repository *(obligatoire — standard projet)*

```typescript
// InscriptionFormRepository
findPublished(filters)    // liste publique paginée
findBySchool(schoolId)    // admin : ses fiches
findById(id)
create(data) / updateStatus(id, status)

// SchoolApplicationRepository
findByForm(formId, filters)        // admin : candidatures
findByUser(userId)                 // étudiant : ses candidatures
findByGuestEmail(email)            // lien anonyme → compte
findByFormAndUser(formId, userId)  // détection doublon
create(data) / updatePayment(...) / updateStatus(...)
```

### 7.2 Observer *(utile — découplage paiement/facture/email)*

Déclenché par la confirmation de paiement webhook NotchPay :

```typescript
class ApplicationPaidObserver {
    async handle(application: ISchoolApplication) {
        await Promise.all([
            this.invoiceService.createForInscription(application),
            this.emailService.sendConfirmation(application),
            this.notificationService.notifySchoolAdmin(application),
        ])
    }
}
```

Sans ce pattern, le webhook handler devient un bloc couplé à 4 domaines.

### 7.3 State Machine simple *(intégrité des transitions)*

```typescript
const VALID_TRANSITIONS: Record<AppStatus, AppStatus[]> = {
    draft:     ["submitted"],
    submitted: ["paid", "cancelled"],
    paid:      ["approved", "rejected", "cancelled"],
    approved:  ["cancelled"],
    rejected:  [],
    cancelled: [],
}

function transition(current: AppStatus, next: AppStatus): void {
    if (!VALID_TRANSITIONS[current].includes(next))
        throw new ApplicationError(`Transition ${current} → ${next} invalide`)
}
```

Empêche d'approuver une candidature non payée. 15 lignes, pas de librairie externe.

### Patterns NON retenus (over-engineering)

| Pattern | Raison |
|---|---|
| Strategy (parsing IA/manuel) | 2 cas → un `if (hasFile)` suffit |
| Builder (InscriptionForm) | Form construit par UI, pas programmatiquement |
| Factory (Application) | Un seul type, aucune variation |
| Chain of Responsibility | 3-4 validations séquentielles → code linéaire préférable |
| Decorator | Aucun comportement additif identifié |

---

## 8. Routes API (`xkorienta-api`)

```
# Fiches (admin école)
POST   /api/inscriptions/forms                    créer une fiche
PUT    /api/inscriptions/forms/:id                modifier
POST   /api/inscriptions/forms/:id/publish        publier
POST   /api/inscriptions/forms/:id/close          fermer
POST   /api/inscriptions/forms/:id/parse-doc      parser un document via IA

# Fiches (public)
GET    /api/inscriptions/forms                    liste publique paginée + filtrée
GET    /api/inscriptions/forms/:id                détail

# Candidatures (apprenant)
POST   /api/inscriptions/forms/:id/apply          soumettre candidature
POST   /api/inscriptions/applications/:id/pay     initier paiement NotchPay
GET    /api/inscriptions/applications/:id/status  vérifier statut paiement
GET    /api/inscriptions/applications/mine        ses candidatures (connecté)

# Candidatures (admin école)
GET    /api/inscriptions/admin/applications       liste candidatures reçues
PATCH  /api/inscriptions/admin/applications/:id   approuver / rejeter
GET    /api/inscriptions/admin/invoices           ses factures + export CSV
```

---

## 9. Routes Frontend (`xkorienta-app`)

```
# Public
/inscriptions                      liste établissements avec inscriptions ouvertes
/inscriptions/[formId]             détail + CTA "Candidater"
/inscriptions/[formId]/apply       flow multi-étapes (5 étapes)
/inscriptions/confirmation         page succès paiement

# Apprenant connecté
/student/inscriptions              idem public + historique candidatures
/settings                          onglet Factures → inclut factures inscription

# Admin école
/admin/inscriptions                liste de ses fiches
/admin/inscriptions/new            créer / uploader une fiche
/admin/inscriptions/[id]/edit      modifier une fiche
/admin/inscriptions/[id]/candidatures   candidatures reçues
/admin/inscriptions/[id]/factures       factures
```

---

## 10. Intégration avec l'Existant

| Existant | Usage |
|---|---|
| `Invoice` model | Ajouter `InvoiceType.SCHOOL_INSCRIPTION` — structure inchangée |
| `Transaction` model | Ajouter `TransactionType.SCHOOL_INSCRIPTION` |
| Pattern `GuestPurchase` | Réutiliser pour les anonymes (email + paymentRef) |
| Webhook `/api/payments/webhook/notchpay` | Étendre pour `SCHOOL_INSCRIPTION` |
| `checkout/page.tsx` | **Ne pas réutiliser** — flow distinct, créer `/inscriptions/[formId]/apply` |
| `School` model | Aucun changement — `InscriptionForm` référence `schoolId` |
| `XkorientaRegistration` | **Dépréciable** — remplacé par ce module |

---

## 11. Questions à Clarifier Avant Implémentation

1. **Commission incluse ou ajoutée ?** — Recommandation : incluse dans le prix affiché
2. **Virement école : automatique ou sur demande ?** — Impact sur le module `Payout` existant
3. **"Approuvé" = automatique après paiement ou décision école ?** — Recommandation : dire "reçue et payée ✓", l'admission finale vient de l'école
4. **Documents obligatoires avant ou après paiement ?** — Recommandation : avant
5. **Multi-school : un étudiant peut-il postuler à plusieurs écoles simultanément ?**

---

## 12. Séquence de Développement

```
Sprint 1 — Socle données
  ├── Modèles : InscriptionForm, SchoolApplication
  ├── Enums : SCHOOL_INSCRIPTION dans Transaction + Invoice
  ├── Repositories : InscriptionFormRepository, SchoolApplicationRepository
  └── CRUD API fiches (admin) + page admin création manuelle

Sprint 2 — Flow étudiant
  ├── Page publique liste + détail
  ├── Flow apply multi-étapes (5 étapes, sans paiement)
  └── Intégration NotchPay (paiement + webhook + Observer)

Sprint 3 — Facturation + IA
  ├── Génération Invoice (réutiliser l'existant)
  ├── Email confirmation + PDF facture
  ├── Parsing document IA (Claude)
  └── Page admin candidatures + factures + export CSV

Sprint 4 — Compte étudiant + finitions
  ├── Sidebar student "Inscriptions établissements"
  ├── Lien anonyme → compte (email matching)
  ├── Factures inscription dans Paramètres
  └── State machine transitions + tests
```

---

*Source de vérité pour l'implémentation du module inscription. Toute modification structurelle doit être validée avant commit.*
