# Module 26 — Xkorienta Orientation IA

> **Audience** : Équipe frontend (web Xkorienta, mobile Flutter, intégrations externes)  
> **Base URL backend** : `{{baseUrl}}`  
> **Exemples** : `http://localhost:3001` (dev) · `https://xkorienta.com/xkorienta/backend` (prod)  
> **Auth sur le chat** : Aucune — endpoint public, protégé par rate-limit IP  
> **Paywall rapport complet** : géré **côté client** (abonnement) — le backend génère toujours le texte  
> **Dépendance abonnement** : Module 25 (`ORIENTATION_AI` sur le plan) pour la page dashboard  
> **Dernière mise à jour** : juin 2026

---

## En bref

**Xkorienta** est un conseiller d'orientation scolaire et professionnelle pour le Cameroun. L'élève discute avec une IA (Claude) qui :

1. pose un **test de personnalité** (9 questions A/B/C/D) ;
2. génère un **rapport gratuit** (profil + domaines recommandés) ;
3. collecte **7 informations** (ville, série, notes, aspiration, budget, mobilité, contraintes) ;
4. génère un **rapport complet payant** (9 modules, score Xkorin, plan d'action).

Le frontend n'appelle qu'**un seul endpoint** en boucle : `POST /api/xkorienta/chat`.  
Chaque message utilisateur = une requête HTTP avec **tout l'historique** de la conversation. La réponse arrive en **streaming SSE** (mot par mot).

---

## Qui fait quoi ?

| Responsabilité | Backend (`xkorienta-api`) | Frontend (vous) |
|---|---|---|
| Conversation IA | ✅ Prompt, modèles, trimming | Envoyer `messages` + `level` + `language` |
| Streaming SSE | ✅ | Lire le flux, afficher le texte |
| Détection rapport payant (Sonnet) | ✅ `reportPhase.ts` | Optionnel : timeout UI plus long |
| Rapport gratuit | ✅ Généré par l'IA | Parser `---RAPPORT-GRATUIT---` |
| Rapport payant (9 modules) | ✅ Généré par l'IA | Parser `---RAPPORT---` + **paywall** si non abonné |
| PDF | — | Générer côté client (`jsPDF` sur le web) |
| Choix du niveau scolaire | — | UI + envoi de `level` |
| Abonnement / accès dashboard | ✅ Module 25 | `useFeatures().can('ORIENTATION_AI')` |
| Persistance conversation | — | `sessionStorage` / `localStorage` (web) ou stockage local (mobile) |

---

## URL à appeler selon la plateforme

| Plateforme | URL du chat |
|---|---|
| **Web Xkorienta** (Next.js) | `/api/xkorienta/chat` (proxy via `next.config.ts` → backend) |
| **Mobile / web externe** | `{{baseUrl}}/api/xkorienta/chat` directement |
| **Prod** | `https://xkorienta.com/xkorienta/backend/api/xkorienta/chat` |

> **CORS** : le backend n'autorise que certaines origines web (`xkorienta.com`, `gradeforcast.com`, `localhost:3000`…). Une app **mobile native** n'est pas soumise au CORS. Un **site web tiers** doit demander l'ajout de son domaine dans `xkorienta-api/src/middleware.ts`.

---

## Parcours utilisateur

### Chat public (accessible sans compte)

Le endpoint chat est **public**. N'importe qui peut converser et obtenir le **rapport gratuit**.  
Le **rapport payant** est généré par l'API mais son **affichage** peut être masqué côté client si l'utilisateur n'est pas abonné.

```
Landing /orientation
  └─ Inscription ou connexion
       └─ /student/orientation/ai  [gate ORIENTATION_AI pour le dashboard]
            1. Choisir un niveau (6 boutons)
            2. Message initial envoyé automatiquement
            3. Phase 1 — test personnalité (9 × A/B/C/D)
            4. Rapport gratuit affiché + PDF
            5. Phase 2 — 7 dimensions (D1→D7)
            6. Rapport payant (9 modules) — paywall si !abonné
```

### Abonnement (dashboard)

Voir **Module 25**. Résumé :

- Feature plan : `ORIENTATION_AI` (ex. plan `ELEVE`)
- Vérification : `GET /api/subscriptions/mine` → `planId.features`
- Le chat API reste public ; seul le **paywall UI** du rapport complet dépend de l'abonnement

---

## 1. Chat — `POST /api/xkorienta/chat`

Endpoint principal. **Aucune authentification.**

```
POST {{baseUrl}}/api/xkorienta/chat
Content-Type: application/json
Accept: text/event-stream
```

| Propriété | Valeur |
|---|---|
| Rate limit | **40 requêtes / minute / IP** |
| Durée max serveur | **300 s** (5 min) — important pour le rapport Sonnet |
| Réponse | `text/event-stream` (SSE) |

### Body

```json
{
  "messages": [
    { "role": "user", "content": "Bonjour ! Je suis en Terminale C..." },
    { "role": "assistant", "content": "Salut ! Avant ton orientation..." },
    { "role": "user", "content": "A" }
  ],
  "level": "TERMINALE_BAC",
  "language": "fr"
}
```

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `messages` | `array` | 1–100 items, requis | Historique **complet** de la conversation |
| `messages[].role` | `string` | `"user"` \| `"assistant"` | Rôle du message |
| `messages[].content` | `string` | 1–32 000 caractères | Texte du message |
| `level` | `string` | 1–50 caractères | Identifiant du niveau scolaire (voir tableau ci-dessous) |
| `language` | `string` | `"fr"` \| `"en"` | Langue de la conversation (défaut : `"fr"`) |

> Le backend **ne valide pas** l'enum `level` — c'est au frontend d'envoyer une des 6 valeurs documentées. Le `language` pilote le catalogue BTS (fr) ou HND (en) dans le prompt système.

### Niveaux scolaires (`level`)

| Valeur | Label UI | Système | `language` à envoyer |
|---|---|---|---|
| `BEPC_3EME` | 3ème / BEPC | Francophone | `fr` |
| `SECONDE` | Seconde | Francophone | `fr` |
| `TERMINALE_BAC` | Terminale / BAC | Francophone | `fr` |
| `GCE_OL` | GCE O/Level | Anglophone | `en` |
| `GCE_AL` | GCE A/Level | Anglophone | `en` |
| `UNIVERSITE_BTS` | Université / BTS / HND | Les deux | `fr` (par défaut dans l'app) |

**Message initial recommandé** (envoyé automatiquement à la sélection du niveau) — voir section **7.4 `LEVEL_CONFIGS`**.

### Réponse SSE

Chaque chunk est une ligne `data: …` suivie d'une ligne vide.

**Texte en streaming** :
```
data: {"text":"Félicitations pour"}

data: {"text":" ton BEPC !"}
```

**Fin du stream** :
```
data: [DONE]
```

**Erreur dans le flux** (stream interrompu côté serveur) :
```
data: {"error":"Erreur lors du streaming de la réponse"}
```

**Headers utiles** :
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

### Erreurs HTTP (avant le stream)

Format JSON standard de l'API :

```json
{
  "success": false,
  "error": {
    "code": "XOR_003",
    "message": "Paramètres de conversation invalides",
    "severity": "WARNING",
    "category": "VALIDATION",
    "timestamp": "2026-06-08T10:00:00.000Z"
  }
}
```

| Status | Code | Cause |
|---|---|---|
| `400` | `XOR_002` | JSON malformé |
| `400` | `XOR_003` | Validation Zod (`messages` vide, `language` invalide…) |
| `429` | — | Rate limit (body générique + header `Retry-After`) |
| `502` | `XOR_005` | Erreur Anthropic |
| `503` | `XOR_001` | `ANTHROPIC_API_KEY` manquante |
| `500` | `XOR_006` | Erreur pendant le streaming |

---

## 2. Intégration SSE — guide pas à pas

### Algorithme côté client

```
1. L'utilisateur envoie un message
2. Ajouter { role: "user", content } à l'historique local
3. POST /api/xkorienta/chat avec TOUT l'historique (sans le message assistant vide)
4. Lire response.body en stream
5. Pour chaque ligne "data: …" :
     - "[DONE]"           → fin
     - {"error":"…"}      → afficher erreur
     - {"text":"…"}       → concaténer au message assistant en cours
6. À la fin, ajouter le message assistant complet à l'historique
7. Détecter les marqueurs de rapport dans le contenu (voir section Rapports)
```

### Règles importantes

| Règle | Détail |
|---|---|
| Historique complet | Toujours renvoyer tous les messages user/assistant — le backend trim automatiquement (30 max) |
| Un POST par tour | Chaque message utilisateur = une nouvelle requête |
| Timeout 1er token | **12 s** en conversation normale · **90 s** si phase rapport détectée |
| Retry réseau | 1 retry silencieux recommandé si coupure avant le 1er token |
| Rapport = long stream | Ne pas couper la connexion avant `[DONE]` — peut durer 1–2 minutes |

### Détection « phase rapport » côté UI (timeouts)

Aligné sur `xkorienta-api/src/lib/ai/orientation/reportPhase.ts` :

- Dernier message user contient : `/rapport`, `mon rapport`, `bilan complet`, `orientation finale`, etc.
- Un des **3 derniers** messages assistant contient :
  - le marqueur **`(D7/7)`** (dernière dimension posée), ou
  - une phrase du type « je vais construire ton rapport », « j'ai toutes les informations », etc.

→ Utiliser un timeout plus long (90 s) et afficher un loader « Rapport en préparation… ».

### Exemple JavaScript (fetch + ReadableStream)

```javascript
async function sendChatMessage({ baseUrl, messages, level, language }) {
  const response = await fetch(`${baseUrl}/api/xkorienta/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, level, language }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message ?? `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return fullText;

      const parsed = JSON.parse(data);
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.text) {
        fullText += parsed.text;
        onToken?.(fullText); // callback UI
      }
    }
  }
  return fullText;
}
```

### Exemple Flutter (http + stream)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<String> sendChatMessage({
  required String baseUrl,
  required List<Map<String, String>> messages,
  required String level,
  required String language,
  void Function(String partial)? onPartial,
}) async {
  final request = http.Request(
    'POST',
    Uri.parse('$baseUrl/api/xkorienta/chat'),
  );
  request.headers['Content-Type'] = 'application/json';
  request.headers['Accept'] = 'text/event-stream';
  request.body = jsonEncode({
    'messages': messages,
    'level': level,
    'language': language,
  });

  final response = await http.Client().send(request);
  if (response.statusCode != 200) {
    final body = await response.stream.bytesToString();
    throw Exception('HTTP ${response.statusCode}: $body');
  }

  var buffer = '';
  var fullText = '';

  await for (final chunk in response.stream.transform(utf8.decoder)) {
    buffer += chunk;
    final lines = buffer.split('\n');
    buffer = lines.removeLast();

    for (final line in lines) {
      if (!line.startsWith('data: ')) continue;
      final data = line.substring(6).trim();
      if (data == '[DONE]') return fullText;

      final parsed = jsonDecode(data) as Map<String, dynamic>;
      if (parsed['error'] != null) throw Exception(parsed['error']);
      if (parsed['text'] != null) {
        fullText += parsed['text'] as String;
        onPartial?.call(fullText);
      }
    }
  }
  return fullText;
}
```

---

## 3. Les deux phases de conversation

### Phase 1 — Test de personnalité (gratuit)

| | |
|---|---|
| Durée | 9 questions, **une par message** |
| Réponses | Une lettre : `A`, `B`, `C` ou `D` (clic bouton recommandé) |
| Modèle backend | Haiku |
| Sortie | Rapport entre `---RAPPORT-GRATUIT---` et `---FIN-GRATUIT---` |

**Questions (thèmes)** :

| # | Thème |
|---|---|
| Q1 | Face à un problème |
| Q2 | En groupe |
| Q3 | Motivation |
| Q4 | Apprentissage |
| Q5 | Face à un défi |
| Q6 | Futur |
| Q7 | Peur après examens |
| Q8 | École idéale |
| Q9 | Phrase qui te ressemble |

**Profils possibles** (lettre dominante sur 9 réponses) :

| Lettre | Profil | Employabilité |
|---|---|---|
| A | 🔵 Builder / Entrepreneur Impact | 🟢🟢 Très élevé |
| B | 🟣 Analyste / Expert | 🟢🟢 Très élevé |
| C | 🟢 Leader / Influence | 🟢 Élevé |
| D | 🟠 Structuré / Opérationnel | 🟡 Stable |

Profils mixtes si 2 lettres à ≤1 d'écart : A+B Innovateur Tech · A+C Entrepreneur Leader · B+D Expert Certifié · C+D Manager Opérationnel · B+C Stratège/Consultant.

### Phase 2 — 7 dimensions (avant rapport payant)

L'IA pose **une dimension par message** avec un compteur `(Dx/7)` :

| # | Dimension | Exemples de quick replies UI |
|---|---|---|
| D1 | Ville / région | 10 régions du Cameroun |
| D2 | Série ou filière | BAC C/D/A/TI (fr) · Sciences/Arts/Commerce (en) |
| D3 | Notes / moyennes | Tranches /20 ou grades A–F |
| D4 | Aspiration professionnelle | Informatique, Santé, Génie civil… |
| D5 | Budget familial (FCFA) | < 50k · 50–150k · 150–400k · > 400k |
| D6 | Mobilité | Oui / Non |
| D7 | Contraintes | Finances, éloignement, famille, aucune |

> **`(D7/7)`** est le signal clé : une fois cette question posée et répondue, la **prochaine** réponse de l'IA est le rapport complet (Sonnet, stream long).

---

## 4. Les deux rapports — marqueurs et parsing

### 4.1 Rapport gratuit (personnalité)

**Marqueurs** :
```
---RAPPORT-GRATUIT---
PROFIL : 🔵 Builder / Entrepreneur Impact
...
SIGNAL EMPLOYABILITÉ : 🟢🟢 Très élevé
---FIN-GRATUIT---
```

**Détection** :
```typescript
const FREE_REPORT_START = '---RAPPORT-GRATUIT---'
const FREE_REPORT_END   = '---FIN-GRATUIT---'
const hasFreeReport = content.includes(FREE_REPORT_START)
```

**Accès** : toujours visible, téléchargeable en PDF — **pas de paywall**.

**Buffering UI** : pendant le stream, dès que `FREE_REPORT_START` est détecté et avant `FREE_REPORT_END`, afficher un loader au lieu du texte brut.

### 4.2 Rapport payant (orientation complète)

**Marqueurs** :
```
---RAPPORT---
MODULE 1 — DIAGNOSTIC DU PROFIL
...
MODULE 9 — CONCLUSION D'ORIENTATION
---FIN---
```

**Détection** :
```typescript
const REPORT_START = '---RAPPORT---'
const REPORT_END   = '---FIN---'
const hasPaidReport = content.includes(REPORT_START)
```

**9 modules** :

| # | Module |
|---|---|
| 1 | Diagnostic du profil |
| 2 | Équivalence académique (BTS ↔ HND) |
| 3 | Arbre des possibles (Ambitieuse / Réaliste / Repli) |
| 4 | Score Xkorin (/100) |
| 5 | Trust Index |
| 6 | Recommandations stratégiques |
| 7 | Plan d'action (3 mois / 12 mois / 5 ans) |
| 8 | Alerte de vigilance |
| 9 | Conclusion d'orientation |

**Paywall** : le backend **génère toujours** le rapport. Le frontend masque le contenu si `!isSubscribed` et affiche un CTA vers `/checkout?plan=ELEVE`.

**Buffering UI** : même principe que le rapport gratuit — loader jusqu'à `---FIN---`.

### 4.3 Parsing côté client

Algorithmes complets en section **7.9**. Résumé des fonctions à implémenter :

| Fonction | Entrée | Sortie |
|---|---|---|
| `extractBetween` | contenu + marqueurs START/END | corps du rapport |
| `parseFreeReport` | corps rapport gratuit | `{ emoji, name, body }` |
| `parseReportModules` | corps rapport payant | `ReportModule[]` (1–9) |
| `extractXkorinScore` | contenu module 4 | `number \| null` (0–100) |
| `extractRecommendation` | corps rapport | formation recommandée ou `null` |

Regex recommandation (module 9) :
```typescript
/la\s+meilleure\s+voie\s+pour\s+cet\s+apprenant\s+est\s+(.+?)(?:\s+parce\s+que|\.|\n|$)/i
```

---

## 5. Inscription orientation — `POST /api/xkorienta/register`

Endpoint optionnel pour enregistrer une demande d'orientation (formulaire landing / établissement).

```
POST {{baseUrl}}/api/xkorienta/register
Content-Type: application/json
```

**Auth** : Aucune

### Body

```json
{
  "student": {
    "school": "Lycée de Douala",
    "firstName": "Marie",
    "lastName": "Ngo",
    "phone": "+237600000000",
    "email": "marie@example.com",
    "neighborhood": "Akwa",
    "class": "Terminale C",
    "specialty": "Sciences"
  },
  "parent": {
    "fullName": "Jean Ngo",
    "phone": "+237600000001",
    "email": "parent@example.com"
  }
}
```

Tous les champs sont **requis** (validation Mongoose).

### Réponse 201

```json
{
  "success": true,
  "message": "Registration successful",
  "data": { "_id": "...", "student": { ... }, "parent": { ... }, "createdAt": "..." }
}
```

### Erreur

| Status | Code | Cause |
|---|---|---|
| `500` | `XOR_007` | Erreur base de données |

---

## 6. Optimisations backend (transparentes pour vous)

Vous n'avez rien à configurer — mais utile pour le debug.

| Mécanisme | Valeur actuelle | Fichier |
|---|---|---|
| Modèle conversation + rapport gratuit | `claude-haiku-4-5-20251001` | `xkorientaSystemPrompt.ts` |
| Modèle rapport payant | `claude-sonnet-4-6` | idem |
| `max_tokens` chat | **1200** | idem |
| `max_tokens` rapport | **5000** | idem |
| Context trimming | **4** premiers + **26** derniers = **30** messages max | `chat/route.ts` |
| Bascule Sonnet | `isXkorientaReportPhase()` | `reportPhase.ts` |
| Prompt catalogue | BTS si `fr`, HND si `en` | `xkorientaSystemPrompt.ts` |
| Durée fonction | **300 s** | `chat/route.ts` |

---

## 7. Kit d'implémentation client (from scratch)

Cette section contient **tout le nécessaire** pour implémenter le module sans lire un autre repo. Copiez/adaptez ces types, constantes et algorithmes dans votre app (Flutter, React Native, Vue, etc.).

---

### 7.1 Types TypeScript (référence)

```typescript
/** Valeurs `level` acceptées par POST /api/xkorienta/chat */
type EducationLevel =
  | 'BEPC_3EME'
  | 'GCE_OL'
  | 'SECONDE'
  | 'TERMINALE_BAC'
  | 'GCE_AL'
  | 'UNIVERSITE_BTS'

type OrientationLanguage = 'fr' | 'en'
type EducationSystem = 'francophone' | 'anglophone' | 'both'
type ChatRole = 'user' | 'assistant'

/** Message API (body POST /chat) */
interface ApiChatMessage {
  role: ChatRole
  content: string
}

/** Message UI (avec id local + état streaming) */
interface OrientationMessage {
  id: string
  role: ChatRole
  content: string
  isStreaming?: boolean
}

interface LevelConfig {
  level: EducationLevel
  label: string
  sublabel: string
  language: OrientationLanguage
  system: EducationSystem
  /** Envoyé automatiquement quand l'utilisateur choisit ce niveau */
  initialMessage: string
}

interface FreeReportProfile {
  emoji: string
  name: string
  body: string
}

interface ReportModule {
  number: number      // 1–9
  title: string
  content: string
}

interface ConversationEntry {
  id: string
  level: EducationLevel
  language: OrientationLanguage
  messageCount: number
  hasReport: boolean
  preview: string
  createdAt: string   // ISO 8601
  messages: OrientationMessage[]
}

/** Formulaire POST /api/xkorienta/register */
interface XkorientaRegistration {
  student: {
    school: string
    firstName: string
    lastName: string
    phone: string
    email: string
    neighborhood: string
    class: string
    specialty: string
  }
  parent: {
    fullName: string
    phone: string
    email: string
  }
}
```

---

### 7.2 Constantes — marqueurs de rapports

```typescript
const FREE_REPORT_START = '---RAPPORT-GRATUIT---'
const FREE_REPORT_END   = '---FIN-GRATUIT---'
const REPORT_START      = '---RAPPORT---'
const REPORT_END        = '---FIN---'

/** Regex module payant : "MODULE 1 — DIAGNOSTIC DU PROFIL" */
const MODULE_HEADER_RE = /MODULE\s+(\d)\s*[—–-]+\s*(.+?)(?:\n|$)/g

/** Regex score Xkorin : "SCORE TOTAL : 72/100" */
const XKORIN_SCORE_RE = /SCORE\s*TOTAL\s*[:：]\s*\[?(\d{1,3})\s*[/／]\s*100\]?/i

/** Regex dimension Phase 2 : "(D3/7)", "D7 / 7", etc. */
const DIMENSION_MARKER_RE = /\bD\s*([1-7])\s*\/\s*7\b/gi
const LAST_DIMENSION_RE   = /\bD\s*7\s*\/\s*7\b/i

/** Regex ligne profil gratuit : "PROFIL : 🔵 Builder / Entrepreneur Impact" */
const PROFIL_LINE_RE = /^PROFIL\s*:\s*(\S+)\s+(.+)/i
```

---

### 7.3 Constantes — timeouts et limites UI

```typescript
const FIRST_TOKEN_TIMEOUT_MS        = 12_000   // conversation normale
const FIRST_TOKEN_TIMEOUT_REPORT_MS = 90_000   // phase rapport (Sonnet lent)
const SLOW_CONNECTION_THRESHOLD_MS  = 3_000    // afficher "connexion lente" après 3s
const CHAT_API_PATH                 = '/api/xkorienta/chat'
const MAX_MESSAGES_PER_REQUEST      = 100      // limite backend Zod
```

---

### 7.4 `LEVEL_CONFIGS` — les 6 niveaux (source de vérité)

```json
[
  {
    "level": "BEPC_3EME",
    "label": "3ème / BEPC",
    "sublabel": "Francophone",
    "language": "fr",
    "system": "francophone",
    "initialMessage": "Bonjour ! Je suis en 3ème et je viens d'obtenir mon BEPC. J'ai besoin de conseils pour choisir la bonne série au lycée et préparer mon orientation professionnelle."
  },
  {
    "level": "GCE_OL",
    "label": "GCE O/Level",
    "sublabel": "Anglophone",
    "language": "en",
    "system": "anglophone",
    "initialMessage": "Hello! I just completed my GCE Ordinary Level exams. I need guidance on choosing the right subjects for A/Level and planning my future career path."
  },
  {
    "level": "SECONDE",
    "label": "Seconde",
    "sublabel": "Francophone",
    "language": "fr",
    "system": "francophone",
    "initialMessage": "Bonjour ! Je suis en classe de Seconde. J'ai besoin d'aide pour confirmer ou changer ma série et bien me préparer pour l'orientation post-bac."
  },
  {
    "level": "TERMINALE_BAC",
    "label": "Terminale / BAC",
    "sublabel": "Francophone",
    "language": "fr",
    "system": "francophone",
    "initialMessage": "Bonjour ! Je suis en Terminale et je prépare mon BAC. J'ai besoin d'aide pour choisir la meilleure formation après le BAC : BTS, grande école ou université."
  },
  {
    "level": "GCE_AL",
    "label": "GCE A/Level",
    "sublabel": "Anglophone",
    "language": "en",
    "system": "anglophone",
    "initialMessage": "Hello! I am in Upper Sixth preparing for my GCE Advanced Level exams. I need guidance on choosing between HND programs, universities, and career paths after A/Levels."
  },
  {
    "level": "UNIVERSITE_BTS",
    "label": "Université / BTS",
    "sublabel": "BTS · HND · Licence",
    "language": "fr",
    "system": "both",
    "initialMessage": "Bonjour ! Je suis déjà étudiant(e) à l'université ou en formation BTS/HND. Je souhaite confirmer mon orientation ou explorer une réorientation vers une filière plus porteuse."
  }
]
```

**Couleurs UI suggérées par `system`** :

| `system` | Usage |
|---|---|
| `francophone` | Bleu — BEPC, Seconde, Terminale |
| `anglophone` | Vert — GCE O/L, GCE A/L |
| `both` | Violet — Université / BTS |

---

### 7.5 Profils de personnalité (Phase 1)

Scoring : lettre la plus choisie sur 9 réponses (A/B/C/D). Si 2 lettres à ≤1 d'écart → profil mixte.

| Lettre dominante | Emoji | Nom du profil | Employabilité |
|---|---|---|---|
| A | 🔵 | Builder / Entrepreneur Impact | 🟢🟢 Très élevé |
| B | 🟣 | Analyste / Expert | 🟢🟢 Très élevé |
| C | 🟢 | Leader / Influence | 🟢 Élevé |
| D | 🟠 | Structuré / Opérationnel | 🟡 Stable |

**Profils mixtes** (2 lettres proches) :

| Mixte | Nom | Domaines |
|---|---|---|
| A+B | Innovateur Tech | Entrepreneuriat, Data, Tech, Finance |
| A+C | Entrepreneur Leader | Business, Management, Marketing |
| B+D | Expert Certifié | Finance, Audit, Cybersécurité |
| C+D | Manager Opérationnel | Gestion, Opérations, Administration |
| B+C | Stratège / Consultant | Management, Data, Finance |

**Boutons Phase 1** : afficher `A` `B` `C` `D` — un clic envoie **immédiatement** la lettre (pas de bouton « Valider »).

---

### 7.6 Quick replies Phase 2 (par dimension)

Détection : parser le **dernier** `(Dx/7)` dans le dernier message assistant.  
`x` = numéro de dimension → afficher la liste correspondante.

#### D1 — Régions du Cameroun

**FR** :
```
Centre — Yaoundé
Littoral — Douala
Ouest — Bafoussam
Nord-Ouest — Bamenda
Sud-Ouest — Buea
Nord — Garoua
Adamaoua — Ngaoundéré
Extrême-Nord — Maroua
Est — Bertoua
Sud — Ebolowa
```

**EN** :
```
Centre — Yaoundé
Littoral — Douala
West — Bafoussam
North-West — Bamenda
South-West — Buea
North — Garoua
Adamawa — Ngaoundéré
Far North — Maroua
East — Bertoua
South — Ebolowa
```

#### D2 — Série / filière (selon `level`)

| Contexte | FR | EN |
|---|---|---|
| Lycée (tous sauf `UNIVERSITE_BTS`) | Série A, Série C, Série D, Série TI | Sciences, Arts, Commerce, Technical |
| `UNIVERSITE_BTS` | Sciences & Techno, Génie / Ingénierie, Économie / Gestion, Droit / Sciences sociales, Santé, Lettres / Arts | Science & Tech, Engineering, Business & Mgmt, Law & Social Sci., Health Sciences, Arts & Humanities |

#### D3 — Notes

| FR | EN |
|---|---|
| < 10/20, 10–12/20, 12–14/20, 14–16/20, > 16/20 | A (Excellent), B (Very Good), C (Good), D (Credit), E/F (Pass/Fail) |

#### D4 — Aspiration

| FR | EN |
|---|---|
| Informatique/Tech, Santé/Médecine, Génie Civil/BTP, Finance/Gestion, Enseignement | IT/Software, Health/Medicine, Engineering, Finance/Business, Teaching |

#### D5 — Budget

| FR | EN |
|---|---|
| < 50k FCFA/mois, 50–150k/mois, 150–400k/mois, > 400k/mois | Below 50k CFA/month, 50k–150k/month, 150k–400k/month, Above 400k/month |

#### D6 — Mobilité

| FR | EN |
|---|---|
| Oui, je peux me déplacer, Non, je reste dans ma ville | Yes, I can relocate, No, I must stay |

#### D7 — Contraintes

| FR | EN |
|---|---|
| Contraintes financières, Éloignement, Responsabilités familiales, Pas de contrainte majeure | Financial constraints, Distance from school, Family responsibilities, No major constraint |

> Ne pas afficher de quick replies si le message contient `---RAPPORT---` ou si aucun `(Dx/7)` n'est détecté.

---

### 7.7 Détection phase rapport (timeouts UI)

Reproduire côté client pour choisir le bon timeout (12 s vs 90 s) et le loader « Rapport en cours… ».

```typescript
const USER_REPORT_PHRASES = [
  '/rapport',
  "rapport d'orientation",
  'mon rapport',
  'génère le rapport',
  'genere le rapport',
  'générer le rapport',
  'donne-moi mon rapport',
  'donne moi mon rapport',
  'bilan complet',
  'orientation finale',
  'analyse complète',
  'full report',
  'my report',
  'generate my report',
]

const ASSISTANT_REPORT_IMMINENT = [
  'dernière question avant',
  'derniere question avant',
  'avant que je construise ton rapport',
  'avant que je construise votre rapport',
  'je construise ton rapport',
  'je construis ton rapport',
  'je vais construire ton rapport',
  'je vais maintenant construire',
  "construire ton rapport d'orientation",
  'je vais générer ton rapport',
  'je vais maintenant générer',
  'je vais rédiger ton rapport',
  'je construis maintenant ton rapport',
  "voici ton rapport d'orientation",
  'analyse complète de ton profil',
  "j'ai maintenant toutes les informations",
  "j'ai toutes les informations nécessaires",
  "j'ai maintenant tous les éléments",
  'let me build your report',
  'let me now generate',
  'i now have all the information',
  'i have all the information',
  'building your report',
  'generating your report',
]

const REPORT_LOOKBACK = 3

function isLikelyReportPhase(messages: ApiChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue
    const u = messages[i].content.trim().toLowerCase()
    if (USER_REPORT_PHRASES.some((p) => u.includes(p))) return true
    break
  }
  let assistantSeen = 0
  for (let i = messages.length - 1; i >= 0 && assistantSeen < REPORT_LOOKBACK; i--) {
    if (messages[i].role !== 'assistant') continue
    assistantSeen++
    if (LAST_DIMENSION_RE.test(messages[i].content)) return true
    const lower = messages[i].content.toLowerCase()
    if (ASSISTANT_REPORT_IMMINENT.some((p) => lower.includes(p))) return true
  }
  return false
}
```

---

### 7.8 Machine à états UI

```
[IDLE]
  → utilisateur choisit un niveau
[LEVEL_SELECTED]
  → POST chat avec initialMessage seul
[PHASE_1_PERSONALITY]
  → afficher boutons A/B/C/D jusqu'à 9 réponses
  → détecter FREE_REPORT_START dans le stream
[FREE_REPORT_BUFFERING]
  → loader jusqu'à FREE_REPORT_END
[FREE_REPORT_DISPLAY]
  → carte rapport gratuit + PDF optionnel
[PHASE_2_DIMENSIONS]
  → quick replies D1–D7 selon (Dx/7)
  → détecter (D7/7) puis réponse utilisateur
[PAID_REPORT_BUFFERING]
  → loader long (90s timeout) jusqu'à REPORT_END
[PAID_REPORT_DISPLAY]
  → si isSubscribed : 9 modules + score Xkorin
  → sinon : paywall (masquer contenu, CTA abonnement)
```

**Buffering rapports** : dès détection du marqueur START et avant END, ne pas afficher le texte brut — montrer un loader avec étapes :

| Rapport | Étapes loader |
|---|---|
| Gratuit | Analyse des réponses → Identification du profil → Recommandations |
| Payant | Diagnostic du profil → Calcul du Score Xkorin → Arbre des possibles → Plan d'action à 5 ans |

---

### 7.9 Algorithmes de parsing

#### Extraire le corps d'un rapport

```typescript
function extractBetween(content: string, start: string, end: string): string | null {
  const i = content.indexOf(start)
  if (i === -1) return null
  const j = content.indexOf(end, i + start.length)
  if (j === -1) return null
  return content.slice(i + start.length, j).trim()
}
```

#### Parser rapport gratuit

```typescript
function parseFreeReport(body: string): FreeReportProfile {
  const lines = body.trim().split('\n')
  const profilLine = lines.find((l) => /^PROFIL\s*:/i.test(l.trim()))
  if (profilLine) {
    const match = profilLine.match(/PROFIL\s*:\s*(\S+)\s+(.+)/i)
    const emoji = match?.[1] ?? '🎯'
    const name = match?.[2]?.trim() ?? 'Profil détecté'
    const idx = lines.indexOf(profilLine)
    const rest = lines.slice(idx + 1).join('\n').trim()
    return { emoji, name, body: rest }
  }
  return { emoji: '🎯', name: 'Profil de personnalité', body: body.trim() }
}
```

#### Parser modules rapport payant

```typescript
function parseReportModules(reportBody: string): ReportModule[] {
  const headerRe = /MODULE\s+(\d)\s*[—–-]+\s*(.+?)(?:\n|$)/g
  const matches: Array<{ number: number; title: string; endIndex: number; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(reportBody)) !== null) {
    matches.push({
      number: parseInt(m[1], 10),
      title: m[2].trim(),
      index: m.index,
      endIndex: m.index + m[0].length,
    })
  }
  if (matches.length === 0) return []
  return matches.map((match, i) => ({
    number: match.number,
    title: match.title,
    content: reportBody
      .slice(match.endIndex, i < matches.length - 1 ? matches[i + 1].index : reportBody.length)
      .trim(),
  })).sort((a, b) => a.number - b.number)
}
```

#### Extraire score Xkorin (module 4)

```typescript
function extractXkorinScore(content: string): number | null {
  const primary = content.match(/SCORE\s*TOTAL\s*[:：]\s*\[?(\d{1,3})\s*[/／]\s*100\]?/i)
  if (primary) {
    const v = parseInt(primary[1], 10)
    if (v >= 0 && v <= 100) return v
  }
  const fallback = content.match(/(\d{1,3})\s*[/／]\s*100/)
  if (fallback) {
    const v = parseInt(fallback[1], 10)
    if (v >= 0 && v <= 100) return v
  }
  return null
}
```

#### Icônes modules (optionnel UI)

| # | Emoji | Titre attendu |
|---|---|---|
| 1 | 📊 | Diagnostic du profil |
| 2 | 🔄 | Équivalence académique |
| 3 | 🌳 | Arbre des possibles |
| 4 | 🧠 | Score Xkorin |
| 5 | 🤝 | Trust Index |
| 6 | 🎯 | Recommandations stratégiques |
| 7 | 📅 | Plan d'action |
| 8 | ⚠️ | Alerte de vigilance |
| 9 | ✅ | Conclusion d'orientation |

---

### 7.10 Codes erreur API (`XOR_*`)

| Code | HTTP | Message FR |
|---|---|---|
| `XOR_001` | 503 | Service IA non configuré — clé API manquante |
| `XOR_002` | 400 | Corps de requête invalide |
| `XOR_003` | 400 | Paramètres de conversation invalides |
| `XOR_004` | 429 | Limite de messages dépassée |
| `XOR_005` | 502 | Erreur du service IA Anthropic |
| `XOR_006` | 500 | Erreur lors du streaming |
| `XOR_007` | 500 | Erreur enregistrement inscription |
| `XOR_008` | 400 | Niveau scolaire non reconnu |
| `XOR_009` | 400 | Conversation trop longue |
| `XOR_010` | 503 | Service indisponible |

Format réponse erreur :
```json
{
  "success": false,
  "error": {
    "code": "XOR_003",
    "message": "Paramètres de conversation invalides",
    "severity": "WARNING",
    "category": "VALIDATION",
    "timestamp": "2026-06-08T10:00:00.000Z"
  }
}
```

---

### 7.11 Persistance locale (recommandée)

Clés suggérées pour reprendre une conversation après refresh :

| Clé | Contenu |
|---|---|
| `xkorienta_level` | `EducationLevel` sélectionné |
| `xkorienta_messages` | `OrientationMessage[]` JSON (session courante) |
| `xkorienta_history` | `ConversationEntry[]` JSON (historique archivé) |

---

### 7.12 Paywall rapport payant

Le backend **envoie toujours** le texte complet entre `---RAPPORT---` et `---FIN---`.  
Le client décide d'afficher ou masquer selon l'abonnement :

```typescript
// Vérifier abonnement — Module 25
// GET /api/subscriptions/mine → planId.features includes "ORIENTATION_AI"
const isSubscribed = features.includes('ORIENTATION_AI') || features.includes('FULL_ACCESS')

if (hasPaidReport && !isSubscribed) {
  // Afficher teaser + CTA checkout, ne pas rendre le body complet
} else if (hasPaidReport) {
  // parseReportModules + extractXkorinScore + PDF
}
```

---

### 7.13 Commande dev `/rapport`

Taper exactement `/rapport` peut injecter un historique fictif (Phase 1 + Phase 2 complètes) puis envoyer « génère le rapport » pour tester sans 16+ échanges. Réservé au développement — optionnel en production.

---

## 8. Variables d'environnement

### Backend

| Variable | Défaut | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Requis** pour le chat |
| `XKORIENTA_MODEL` | `claude-sonnet-4-6` | Modèle rapport payant |
| `XKORIENTA_CHAT_MODEL` | `claude-haiku-4-5-20251001` | Modèle conversation |

### Client (web, mobile, externe)

| Variable | Exemple | Description |
|---|---|---|
| `API_BASE_URL` | `https://xkorienta.com/xkorienta/backend` | URL backend **sans** `/api` |
| Endpoint chat | `{API_BASE_URL}/api/xkorienta/chat` | URL complète à appeler |

---

## 9. Checklist d'intégration

### Backend

- [ ] `ANTHROPIC_API_KEY` configurée
- [ ] `POST /api/xkorienta/chat` répond en SSE sur `{{baseUrl}}`
- [ ] Rate limit 40/min/IP accepté dans l'UX (message si 429)

### Client (web ou mobile)

- [ ] Écran de sélection des 6 niveaux + envoi du `initialMessage`
- [ ] Boucle chat : historique complet à chaque POST
- [ ] Parser SSE (`data: {"text":…}` → `[DONE]`)
- [ ] Boutons A/B/C/D en Phase 1 (envoi immédiat au clic)
- [ ] Quick replies contextuels en Phase 2 (optionnel mais recommandé)
- [ ] Détection `---RAPPORT-GRATUIT---` / `---RAPPORT---` + buffering loader
- [ ] Paywall sur rapport payant si `!isSubscribed` (vérifier via Module 25)
- [ ] Timeout 12 s (chat) / 90 s (rapport) sur attente du 1er token
- [ ] Persistance locale de la conversation (reprise après refresh)

### Abonnement (dashboard uniquement)

- [ ] Plan avec `features: ["ORIENTATION_AI"]` en base
- [ ] `GET /api/subscriptions/mine` pour `isSubscribed`
- [ ] Voir Module 25 pour le checkout

---

## 10. Tests rapides

### curl (SSE brut)

```bash
curl -N -X POST http://localhost:3001/api/xkorienta/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Bonjour, je suis en Terminale C, moyenne 14/20"}],
    "level": "TERMINALE_BAC",
    "language": "fr"
  }'
```

Attendu : lignes `data: {"text":"..."}` puis `data: [DONE]`.

### Test rapport complet (dev)

1. Sélectionner un niveau et envoyer le `initialMessage`
2. Taper `/rapport` (ou parcourir Phase 1 + Phase 2 manuellement)
3. Attendre 1–2 min le stream Sonnet
4. Vérifier présence de `---RAPPORT-GRATUIT---` et `---RAPPORT---` dans le dernier message assistant

---

## Fichiers backend (référence)

| Fichier | Rôle |
|---|---|
| `src/app/api/xkorienta/chat/route.ts` | Endpoint SSE, rate limit, trimming, appel Anthropic |
| `src/lib/ai/prompts/xkorientaSystemPrompt.ts` | Prompt système (2 phases), constantes modèles |
| `src/lib/ai/orientation/reportPhase.ts` | Détection bascule Haiku → Sonnet |
| `src/app/api/xkorienta/register/route.ts` | Enregistrement formulaire orientation |
| `src/models/XkorientaRegistration.ts` | Schéma MongoDB inscription |
| `src/lib/errors/core/XOrientationError.ts` | Codes erreur `XOR_001`–`XOR_010` |
