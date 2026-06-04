# Module 26 — Xkorienta Orientation IA

> **Audience** : Équipe frontend  
> **Base URL backend** : `{{baseUrl}}` (ex: `http://localhost:3001`)  
> **Auth** : Aucune sur l'endpoint chat — public (rate-limit IP)  
> **Feature flag requis** : `FF_ORIENTATION_AI` (env var backend) + `ORIENTATION_AI` (feature plan) pour l'accès dashboard  
> **Dernière mise à jour** : juin 2026

### Fichiers clés backend (`xkorienta-api`)

| Fichier | Rôle |
|---|---|
| `src/app/api/xkorienta/chat/route.ts` | Endpoint SSE — rate limit 40/min/IP, model switching, context trimming |
| `src/lib/ai/prompts/xkorientaSystemPrompt.ts` | System prompt (2 phases) + constantes modèles + `cleanOutput()` |
| `src/lib/ai/orientation/reportPhase.ts` | Détection phase rapport payant (Sonnet vs Haiku) |

### Fichiers clés frontend (`xkorienta-app`)

| Fichier | Rôle |
|---|---|
| `src/types/orientation.ts` | Types + `LEVEL_CONFIGS` (6 niveaux) + `ProfileData` |
| `src/components/orientation/LevelSelector.tsx` | Grille 6 boutons animés (détection auto franco/anglo) |
| `src/components/orientation/XkorientaChat.tsx` | Chat streaming + buffering rapports + commande `/rapport` |
| `src/components/orientation/ReportDisplay.tsx` | `ReportDisplay` (payant, paywall) + `FreeReportDisplay` (gratuit, toujours visible) |
| `src/components/orientation/parseReport.ts` | Parsing des 2 rapports (marqueurs, modules, Xkorin score) |
| `src/components/orientation/generateReportPdf.ts` | `generateReportPdf()` (payant) + `generateFreeReportPdf()` (gratuit) |
| `src/components/orientation/ProfileSidebar.tsx` | Sidebar profil temps réel (dimensions détectées) |
| `src/components/orientation/useProfileDetection.ts` | Hook extraction profil depuis les messages |
| `src/components/orientation/ConversationHistory.tsx` | Historique conversations (localStorage) |
| `src/components/orientation/Toast.tsx` | Notifications toast |
| `src/components/orientation/index.ts` | Barrel exports |
| `src/app/(dashboard)/student/orientation/ai/page.tsx` | Page protégée dashboard |
| `src/app/orientation/page.tsx` | Landing publique + pricing |

---

## Vue d'ensemble

Xkorienta est un agent IA conseiller d'orientation scolaire et professionnelle au Cameroun, ancré dans les programmes officiels **BTS/HND MINESUP 2023**.

La conversation se déroule en **2 phases** et produit **2 rapports** :

| Phase | Contenu | Modèle | Rapport | Accès |
|---|---|---|---|---|
| **Phase 1** — Test de personnalité | 9 questions A/B/C/D, **une par message** | Haiku | `---RAPPORT-GRATUIT---` | Gratuit (tous) |
| **Phase 2** — Orientation détaillée | 7 dimensions (ville, série, notes, aspiration, budget, mobilité, contraintes) | Haiku → Sonnet (rapport) | `---RAPPORT---` (9 modules) | Payant (abonnés) |

### Flux utilisateur complet

```
/orientation (landing publique)
  └─ CTA → /checkout?plan=ELEVE
       └─ après paiement → /student/orientation/ai

/student/orientation/ai  [feature gate: ORIENTATION_AI]
  1. Sélection du niveau (6 boutons)
  2. Message initial envoyé automatiquement
  3. PHASE 1 : Test personnalité (9 questions A/B/C/D, une à la fois)
  4. → Rapport gratuit (profil + domaines + employabilité) — visible par tous, téléchargeable en PDF
  5. PHASE 2 : Conversation orientation (7 dimensions, ~5-7 échanges)
  6. → Rapport payant (9 modules complets) — paywall si non abonné, téléchargeable en PDF
```

### Commande dev `/rapport`

Taper `/rapport` dans le chat injecte un profil fictif complet (Phase 1 + Phase 2) et déclenche la génération des 2 rapports. Le profil fictif inclut :
- 3 lots de réponses personnalité + rapport gratuit simulé dans l'historique
- 7 dimensions pré-remplies (Douala, Terminale C, 14/20, Génie Logiciel, etc.)
- Bypass paywall automatique pour le dev

---

## 1. Endpoint Chat

### POST /api/xkorienta/chat

Endpoint de chat conversationnel avec réponse en **Server-Sent Events (SSE)**.

```
POST /api/xkorienta/chat
Content-Type: application/json
```

**Auth** : Aucune  
**Rate limit** : 40 requêtes / minute / IP  
**Réponse** : `text/event-stream`

#### Body

```json
{
  "messages": [
    { "role": "user", "content": "Bonjour ! Je suis en Terminale..." },
    { "role": "assistant", "content": "Avant ton orientation, un test rapide 🎯 Q1..." },
    { "role": "user", "content": "A, B, A" }
  ],
  "level": "TERMINALE_BAC",
  "language": "fr"
}
```

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `messages` | `array` | 1–100 items | Historique complet de la conversation |
| `messages[].role` | `string` | `"user"` \| `"assistant"` | Rôle du message |
| `messages[].content` | `string` | 1–32000 chars | Contenu du message |
| `level` | `string` | voir valeurs ci-dessous | Niveau scolaire sélectionné |
| `language` | `string` | `"fr"` \| `"en"` | Langue de la conversation |

**Valeurs `level`** :

| Valeur | Label | Système | Langue |
|---|---|---|---|
| `BEPC_3EME` | 3ème / BEPC | Francophone | `fr` |
| `SECONDE` | Seconde | Francophone | `fr` |
| `TERMINALE_BAC` | Terminale / BAC | Francophone | `fr` |
| `GCE_OL` | GCE O/Level | Anglophone | `en` |
| `GCE_AL` | GCE A/Level | Anglophone | `en` |
| `UNIVERSITE_BTS` | Université / BTS | Les deux | `fr` |

---

#### Format de réponse SSE

Le stream envoie des événements `data:` séparés par `\n\n`.

**Événement texte** :
```
data: {"text":"Félicitations pour"}

data: {"text":" ton BEPC ! Pour bien"}
```

**Fin du stream** :
```
data: [DONE]
```

**Erreur dans le stream** :
```
data: {"error":"Stream error message"}
```

**Headers de réponse** :
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

#### Codes d'erreur HTTP

| Status | Cas |
|---|---|
| `400` | Body invalide / JSON malformé / champ manquant |
| `429` | Rate limit dépassé (40 msg/min/IP) |
| `503` | `ANTHROPIC_API_KEY` non configurée |
| `500` | Erreur serveur |

---

## 2. Les 2 rapports — Marqueurs et format

### 2.1 Rapport gratuit (personnalité)

Généré par **Haiku** à la fin de la Phase 1 (test de personnalité).  
Visible par **tous les utilisateurs** — pas de paywall.

**Marqueurs** :
```
---RAPPORT-GRATUIT---
PROFIL : 🔵 Builder / Entrepreneur Impact

Tu es quelqu'un qui agit vite et qui apprend en faisant...

DOMAINES D'ÉTUDES RECOMMANDÉS
1. Entrepreneuriat — ...
2. Innovation & Management — ...

POURQUOI ÇA MARCHE POUR TOI
Tu transformes rapidement des idées en solutions concrètes...

SIGNAL EMPLOYABILITÉ : 🟢🟢 Très élevé
---FIN-GRATUIT---
```

**Détection frontend** :
```tsx
import { FREE_REPORT_START, FREE_REPORT_END } from "./parseReport"
// FREE_REPORT_START = "---RAPPORT-GRATUIT---"
// FREE_REPORT_END   = "---FIN-GRATUIT---"

const isFreeReport = message.content.includes(FREE_REPORT_START)
```

**Profils possibles** (basés sur le scoring A/B/C/D) :

| Lettre dominante | Profil | Domaines | Employabilité |
|---|---|---|---|
| **A** | 🔵 Builder / Entrepreneur Impact | Entrepreneuriat, Innovation, Marketing digital, Gestion de projets | 🟢🟢 Très élevé |
| **B** | 🟣 Analyste / Expert | Data & IA, Finance, Cybersécurité, IA & Dév. durable | 🟢🟢 Très élevé |
| **C** | 🟢 Leader / Influence | Gestion, Management international, Leadership, Marketing stratégique | 🟢 Élevé |
| **D** | 🟠 Structuré / Opérationnel | Gestion & Admin, Finance/Comptabilité, Contrôle & Qualité | 🟡 Stable |

**Profils mixtes** (2 lettres à ≤1 d'écart) : A+B Innovateur Tech · A+C Entrepreneur Leader · B+D Expert Certifié · C+D Manager Opérationnel · B+C Stratège/Consultant

### 2.2 Rapport payant (orientation complète)

Généré par **Sonnet** à la fin de la Phase 2 (7 dimensions collectées).  
Visible uniquement par les **abonnés** — paywall sinon.

**Marqueurs** :
```
---RAPPORT---
MODULE 1 — DIAGNOSTIC DU PROFIL
...
MODULE 9 — CONCLUSION D'ORIENTATION
---FIN---
```

**Détection frontend** :
```tsx
const REPORT_START = "---RAPPORT---"
const REPORT_END   = "---FIN---"

const isReport = message.content.includes(REPORT_START)
```

**9 modules** :

| # | Module | Contenu |
|---|---|---|
| 1 | Diagnostic du profil | Forces, faiblesses, potentiel, maturité du projet |
| 2 | Équivalence académique | Correspondance BTS ↔ HND selon le niveau |
| 3 | Arbre des possibles | 3 options : Ambitieuse / Réaliste / Repli |
| 4 | Score Xkorin (/100) | Valeur cognitive, employabilité, soft skills, logistique |
| 5 | Trust Index | Fiabilité du profil + 3 actions pour l'améliorer |
| 6 | Recommandations stratégiques | Formation, certifications, financement, établissements |
| 7 | Plan d'action | À 3 mois / 12 mois / 5 ans |
| 8 | Alerte de vigilance | Filières à éviter, risques, filières saturées |
| 9 | Conclusion d'orientation | Recommandation finale justifiée |

---

## 3. UX des rapports — Buffering et PDF

### 3.1 Buffering pendant le streaming

Les rapports ne s'affichent **pas** caractère par caractère. Pendant que le rapport se génère :

1. Le frontend détecte `---RAPPORT---` (ou `---RAPPORT-GRATUIT---`) dans le contenu streaming
2. Tant que `---FIN---` (ou `---FIN-GRATUIT---`) n'est pas reçu → **`ReportGeneratingState`** s'affiche (loader animé + étapes progressives)
3. Le curseur clignotant est masqué pendant la génération
4. Dès que la balise de fin arrive → le rapport complet s'affiche d'un coup

**Composant `ReportGeneratingState`** :
- Rapport payant : étapes "Diagnostic du profil", "Calcul du Score Xkorin", "Arbre des possibles", "Plan d'action à 5 ans"
- Rapport gratuit : étapes "Analyse des réponses", "Identification du profil", "Recommandations"

### 3.2 Téléchargement PDF

Les **deux rapports** sont téléchargeables en PDF :

| Rapport | Fonction | Fichier généré | Thème |
|---|---|---|---|
| Gratuit | `generateFreeReportPdf(body, level)` | `Xkorienta_Profil_[niveau]_[date].pdf` | Vert/Teal |
| Payant | `generateReportPdf(body, level)` | `Xkorienta_Rapport_[niveau]_[date].pdf` | Bleu/Vert |

Les deux utilisent `jsPDF` (import dynamique pour ne pas alourdir le bundle initial).

---

## 4. Optimisations tokens (v3.0)

L'endpoint applique des optimisations automatiques — transparentes pour le frontend.

### 4.1 Model switching

| Phase | Modèle | max_tokens | Déclencheur |
|---|---|---|---|
| Conversation + rapport gratuit | `claude-haiku-4-5-20251001` | 1200 | Par défaut |
| Rapport payant (9 modules) | `claude-sonnet-4-6` | 5000 | Mots-clés rapport dans les derniers messages |

**Mots-clés déclencheurs du mode rapport** (derniers messages user/assistant) :
`/rapport`, `rapport d'orientation`, `mon rapport`, `bilan complet`, `orientation finale`, `analyse complète`, `full report`, `my report`, `generate my report`

### 4.2 Context window trimming

Pour les conversations longues (> 30 messages), le backend garde :
- **4 premiers messages** (ancre contextuelle)
- **26 derniers messages** (fenêtre glissante)

→ Le frontend doit toujours envoyer l'**historique complet** — le trimming est côté serveur.

### 4.3 System prompt filtré par langue

- `language="fr"` → prompt avec catalogue **BTS uniquement** (~25% moins de tokens)
- `language="en"` → prompt avec catalogue **HND uniquement** (~35% moins de tokens)

### 4.4 Économie estimée

| | Avant | Après (v3.0) |
|---|---|---|
| Coût par session | ~$0.35 (tout sonnet) | ~$0.03 (~91% économie) |
| Modèle conversationnel | sonnet | haiku (20× moins cher) |
| Tokens système | ~4500/requête | ~3000/requête |

---

## 5. Composants frontend

### 5.1 `LevelSelector`

Grille 6 boutons animés. Détecte automatiquement le sous-système et applique la couleur :
- **Bleu** → francophone (`BEPC_3EME`, `SECONDE`, `TERMINALE_BAC`)
- **Vert** → anglophone (`GCE_OL`, `GCE_AL`)
- **Violet** → les deux (`UNIVERSITE_BTS`)

```tsx
import { LevelSelector } from "@/components/orientation"

<LevelSelector onSelect={(level: EducationLevel) => setSelectedLevel(level)} />
```

### 5.2 `XkorientaChat`

Interface de chat complète avec streaming SSE, buffering des rapports, et commande `/rapport`.

```tsx
import { XkorientaChat } from "@/components/orientation"

<XkorientaChat
  level={selectedLevel}   // EducationLevel
  onReset={() => setSelectedLevel(null)}
  isSubscribed={hasSubscription}  // boolean — contrôle le paywall du rapport payant
/>
```

**Comportement** :
- Au montage, envoie automatiquement `config.initialMessage`
- Phase 1 : test personnalité (1 question par tour, boutons A/B/C/D avec envoi immédiat au clic)
- Rapport gratuit affiché dans une carte verte avec bouton PDF
- Phase 2 : 7 dimensions d'orientation (quick replies contextuels)
- Rapport payant affiché en 9 module cards avec jauge Xkorin + bouton PDF
- Les rapports sont bufferisés pendant le streaming (loader animé, pas de rendu partiel)
- Auto-scroll, sauvegarde sessionStorage, historique localStorage

### 5.3 `ReportDisplay` + `FreeReportDisplay`

```tsx
import { ReportDisplay, FreeReportDisplay } from "@/components/orientation"

// Rapport payant (avec paywall)
<ReportDisplay
  reportBody={reportBody}
  isSubscribed={isSubscribed}
  level={level}
/>

// Rapport gratuit (toujours visible)
<FreeReportDisplay
  reportBody={freeReportBody}
  level={level}
/>
```

### 5.4 `parseReport.ts` — Utilitaires de parsing

```tsx
import {
  FREE_REPORT_START,     // "---RAPPORT-GRATUIT---"
  FREE_REPORT_END,       // "---FIN-GRATUIT---"
  parseFreeReport,       // → { emoji, name, body }
  parseReportModules,    // → ReportModule[]
  extractXkorinScore,    // → number | null
  extractRecommendation, // → string | null
} from "@/components/orientation/parseReport"
```

### 5.5 `LEVEL_CONFIGS`

```tsx
import { LEVEL_CONFIGS, getLevelConfig } from "@/types/orientation"

const config = getLevelConfig("TERMINALE_BAC")
// → { level, label, sublabel, language, system, initialMessage }
```

---

## 6. Test de personnalité — 9 questions

Le test « De Moi à l'Impact » comporte 9 questions A/B/C/D posées **une par une** (Q1 → Q9). L'IA compte la lettre dominante pour déterminer le profil.

| # | Thème |
|---|---|
| Q1 | Face à un problème |
| Q2 | En groupe |
| Q3 | Motivation |
| Q4 | Apprentissage |
| Q5 | Face à un défi |
| Q6 | Futur |
| Q7 | Peur après BAC / examens |
| Q8 | École idéale |
| Q9 | Phrase qui te ressemble |

**Scoring** : lettre la plus choisie sur 9 réponses. Si 2 lettres à ≤1 d'écart → profil mixte.

**Format d'affichage (v3.2)** : un message = une question — compteur `**Question X sur 9**`, intitulé `**Q[N].**`, 4 options en liste Markdown. Côté frontend : boutons A/B/C/D ; **un clic envoie la lettre** (pas de bouton « Valider »). Le prompt impose un **suivi d'état strict** : l'IA avance Q1→Q9 sans jamais regrouper ni répéter une question.

> ℹ️ Les questions sont la **seule exception** à la règle « prose sans listes » du prompt (qui reste valable pour les rapports). En Phase 2, chaque question porte un compteur `**(Dx/7) …**` pour situer l'élève et ancrer l'IA.

---

## 7. 7 dimensions collectées (Phase 2)

L'agent collecte ces informations via conversation naturelle (1 question/message). Le rapport payant est généré dès que les 7 dimensions sont couvertes.

| # | Dimension | Quick replies contextuels |
|---|---|---|
| D1 | Ville / région | 10 régions (Centre–Yaoundé, Littoral–Douala, Ouest–Bafoussam, Nord-Ouest–Bamenda, Sud-Ouest–Buea, Nord–Garoua, Adamaoua–Ngaoundéré, Extrême-Nord–Maroua, Est–Bertoua, Sud–Ebolowa) |
| D2 | Série ou filière | Série A, C, D, TI (fr) / Sciences, Arts, Commerce, Technical (en) |
| D3 | Notes / moyennes | Tranches /20 (fr) ou A-F (en) |
| D4 | Aspiration professionnelle | Informatique, Santé, Génie Civil, Finance, Enseignement |
| D5 | Budget familial (FCFA) | < 50k, 50-150k, 150-400k, > 400k |
| D6 | Mobilité | Oui/Non |
| D7 | Contraintes principales | Finances, éloignement, famille, pas de contrainte |

---

## 8. Pages & routes

### 8.1 Landing publique — `/orientation`

Page marketing avec hero, fonctionnalités, tarifs.

| État | CTA principal | CTA secondaire |
|---|---|---|
| Non connecté | "Commencer gratuitement" → `/register?returnTo=/checkout?plan=ELEVE` | "Voir les tarifs" → `#tarifs` |
| Connecté | "S'abonner maintenant" → `/checkout?plan=ELEVE` | "Voir le dashboard" → `/student/orientation/ai` |

### 8.2 Page dashboard — `/student/orientation/ai`

Protégée par la feature `ORIENTATION_AI` (plan abonné).

| `status` | `can(ORIENTATION_AI)` | Rendu |
|---|---|---|
| `"loading"` | — | Spinner centré |
| `"unauthenticated"` | — | Redirect `/login?returnTo=...` |
| `"active"` | `false` | Écran "Abonnement requis" + lien `/checkout` |
| `"active"` | `true` | `LevelSelector` → `XkorientaChat` |

---

## 9. Variables d'environnement

**Backend (`xkorienta-api/.env`)** :

| Variable | Valeur par défaut | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Requis.** Clé API Anthropic |
| `XKORIENTA_MODEL` | `claude-sonnet-4-6` | Modèle pour le rapport payant |
| `XKORIENTA_CHAT_MODEL` | `claude-haiku-4-5-20251001` | Modèle pour la conversation + rapport gratuit |

**Frontend (`xkorienta-app/.env`)** :

| Variable | Valeur par défaut | Description |
|---|---|---|
| `FF_ORIENTATION_AI` | `true` | Feature flag — désactiver pour masquer le Conseiller IA |

---

## 10. Checklist intégration

- [ ] `ANTHROPIC_API_KEY` configurée dans `xkorienta-api/.env`
- [ ] Backend démarré sur port 3001 (`npm run dev` dans `xkorienta-api`)
- [ ] Frontend démarré sur port 3000 (`npm run dev` dans `xkorienta-app`)
- [ ] Proxy `/api/xkorienta/*` → `localhost:3001` configuré dans `next.config.ts`
- [ ] Plan `ELEVE` avec `features: ["ORIENTATION_AI"]` dans la collection MongoDB `plans`
- [ ] `react-markdown` installé dans `xkorienta-app`
- [ ] `jsPDF` installé dans `xkorienta-app` (pour les PDF)
- [ ] `SubscriptionProvider` dans `/(dashboard)/layout.tsx`
- [ ] Feature flag `FF_ORIENTATION_AI=true` dans `xkorienta-app/.env`

---

## 11. Test rapide

### Sans frontend (curl)

```bash
curl -X POST http://localhost:3001/api/xkorienta/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Bonjour, je suis en Terminale C, moyenne 14/20"}],
    "level": "TERMINALE_BAC",
    "language": "fr"
  }'
```

### Commande dev `/rapport`

Dans le chat, taper `/rapport` → injecte un profil fictif complet et génère les 2 rapports (gratuit + payant) en séquence.
