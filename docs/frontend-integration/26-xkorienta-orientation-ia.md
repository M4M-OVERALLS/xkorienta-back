# Module 26 — Xkorienta Orientation IA

> **Audience** : Équipe frontend  
> **Base URL backend** : `{{baseUrl}}` (ex: `http://localhost:3001`)  
> **Auth** : Aucune sur l'endpoint chat — public (rate-limit IP)  
> **Feature flag requis** : `ORIENTATION_AI` (voir Module 25) pour l'accès dashboard  
> **Fichiers clés backend** :
> - `src/app/api/xkorienta/chat/route.ts` — endpoint SSE
> - `src/lib/ai/prompts/xkorientaSystemPrompt.ts` — system prompt + constantes modèles
>
> **Fichiers clés frontend** :
> - `src/types/orientation.ts` — types + `LEVEL_CONFIGS`
> - `src/components/orientation/LevelSelector.tsx` — grille 6 niveaux
> - `src/components/orientation/XkorientaChat.tsx` — interface chat streaming
> - `src/app/(dashboard)/student/orientation/ai/page.tsx` — page protégée dashboard
> - `src/app/orientation/page.tsx` — landing publique + pricing
> - `src/app/xkorienta/orientation/page.tsx` — page standalone (redirige vers /orientation)

---

## Vue d'ensemble

Xkorienta est un agent IA conseiller d'orientation scolaire et professionnelle au Cameroun, ancré dans les programmes officiels **BTS/HND MINESUP 2023**. Il conduit une conversation structurée avec l'apprenant pour générer un **rapport d'orientation personnalisé en 9 modules**.

### Flux utilisateur

```
/orientation (landing publique)
  └─ CTA "S'abonner" → /checkout?plan=ELEVE (voir Module 25)
       └─ après paiement → /student/orientation/ai

/student/orientation/ai  [feature gate: ORIENTATION_AI]
  1. Sélection du niveau (6 boutons)
  2. Message initial envoyé automatiquement
  3. Conversation (~10 échanges, max 2 questions/message)
  4. Rapport final généré entre balises ---RAPPORT--- / ---FIN---
```

---

## 1. Endpoint Chat

### POST /api/xkorienta/chat

Endpoint de chat conversationnel avec réponse en **Server-Sent Events (SSE)**.

```
POST /api/xkorienta/chat
Content-Type: application/json
```

**Auth** : Aucune  
**Rate limit** : 20 requêtes / minute / IP  
**Réponse** : `text/event-stream`

#### Body

```json
{
  "messages": [
    { "role": "user", "content": "Bonjour ! Je suis en Terminale..." },
    { "role": "assistant", "content": "Félicitations ! Quelle est ta série ?" },
    { "role": "user", "content": "Série C, moyenne 14/20" }
  ],
  "level": "TERMINALE_BAC",
  "language": "fr"
}
```

| Champ | Type | Contraintes | Description |
|---|---|---|---|
| `messages` | `array` | 1–50 items | Historique complet de la conversation |
| `messages[].role` | `string` | `"user"` \| `"assistant"` | Rôle du message |
| `messages[].content` | `string` | 1–4000 chars | Contenu du message |
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

**Événement texte** (chunk de réponse) :
```
data: {"text":"Félicitations pour"}

data: {"text":" ton BEPC ! Pour bien"}

data: {"text":" choisir ta série..."}
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

---

#### Codes d'erreur HTTP

| Status | Cas |
|---|---|
| `400` | Body invalide / JSON malformé / champ manquant |
| `429` | Rate limit dépassé (20 msg/min/IP) |
| `503` | `ANTHROPIC_API_KEY` non configurée |
| `500` | Erreur serveur |

**Réponse 429** :
```json
{
  "success": false,
  "message": "Too many requests",
  "retryAfter": 1748823600000
}
```

---

## 2. Rapport final — Format spécial

Quand l'IA a collecté suffisamment de données (~10 échanges, 8+ dimensions), elle génère le rapport entre deux balises :

```
---RAPPORT---
MODULE 1 — DIAGNOSTIC DU PROFIL
...
MODULE 9 — CONCLUSION D'ORIENTATION
---FIN---
```

**Détection côté frontend** :

```tsx
const REPORT_START = "---RAPPORT---"
const REPORT_END   = "---FIN---"

const isReport = message.content.includes(REPORT_START)

// Extraction
const reportBody = content.split(REPORT_START)[1]?.split(REPORT_END)[0] ?? ""
```

Le composant `XkorientaChat.tsx` affiche le rapport dans un bloc visuel distinct (fond dégradé, header "Rapport d'orientation Xkorienta").

---

## 3. Optimisations tokens (v3.0)

L'endpoint applique 4 optimisations automatiques — transparentes pour le frontend.

### 3.1 Model switching

| Phase | Modèle | max_tokens | Déclencheur |
|---|---|---|---|
| Conversation | `claude-haiku-4-5-20251001` | 800 | `messages.length < 18` |
| Rapport final | `claude-sonnet-4-6` | 2500 | `messages.length ≥ 18` ou mots-clés rapport |

**Mots-clés déclencheurs du mode rapport** (dans les 3 derniers messages) :
`rapport`, `bilan`, `résumé`, `conclusion`, `report`, `summary`, `orientation finale`, `analyse complète`

### 3.2 Context window trimming

Pour les conversations longues (> 12 messages envoyés), le backend garde :
- **2 premiers messages** (ancre contextuelle)
- **10 derniers messages** (fenêtre glissante)

→ Le frontend doit toujours envoyer l'**historique complet** — le trimming est côté serveur.

### 3.3 System prompt filtré par langue

- `language="fr"` → prompt avec catalogue **BTS uniquement** (~25% moins de tokens)
- `language="en"` → prompt avec catalogue **HND uniquement** (~35% moins de tokens)

### 3.4 Économie estimée

| | Avant | Après |
|---|---|---|
| Coût par session (~10 échanges) | ~$0.35 (tout sonnet) | ~$0.02 (~94% économie) |
| Modèle conversationnel | sonnet | haiku (20× moins cher) |
| Tokens système | ~4500/requête | ~3000/requête |

---

## 4. Composants frontend

### 4.1 `LevelSelector`

Grille 6 boutons animés. Détecte automatiquement le sous-système et applique la couleur :
- **Bleu** → francophone (`BEPC_3EME`, `SECONDE`, `TERMINALE_BAC`)
- **Vert** → anglophone (`GCE_OL`, `GCE_AL`)
- **Violet** → les deux (`UNIVERSITE_BTS`)

```tsx
import { LevelSelector } from "@/components/orientation"

<LevelSelector onSelect={(level: EducationLevel) => setSelectedLevel(level)} />
```

### 4.2 `XkorientaChat`

Interface de chat complète avec streaming SSE.

```tsx
import { XkorientaChat } from "@/components/orientation"

<XkorientaChat
  level={selectedLevel}   // EducationLevel
  onReset={() => setSelectedLevel(null)}
/>
```

**Comportement** :
- Au montage, envoie automatiquement `config.initialMessage` sans interaction utilisateur
- Affiche les points de frappe animés pendant le streaming
- Rend le markdown (gras, listes, titres) via `react-markdown`
- Affiche le rapport final dans un bloc visuel distinct
- Auto-scroll à chaque nouveau token reçu

### 4.3 `LEVEL_CONFIGS`

Tableau de configuration des 6 niveaux, accessible pour construire des UI personnalisées :

```tsx
import { LEVEL_CONFIGS, getLevelConfig } from "@/types/orientation"

// Accès à la config d'un niveau
const config = getLevelConfig("TERMINALE_BAC")
// → { level, label, sublabel, language, system, initialMessage }

// Message initial envoyé automatiquement
config.initialMessage
// → "Bonjour ! Je suis en Terminale et je prépare mon BAC..."
```

---

## 5. Intégration streaming — Pattern complet

```tsx
const sendMessage = async (userContent: string, history: Message[]) => {
  const response = await fetch("/api/xkorienta/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [...history, { role: "user", content: userContent }],
      level,       // ex: "TERMINALE_BAC"
      language,    // "fr" | "en"
    }),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let accumulated = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") break

      const parsed = JSON.parse(data)
      if (parsed.error) throw new Error(parsed.error)
      if (parsed.text) {
        accumulated += parsed.text
        // Mettre à jour l'UI avec accumulated
      }
    }
  }
}
```

---

## 6. Pages & routes

### 6.1 Landing publique — `/orientation`

Page marketing avec hero, fonctionnalités, tarifs. Adapte ses CTAs selon l'état de connexion :

| État | CTA principal | CTA secondaire |
|---|---|---|
| Non connecté | "Commencer gratuitement" → `/register?returnTo=/checkout?plan=ELEVE` | "Voir les tarifs" → `#tarifs` |
| Connecté | "S'abonner maintenant" → `/checkout?plan=ELEVE` | "Voir le dashboard" → `/student/orientation/ai` |

### 6.2 Page dashboard — `/student/orientation/ai`

Protégée par la feature `ORIENTATION_AI` (voir Module 25).

**États gérés** :

| `status` | `can(ORIENTATION_AI)` | Rendu |
|---|---|---|
| `"loading"` | — | Spinner centré |
| `"unauthenticated"` | — | Redirect `/login?returnTo=...` |
| `"active"` | `false` | Écran "Abonnement requis" + lien `/checkout` |
| `"active"` | `true` | `LevelSelector` → `XkorientaChat` |

### 6.3 `/xkorienta/orientation`

Page standalone (hors dashboard) — accessible sans abonnement. Utile pour démos ou accès direct. Redirige vers `/orientation` si non utilisée.

---

## 7. Variables d'environnement

**Backend (`xkorienta-api/.env`)** :

| Variable | Valeur par défaut | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Requis.** Clé API Anthropic |
| `XKORIENTA_MODEL` | `claude-sonnet-4-6` | Modèle pour le rapport final |
| `XKORIENTA_CHAT_MODEL` | `claude-haiku-4-5-20251001` | Modèle pour les échanges conversationnels |

> Les deux variables modèle sont **optionnelles** — les valeurs par défaut sont suffisantes pour la production.

---

## 8. Rapport final — 9 modules générés

L'IA génère systématiquement ces 9 modules quand ≥ 8 des 11 dimensions ont été collectées :

| # | Module | Contenu |
|---|---|---|
| 1 | Diagnostic du profil | Forces, faiblesses, potentiel, maturité du projet |
| 2 | Équivalence académique | Correspondance BTS ↔ HND selon le niveau |
| 3 | Arbre des possibles | 3 options : Ambitieuse 🥇 / Réaliste 🥈 / Repli 🥉 |
| 4 | Score Xkorin (/100) | Valeur cognitive, employabilité, soft skills, logistique |
| 5 | Trust Index | Fiabilité du profil + 3 actions pour l'améliorer |
| 6 | Recommandations stratégiques | Formation, certifications, financement, établissements |
| 7 | Plan d'action | À 3 mois / 12 mois / 5 ans |
| 8 | Alerte de vigilance | Filières à éviter, risques, filières saturées |
| 9 | Conclusion d'orientation | Recommandation finale justifiée |

---

## 9. 11 dimensions collectées par l'IA

L'agent collecte ces informations via conversation naturelle (max 2 questions/message). Le rapport n'est généré qu'après ≥ 8 dimensions couvertes.

| # | Dimension |
|---|---|
| 1 | Diplôme actuel / niveau scolaire |
| 2 | Série ou spécialité suivie |
| 3 | Notes principales (moyennes par matière) |
| 4 | Matières fortes et faibles |
| 5 | Aspirations professionnelles déclarées |
| 6 | Situation financière familiale (FCFA/mois) |
| 7 | Ville / région de résidence |
| 8 | Mobilité possible ou non |
| 9 | Expériences : stages, projets, leadership |
| 10 | Soft skills : discipline, communication, autonomie |
| 11 | Contraintes : budget, logement, transport, famille |

---

## 10. Checklist intégration

- [ ] `ANTHROPIC_API_KEY` configurée dans `xkorienta-api/.env`
- [ ] Backend démarré sur port 3001 (`npm run dev` dans `xkorienta-api`)
- [ ] Frontend démarré sur port 3000 (`npm run dev` dans `xkorienta-app`)
- [ ] Proxy `/api/xkorienta/*` → `localhost:3001` configuré dans `next.config.ts` ✅ (déjà en place)
- [ ] Plan `ELEVE` avec `features: ["ORIENTATION_AI"]` dans la collection MongoDB `plans`
- [ ] `react-markdown` installé dans `xkorienta-app` (`npm install react-markdown`) ✅
- [ ] `SubscriptionProvider` dans `/(dashboard)/layout.tsx` ✅

---

## 11. Test rapide sans frontend

```bash
curl -X POST http://localhost:3001/api/xkorienta/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Bonjour, je suis en Terminale C, moyenne 14/20"}],
    "level": "TERMINALE_BAC",
    "language": "fr"
  }'
```

Réponse attendue : stream SSE avec tokens de texte, terminé par `data: [DONE]`.
