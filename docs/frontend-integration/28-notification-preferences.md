# Module 28 — Préférences de Notifications

> **Audience** : Équipe mobile Flutter  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3001`)  
> **Auth** : Cookie `next-auth.session-token`  
> **Dépendance** : Module 27 (Push Notifications FCM) doit être implémenté

---

## Vue d'ensemble

Ce module permet à l'utilisateur de contrôler **ce qui l'interrompt** — pas ce qui existe en base.

> La notification in-app (cloche) est **toujours créée**.  
> Seule la **bannière push** (FCM) est filtrée selon les préférences.

```
Événement métier → Notification créée en base (toujours)
                 → FCM gate :
                      channels.push activé ?    non → skip
                      type autorisé ?           non → skip
                      hors heures de silence ?  non → skip
                      → Push envoyée ✅
```

### Ce que l'app doit faire

| Action | Appel |
|---|---|
| Ouvrir l'écran Paramètres → Notifications | `GET /api/notification-preferences` |
| L'utilisateur toggle un switch | `PATCH /api/notification-preferences` (uniquement le champ modifié) |

---

## Structure des préférences

```json
{
  "channels": {
    "push": true,
    "email": false
  },
  "types": {
    "exam_result": true,
    "exam_pending": true,
    "new_message": true,
    "forum_reply": true,
    "assistance_response": true,
    "rewards": true,
    "account": true
  },
  "quietHours": {
    "enabled": false,
    "start": "22:00",
    "end": "06:00",
    "timezone": "Africa/Douala"
  }
}
```

### Explication des champs

#### `channels`

| Champ | Défaut | Description |
|---|---|---|
| `push` | `true` | **Master switch** — si `false`, aucune push FCM n'est envoyée, tous les autres toggles sont ignorés |
| `email` | `false` | Réservé pour une future intégration email (pas encore actif) |

#### `types`

Les 7 clés de `types` correspondent **exactement** aux 7 valeurs possibles du champ `category` sur une notification en base. C'est cette `category` qui est consultée avant l'envoi FCM.

| Clé préférence (`types.*`) | Valeur `category` | Défaut | Description courte |
|---|---|---|---|
| `exam_result` | `exam_result` | `true` | Résultats, corrections, validations d'examen |
| `exam_pending` | `exam_pending` | `true` | Examens à venir, syllabus, codes de retard |
| `new_message` | `new_message` | `true` | Messages privés / conversations |
| `forum_reply` | `forum_reply` | `true` | Réponses sur les forums |
| `assistance_response` | `assistance_response` | `true` | Demandes d'assistance |
| `rewards` | `rewards` | `true` | XP, niveaux, badges |
| `account` | `account` | `true` | Compte, sécurité, abonnement |

> **Règle** : `{ "types": { "exam_result": false } }` bloque toutes les push dont `category === "exam_result"`. La notif in-app (cloche) reste créée.

---

### Catalogue complet des catégories

Référence unique pour le frontend et le mobile : chaque ligne = une catégorie filtrable.

#### 1. `exam_result`

| | |
|---|---|
| **Clé PATCH** | `types.exam_result` |
| **Champ notification** | `category: "exam_result"` |
| **Événements branchés** | `EXAM_COMPLETED`, `EXAM_VALIDATED`, `ATTEMPT_GRADED` |
| **Exemples de titres** | « Examen réussi ! », « Examen corrigé », « Examen validé » |
| **Types UI (`notification.type`)** | `success`, `info` |

#### 2. `exam_pending`

| | |
|---|---|
| **Clé PATCH** | `types.exam_pending` |
| **Champ notification** | `category: "exam_pending"` |
| **Événements branchés** | `EXAM_CREATED`, `EXAM_PUBLISHED`, `EXAM_SUBMITTED_FOR_VALIDATION`, `SYLLABUS_CREATED`, `SYLLABUS_UPDATED`, `LATE_CODE_GENERATED` |
| **Exemples de titres** | « Nouvel Examen Planifié », « Nouveau Syllabus », « Code de retard généré » |
| **Types UI (`notification.type`)** | `info`, `success`, `alert` |

#### 3. `new_message`

| | |
|---|---|
| **Clé PATCH** | `types.new_message` |
| **Champ notification** | `category: "new_message"` |
| **Événements branchés** | *(pas encore implémenté — réservé messagerie)* |
| **Événements prévus** | nouveau message conversation, message enseignant → élève |
| **Types UI attendus** | `info` |

#### 4. `forum_reply`

| | |
|---|---|
| **Clé PATCH** | `types.forum_reply` |
| **Champ notification** | `category: "forum_reply"` |
| **Événements branchés** | *(pas encore implémenté)* |
| **Événements prévus** | `FORUM_REPLY_CREATED`, `FORUM_POST_CREATED` |
| **Types UI attendus** | `info` |

#### 5. `assistance_response`

| | |
|---|---|
| **Clé PATCH** | `types.assistance_response` |
| **Champ notification** | `category: "assistance_response"` |
| **Événements branchés** | *(pas encore implémenté)* |
| **Événements prévus** | `REQUEST_ACCEPTED`, `REQUEST_REJECTED`, `REQUEST_COMPLETED` |
| **Types UI attendus** | `info`, `success` |

#### 6. `rewards`

| | |
|---|---|
| **Clé PATCH** | `types.rewards` |
| **Champ notification** | `category: "rewards"` |
| **Événements branchés** | `BADGE_EARNED`, `LEVEL_UP`, `XP_GAINED` (seulement si gain ≥ 100 XP) |
| **Exemples de titres** | « Nouveau Badge », « Level Up », « +150 XP » |
| **Types UI (`notification.type`)** | `badge`, `level_up`, `xp` |

#### 7. `account`

| | |
|---|---|
| **Clé PATCH** | `types.account` |
| **Champ notification** | `category: "account"` |
| **Événements branchés** | `USER_REGISTERED` |
| **Événements prévus** | abonnement, sécurité, changement de mot de passe |
| **Exemples de titres** | « Bienvenue sur Xkorienta » |
| **Types UI (`notification.type`)** | `info` |

---

### Liste exhaustive (copier-coller)

Valeurs valides pour `category` et pour les clés de `types` :

```
exam_result
exam_pending
new_message
forum_reply
assistance_response
rewards
account
```

TypeScript côté API :

```typescript
type NotificationCategory =
  | 'exam_result'
  | 'exam_pending'
  | 'new_message'
  | 'forum_reply'
  | 'assistance_response'
  | 'rewards'
  | 'account'
```

### Événements sans notification push (pour info)

Ces `EventType` existent dans le backend mais ne créent **pas encore** de notification (donc aucune catégorie associée) :

```
EXAM_STARTED, EXAM_ARCHIVED, EXAM_STATUS_CHANGED
ATTEMPT_STARTED, ATTEMPT_SUBMITTED
QUESTION_ANSWERED
STREAK_ACHIEVED
LATE_CODE_USED
USER_PROFILE_COMPLETED
REQUEST_CREATED
FORUM_CREATED
```

> **Fallback legacy** : les anciennes notifications sans `category` utilisent encore `notification.type` (`badge` → `rewards`, `xp` → `rewards`, etc.). Les nouvelles notifications doivent toujours renseigner `category`.

#### `quietHours`

| Champ | Défaut | Description |
|---|---|---|
| `enabled` | `false` | Active/désactive les heures de silence |
| `start` | `"22:00"` | Début de la fenêtre silencieuse — format `HH:mm` |
| `end` | `"06:00"` | Fin de la fenêtre silencieuse — format `HH:mm` |
| `timezone` | `"Africa/Douala"` | Fuseau horaire IANA de l'utilisateur — la fenêtre est évaluée dans cette timezone |

> **Fenêtre traversant minuit** : `22:00 → 06:00` fonctionne correctement (22h à 6h du matin).

---

## 1. Lire les préférences — `GET /api/notification-preferences`

**Quand l'appeler** : à l'ouverture de l'écran Paramètres → Notifications.

**Comportement** : lazy init — si l'utilisateur n'a jamais configuré ses préférences, retourne et crée les valeurs par défaut (tout activé, pas de silence).

### Requête

```http
GET /api/notification-preferences
```

### Réponse 200

```json
{
  "success": true,
  "data": {
    "channels": {
      "push": true,
      "email": false
    },
    "types": {
      "exam_result": true,
      "exam_pending": true,
      "new_message": true,
      "forum_reply": true,
      "assistance_response": true,
      "rewards": true,
      "account": true
    },
    "quietHours": {
      "enabled": false,
      "start": "22:00",
      "end": "06:00",
      "timezone": "Africa/Douala"
    }
  }
}
```

### Exemple Flutter

```dart
Future<NotificationPreferences> loadPreferences() async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/notification-preferences'),
    headers: { 'Cookie': sessionCookie },
  );
  final json = jsonDecode(response.body);
  return NotificationPreferences.fromJson(json['data']);
}
```

---

## 2. Modifier les préférences — `PATCH /api/notification-preferences`

**Quand l'appeler** : à chaque toggle sur l'écran de paramètres.

**Comportement** : merge profond — seuls les champs envoyés sont modifiés. Les champs absents du body restent **intacts en base**.

### Requête

```http
PATCH /api/notification-preferences
Content-Type: application/json
```

### Exemples de body

#### Désactiver toutes les push (master switch)

```json
{ "channels": { "push": false } }
```

#### Désactiver uniquement les récompenses

```json
{ "types": { "rewards": false } }
```

#### Activer les heures de silence

```json
{
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "06:00",
    "timezone": "Africa/Douala"
  }
}
```

#### Modifier plusieurs champs d'un coup

```json
{
  "types": {
    "forum_reply": false,
    "rewards": false
  },
  "quietHours": {
    "enabled": true
  }
}
```

> **Règle de merge** : `{ "types": { "exam_result": false } }` ne touche **que** `exam_result`. Les 6 autres types restent inchangés.

### Réponse 200 — Succès

```json
{
  "success": true,
  "message": "Préférences mises à jour",
  "data": {
    "channels": { "push": true, "email": false },
    "types": {
      "exam_result": false,
      "exam_pending": true,
      "new_message": true,
      "forum_reply": true,
      "assistance_response": true,
      "rewards": true,
      "account": true
    },
    "quietHours": {
      "enabled": false,
      "start": "22:00",
      "end": "06:00",
      "timezone": "Africa/Douala"
    }
  }
}
```

### Réponses d'erreur

| Status | Exemple de body | Cause |
|---|---|---|
| `400` | `{ "success": false, "message": "Format d'heure invalide pour quietHours.start : \"25:00\" (attendu HH:mm)" }` | Format d'heure non valide |
| `400` | `{ "success": false, "message": "Fuseau horaire IANA invalide : \"UTC+1\"" }` | Timezone non reconnue par le standard IANA |
| `400` | `{ "success": false, "message": "Au moins un champ est requis..." }` | Body vide |
| `401` | `{ "success": false, "message": "Unauthorized" }` | Session expirée |

### Validation des champs

| Champ | Format attendu | Exemples valides | Exemples invalides |
|---|---|---|---|
| `quietHours.start` | `HH:mm` (24h) | `"06:00"`, `"22:30"`, `"00:00"` | `"25:00"`, `"6:00"`, `"10pm"` |
| `quietHours.end` | `HH:mm` (24h) | `"06:00"`, `"08:45"` | `"24:00"`, `"6h"` |
| `quietHours.timezone` | IANA timezone | `"Africa/Douala"`, `"Europe/Paris"`, `"America/New_York"` | `"UTC+1"`, `"GMT+2"`, `"Paris"` |

### Exemple Flutter — toggle optimiste

```dart
Future<void> updatePreference({
  required String section,  // 'channels', 'types', 'quietHours'
  required String key,
  required dynamic value,
}) async {
  // Update UI optimiste
  setState(() => _updateLocal(section, key, value));

  try {
    final response = await http.patch(
      Uri.parse('$baseUrl/api/notification-preferences'),
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: jsonEncode({
        section: { key: value },
      }),
    );

    if (response.statusCode != 200) {
      // Rollback si erreur
      setState(() => _revertLocal(section, key));
      showErrorSnackbar(jsonDecode(response.body)['message']);
    }
  } catch (e) {
    setState(() => _revertLocal(section, key));
  }
}

// Exemples d'appels :
updatePreference(section: 'types', key: 'rewards', value: false);
updatePreference(section: 'channels', key: 'push', value: false);
updatePreference(section: 'quietHours', key: 'enabled', value: true);
```

---

## 3. Comportement multi-appareils

Les préférences sont **par utilisateur, pas par appareil**.

Si l'utilisateur désactive les push depuis son téléphone → sa tablette arrête aussi de recevoir les push. C'est le comportement attendu : l'utilisateur gère ses préférences dans un seul endroit, quel que soit l'appareil sur lequel il les modifie.

---

## 4. Suggestions pour l'écran Paramètres

### Structure recommandée

```
Notifications
├── Push notifications          [toggle: channels.push]
│   └── (si désactivé → badge sur tout l'écran "push désactivé")
│
├── Résultats d'examen          [toggle: types.exam_result]
├── Examens à venir             [toggle: types.exam_pending]
├── Messages                    [toggle: types.new_message]
├── Forums                      [toggle: types.forum_reply]
├── Assistance                  [toggle: types.assistance_response]
├── Récompenses (XP, badges)    [toggle: types.rewards]
├── Compte & abonnement         [toggle: types.account]
│
└── Heures de silence           [toggle: quietHours.enabled]
    ├── De : [time picker]      → quietHours.start
    ├── À  : [time picker]      → quietHours.end
    └── Fuseau horaire          → quietHours.timezone (auto-détecté)
```

### Récupération automatique du fuseau horaire

```dart
// Récupérer la timezone IANA de l'appareil
import 'package:flutter_timezone/flutter_timezone.dart';

final timezone = await FlutterTimezone.getLocalTimezone();
// ex: "Africa/Douala", "Europe/Paris"

// Envoyer au moment de l'activation des heures de silence :
updatePreference(
  section: 'quietHours',
  key: 'timezone',
  value: timezone,
);
```

---

## 5. Checklist d'intégration

```
[ ] GET /api/notification-preferences appelé à l'ouverture de l'écran
[ ] Chaque toggle fait un PATCH avec uniquement le champ modifié
[ ] Update optimiste + rollback en cas d'erreur
[ ] Timezone IANA auto-détectée depuis l'appareil (flutter_timezone ou équivalent)
[ ] Le master switch (channels.push) grise les autres toggles quand il est off
[ ] Heures de silence : time picker en format HH:mm + timezone auto
[ ] Erreurs de validation (400) affichées à l'utilisateur
```
