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

**Message initial recommandé** (envoyé automatiquement à la sélection du niveau) — voir `xkorienta-app/src/types/orientation.ts` → `LEVEL_CONFIGS[].initialMessage`.

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

### 4.3 Utilitaires de parsing (référence web)

Implémentation de référence : `xkorienta-app/src/components/orientation/parseReport.ts`

```typescript
import {
  FREE_REPORT_START,
  FREE_REPORT_END,
  parseFreeReport,       // → { emoji, name, body }
  parseReportModules,    // → ReportModule[] (1–9)
  extractXkorinScore,    // → number | null
  extractRecommendation, // → string | null
} from './parseReport'
```

Sur mobile : reproduire la même logique de split sur les marqueurs et les headers `MODULE N —`.

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

## 7. Implémentation de référence (web Xkorienta)

Ces fichiers dans `xkorienta-app` montrent le comportement attendu :

| Fichier | Rôle |
|---|---|
| `src/types/orientation.ts` | Types + `LEVEL_CONFIGS` + messages initiaux |
| `src/components/orientation/LevelSelector.tsx` | Grille 6 niveaux |
| `src/components/orientation/XkorientaChat.tsx` | Chat SSE, buffering rapports, timeouts, `/rapport` |
| `src/components/orientation/ReportDisplay.tsx` | Rapport payant + paywall |
| `src/components/orientation/parseReport.ts` | Parsing marqueurs et modules |
| `src/components/orientation/generateReportPdf.ts` | Export PDF |
| `src/app/(dashboard)/student/orientation/ai/page.tsx` | Page dashboard + gate abonnement |

### Commande dev `/rapport`

Taper exactement `/rapport` dans le chat injecte un profil fictif complet (Phase 1 + Phase 2) et déclenche la génération des 2 rapports. Utile pour tester sans parcourir les 16+ échanges.

### Proxy web (Next.js)

`xkorienta-app/next.config.ts` redirige `/api/*` vers `NEXT_PUBLIC_API_URL` :

```typescript
// En dev : NEXT_PUBLIC_API_URL=http://localhost:3001
// En prod : NEXT_PUBLIC_API_URL=/xkorienta/backend
```

Le composant chat appelle `/api/xkorienta/chat` en **URL relative** — le proxy fait le reste.

---

## 8. Variables d'environnement

### Backend (`xkorienta-api`)

| Variable | Défaut | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Requis** pour le chat |
| `XKORIENTA_MODEL` | `claude-sonnet-4-6` | Modèle rapport payant |
| `XKORIENTA_CHAT_MODEL` | `claude-haiku-4-5-20251001` | Modèle conversation |

### Frontend web (`xkorienta-app`)

| Variable | Défaut | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL backend (sans `/api`) |
| `FF_ORIENTATION_AI` | `true` | Masquer le module si `false` |

### Mobile / externe

Configurer directement `{{baseUrl}}` vers l'API backend. Pas de proxy Next.js.

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

1. Ouvrir le chat web
2. Sélectionner un niveau
3. Taper `/rapport`
4. Attendre 1–2 min le stream Sonnet
5. Vérifier présence de `---RAPPORT-GRATUIT---` et `---RAPPORT---`

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
