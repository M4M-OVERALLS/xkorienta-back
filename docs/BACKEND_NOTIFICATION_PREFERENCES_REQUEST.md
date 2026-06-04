# Demande Backend — Préférences de Notifications

Cette doc demande l'ajout d'un système de **préférences de notifications par utilisateur** côté backend. C'est le complément naturel du système FCM décrit dans [`BACKEND_PUSH_NOTIFICATIONS_REQUEST.md`](BACKEND_PUSH_NOTIFICATIONS_REQUEST.md) : aujourd'hui, **tous les events métier déclenchent une push** sans filtrage. Les apprenants doivent pouvoir choisir ce qu'ils reçoivent.

---

## 1. Vue d'ensemble — pourquoi côté backend ?

### Le problème

Le client mobile prévoit un écran « Paramètres → Notifications » avec des toggles :

- Canaux : Push (on/off), Email (on/off)
- Types : Résultats d'examen, Messages, Forums, Assistance, Récompenses, Compte
- Heures de silence : 22h → 6h (par ex.)

**Tentation naïve** : stocker ces toggles dans `SharedPreferences` (côté téléphone) et c'est réglé.

**Pourquoi ça ne marche pas** : les push partent du **serveur**, pas du téléphone. Si la préférence « Résultats : off » n'existe que dans le téléphone, le backend l'ignore et envoie quand même la bannière. L'app ne peut filtrer **qu'après** réception, et même là, la bannière a déjà fait vibrer le téléphone.

### Le bon design

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   App Flutter            │         │   Backend Xkorienta      │
│                          │         │                          │
│   Settings screen        │ ──GET── ►  GET  /api/notification-│
│   loads toggles          │ ◄──────── │      preferences         │
│                          │         │                          │
│   User toggles "Résultats│ ─PATCH─ ►  PATCH /api/notification-│
│   d'examen" off          │ ◄──────── │      preferences         │
│                          │         │                          │
└─────────────────────────┘         └──────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────┐
                                  │  NotificationObserver     │
                                  │  (futur événement métier) │
                                  │                           │
                                  │  Avant d'envoyer FCM :    │
                                  │  - Push activé ?          │
                                  │  - Type activé ?          │
                                  │  - Hors heures silence ?  │
                                  │  → Si oui à tout, envoie  │
                                  │  → Sinon, skip            │
                                  └──────────────────────────┘
```

Les préférences vivent côté backend, **consultées avant chaque envoi FCM**. Le client mobile ne fait que les lire et les mettre à jour.

### Périmètre

| Préoccupation                                        | Côté                                                    |
| ---------------------------------------------------- | ------------------------------------------------------- |
| Stockage des préférences                             | **Backend**                                             |
| Filtrage avant envoi push                            | **Backend** (dans `NotificationObserver`)               |
| UI des toggles                                       | Mobile                                                  |
| Permission OS (Android 13+, iOS)                     | Mobile (via `permission_handler`)                       |
| État synchronisé entre tous les devices du même user | **Backend** (un seul user = un seul jeu de préférences) |

---

## 2. Ce que le mobile attend EXACTEMENT du backend

| #   | Quand                                                   | Ce que l'app fait                                                          | Ce que tu dois faire                                                      |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Ouverture de l'écran Paramètres → Notifications         | `GET /api/notification-preferences`                                        | Retourner les préférences du user (ou les défauts si jamais sauvegardées) |
| 2   | À chaque toggle                                         | `PATCH /api/notification-preferences` avec le champ modifié                | Faire un upsert partiel des champs envoyés                                |
| 3   | Création d'une notification dans `NotificationObserver` | Rien — le client reçoit (ou ne reçoit pas) la push selon ce que tu envoies | **Consulter les préférences AVANT** d'appeler FCM et skip si nécessaire   |

**Côté backend, il faut donc :**

1. **Créer un modèle** `NotificationPreferences` (section 4)
2. **Créer 2 endpoints** : `GET` et `PATCH` `/api/notification-preferences` (section 5)
3. **Étendre `NotificationObserver`** : avant d'envoyer la push FCM, consulter les préférences et filtrer (section 6)

---

## 3. Comportement IN-APP vs PUSH — décision à valider

⚠️ **Question d'architecture importante** :

Une notification a deux faces :

- **In-app** : la ligne dans la cloche, le badge non-lu (issu de `GET /api/notifications`)
- **Push** : la bannière sur l'écran de verrouillage (issue de FCM)

**Que se passe-t-il si l'utilisateur a désactivé "Résultats d'examen" ?**

Option A — **Push seulement filtré (recommandé)** :

- ✅ La notif est **toujours créée** dans la base (`Notification.create`)
- ❌ La push FCM **n'est pas envoyée**
- → L'utilisateur peut quand même voir le résultat dans la cloche s'il ouvre l'app, sans être interrompu par une bannière

Option B — **Tout filtré** :

- ❌ La notif n'est PAS créée du tout
- ❌ La push FCM n'est pas envoyée non plus
- → L'utilisateur ne saura jamais qu'il a un résultat tant qu'il ne va pas voir manuellement

**Recommandation** : **Option A**. Les préférences contrôlent ce qui **interrompt** l'utilisateur (bannière, son, vibration), pas ce qui existe en base. La cloche reste l'historique complet.

Si tu choisis l'Option B : confirme avec le PO avant d'implémenter.

---

## 4. Modèle `NotificationPreferences`

Créer la collection/table :

```ts
NotificationPreferences {
  userId:        ObjectId;        // FK vers User — unique (1 user = 1 ligne)
  channels: {
    push:        boolean;          // master switch pour toutes les push FCM
    email:       boolean;          // pour le futur — peut rester false par défaut
  };
  types: {
    exam_result:         boolean;  // résultats d'examen publiés
    exam_pending:        boolean;  // examens à venir / rappels
    new_message:         boolean;  // nouveau message direct d'un enseignant ou pair
    forum_reply:         boolean;  // réponse sur un fil de forum
    assistance_response: boolean;  // réponse à une demande d'assistance
    rewards:             boolean;  // XP gagné, niveau atteint, badge débloqué
    account:             boolean;  // sécurité, abonnement, changements de compte
  };
  quietHours: {
    enabled:     boolean;          // les heures de silence sont actives
    start:       string;           // "22:00" — format HH:mm 24h
    end:         string;           // "06:00" — format HH:mm 24h
    timezone:    string;           // "Africa/Douala" — IANA timezone du user
  };
  createdAt:     Date;
  updatedAt:     Date;
}
```

### Contraintes

- Index **unique** sur `userId` (un user = exactement une ligne)
- Tous les champs ont une **valeur par défaut** appliquée à la création (voir section 4.1)
- `quietHours.timezone` est nécessaire car « 22h–6h » a un sens uniquement dans la timezone du user. Sans timezone, un user à Yaoundé qui voyage à Paris verrait ses heures de silence se décaler.

### 4.1 Valeurs par défaut (nouveau user)

À retourner par `GET` si aucune ligne n'existe pour ce `userId` (lazy init OK) :

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

**Logique recommandée** : opt-out plutôt qu'opt-in. Par défaut tout est activé, l'utilisateur désactive ce qu'il ne veut pas. C'est ce que font la plupart des apps grand public.

---

## 5. Endpoints

### 5.1 `GET /api/notification-preferences`

**Auth** : session NextAuth (cookie).

**But** : retourner les préférences de l'utilisateur connecté.

**Comportement** :

```ts
let prefs = await NotificationPreferences.findOne({ userId: session.userId });
if (!prefs) {
  // Lazy init — première fois que cet utilisateur ouvre l'écran.
  prefs = await NotificationPreferences.create({
    userId: session.userId,
    ...defaultPreferences,
  });
}
return prefs;
```

**Réponse 200** :

```json
{
  "success": true,
  "data": {
    "channels": { "push": true, "email": false },
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

**Erreur (401, 500)** :

```json
{ "success": false, "message": "Message lisible" }
```

---

### 5.2 `PATCH /api/notification-preferences`

**Auth** : session NextAuth.

**But** : mettre à jour partiellement les préférences. Le mobile envoie **uniquement** les champs modifiés (pour économiser bande passante et permettre les updates optimistes).

**Body — tous les champs sont optionnels** :

```json
{
  "channels": { "push": false },
  "types": { "exam_result": false },
  "quietHours": { "enabled": true, "start": "23:00", "end": "07:00" }
}
```

**Comportement** :

Faire un **merge profond** des champs envoyés avec ceux en base. **Ne pas écraser** les champs absents :

```ts
const existing =
  (await NotificationPreferences.findOne({ userId: session.userId })) ??
  (await createWithDefaults(session.userId));

// Merge profond — chaque sous-objet est merged séparément.
if (body.channels) {
  existing.channels = { ...existing.channels, ...body.channels };
}
if (body.types) {
  existing.types = { ...existing.types, ...body.types };
}
if (body.quietHours) {
  existing.quietHours = { ...existing.quietHours, ...body.quietHours };
}
existing.updatedAt = new Date();
await existing.save();

return existing;
```

> ⚠️ Sans le merge profond, si le mobile envoie `{ "types": { "exam_result": false } }`, tous les autres types passeraient à `null` / `undefined`.

**Validation à ajouter** :

- `quietHours.start` et `quietHours.end` : format HH:mm (regex `^([01]\d|2[0-3]):[0-5]\d$`)
- `quietHours.timezone` : présent dans la liste IANA (`Africa/Douala`, `Europe/Paris`, etc.)
- Toutes les valeurs booléennes ne sont pas null

**Réponse 200** :

```json
{
  "success": true,
  "message": "Préférences mises à jour",
  "data": {
    /* l'objet complet après merge */
  }
}
```

**Erreur (400 si validation échoue)** :

```json
{ "success": false, "message": "Format d'heure invalide pour quietHours.start" }
```

---

## 6. Intégration dans `NotificationObserver` — le filtrage

C'est **le cœur** de cette feature. Sans ça, les préférences sont des toggles cosmétiques.

### 6.1 Où ajouter le code

Aujourd'hui, `NotificationObserver` fait (cf. `BACKEND_PUSH_NOTIFICATIONS_REQUEST.md` section 5.1) :

```ts
await Notification.create({ userId, type, title, message, read: false, data });

const devices = await NotificationDevice.find({ userId });
if (devices.length === 0) return;

// ... construit le payload FCM et envoie via admin.messaging().sendEachForMulticast
```

**À ajouter entre `Notification.create` et l'envoi FCM** : un gate qui consulte les préférences.

```ts
// 1. La notif in-app est TOUJOURS créée — l'utilisateur la verra dans la cloche
//    (cf. Option A de la section 3 de cette doc).
await Notification.create({ userId, type, title, message, read: false, data });

// 2. Charge les préférences (avec lazy init si elles n'existent pas)
const prefs = await getOrCreatePreferences(userId);

// 3. Gate #1 — master switch push
if (!prefs.channels.push) return;

// 4. Gate #2 — type-spécifique
const typeAllowed = isTypeAllowed(type, prefs.types);
if (!typeAllowed) return;

// 5. Gate #3 — heures de silence
if (isInQuietHours(prefs.quietHours)) return;

// 6. Sinon, on continue avec l'envoi FCM existant (section 5 de la doc FCM)
const devices = await NotificationDevice.find({ userId });
if (devices.length === 0) return;
// ... reste du code FCM
```

### 6.2 Mapping `type` interne → catégorie de préférences

Certains types backend sont plus granulaires que les catégories user-facing. À regrouper :

| `type` backend (passé à `Notification.create`) | Catégorie préférence (`prefs.types.X`) |
| ---------------------------------------------- | -------------------------------------- |
| `exam_result`                                  | `exam_result`                          |
| `exam_pending`                                 | `exam_pending`                         |
| `exam_reminder`                                | `exam_pending`                         |
| `new_message`                                  | `new_message`                          |
| `forum_reply`                                  | `forum_reply`                          |
| `assistance_response`                          | `assistance_response`                  |
| `xp`                                           | `rewards`                              |
| `level_up`                                     | `rewards`                              |
| `badge`                                        | `rewards`                              |
| `subscription_warning`                         | `account`                              |
| `account`                                      | `account`                              |
| (autre / inconnu)                              | toujours envoyé — fallback safe        |

Implémentation :

```ts
function isTypeAllowed(type: string, typePrefs: TypePreferences): boolean {
  const map: Record<string, keyof TypePreferences> = {
    exam_result: "exam_result",
    exam_pending: "exam_pending",
    exam_reminder: "exam_pending",
    new_message: "new_message",
    forum_reply: "forum_reply",
    assistance_response: "assistance_response",
    xp: "rewards",
    level_up: "rewards",
    badge: "rewards",
    subscription_warning: "account",
    account: "account",
  };
  const category = map[type];
  if (!category) return true; // type inconnu → on envoie (safe default)
  return typePrefs[category] === true;
}
```

### 6.3 Logique des heures de silence

Important : **la comparaison doit se faire dans la timezone du user**, pas celle du serveur.

```ts
function isInQuietHours(qh: QuietHours): boolean {
  if (!qh.enabled) return false;

  // Convertit "now" dans la timezone du user (ex: Africa/Douala)
  const nowInUserTz = DateTime.now().setZone(qh.timezone);
  const currentMinutes = nowInUserTz.hour * 60 + nowInUserTz.minute;

  const [sH, sM] = qh.start.split(":").map(Number);
  const [eH, eM] = qh.end.split(":").map(Number);
  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;

  // Cas 1 : fenêtre sur la même journée (ex: 09:00 → 17:00)
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Cas 2 : fenêtre qui traverse minuit (ex: 22:00 → 06:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
```

Lib recommandée : `luxon` (`DateTime.setZone()`) ou `date-fns-tz`. Pas besoin de coder le calcul timezone à la main.

---

## 7. Multi-device — comportement attendu

Un user peut avoir plusieurs appareils (cf. `BACKEND_PUSH_NOTIFICATIONS_REQUEST.md` section 7).

**Règle** : les préférences sont **par user**, pas par device. Si le user désactive « Résultats » sur son téléphone, il les désactive **partout** (tablette, autre téléphone). C'est ce que l'utilisateur attend intuitivement.

Conséquence : pas besoin de complexifier le schéma — un seul document `NotificationPreferences` par `userId` suffit.

---

## 8. Cas de test à valider

| #   | Cas                                                                                                   | Attendu                                                                 |
| --- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Premier `GET` pour un user sans préférences en base                                                   | Retourne les défauts + crée une ligne en lazy init                      |
| 2   | `PATCH` avec uniquement `{ "types": { "exam_result": false } }`                                       | Seul `types.exam_result` change, le reste reste intact                  |
| 3   | `NotificationObserver` crée une notif `exam_result` alors que `types.exam_result = false`             | La notif in-app est créée mais **aucune push FCM** n'est envoyée        |
| 4   | `NotificationObserver` crée une notif `exam_result` avec `channels.push = false` (master switch off)  | Pareil : in-app oui, push non                                           |
| 5   | `NotificationObserver` envoie à 23:30 avec quietHours `22:00 → 06:00` activé (timezone Africa/Douala) | In-app oui, push non — on est dans la fenêtre silence                   |
| 6   | Pareil mais à 07:00                                                                                   | Push envoyée — on est sorti de la fenêtre                               |
| 7   | `PATCH` avec `quietHours.start = "25:00"`                                                             | Erreur 400 : format invalide                                            |
| 8   | User a 2 devices → désactive push depuis l'un                                                         | Les 2 devices arrêtent de recevoir (préférence partagée)                |
| 9   | Type backend inconnu (futur ajout) → fallback                                                         | Push envoyée (safe default, on ne loupe pas une notif faute de mapping) |

---

## 9. Tests en isolation (sans le mobile)

Pour valider le filtrage sans dépendre du client :

```ts
// 1. Set les préférences d'un user de test
await NotificationPreferences.findOneAndUpdate(
  { userId: "TEST_USER_ID" },
  { $set: { "types.exam_result": false } },
  { upsert: true },
);

// 2. Déclenche un événement métier qui crée une notif exam_result
await NotificationObserver.notify("TEST_USER_ID", {
  type: "exam_result",
  title: "Résultat publié",
  message: "...",
});

// 3. Vérifie :
//    - Notification.find({ userId, type: "exam_result" }) → 1 doc ✅
//    - Aucun appel à admin.messaging().send() → ❌ pas de push
//    - NotificationDevice.lastUsedAt → inchangé
```

---

## 10. Checklist

- [ ] Modèle `NotificationPreferences` créé avec index unique sur `userId`
- [ ] `GET /api/notification-preferences` implémenté avec lazy init des défauts
- [ ] `PATCH /api/notification-preferences` implémenté avec **merge profond** + validation HH:mm + timezone IANA
- [ ] Helper `isTypeAllowed(type, typePrefs)` avec mapping type → catégorie
- [ ] Helper `isInQuietHours(quietHours)` avec gestion timezone via `luxon` ou équivalent + gestion fenêtre qui traverse minuit
- [ ] `NotificationObserver` consulte les préférences **après** `Notification.create` et **avant** l'envoi FCM
- [ ] Décision validée : Option A (in-app toujours créée, push gated) ou Option B (les deux gated)
- [ ] Les 9 cas de test (section 8) validés

---

## 11. Glossaire — termes à connaître

| Terme                 | Définition                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Master switch**     | Le toggle principal "Notifications push" qui éteint TOUT (= `channels.push: false`). Override tous les autres toggles type-spécifiques.                                       |
| **Type**              | Catégorie sémantique de notification (résultat d'examen, nouveau message, etc.). 7 catégories définies dans `prefs.types`.                                                    |
| **Canal**             | Média de livraison : push (FCM), email (futur), in-app (toujours présent). `prefs.channels` contrôle les médias actifs.                                                       |
| **Heures de silence** | Fenêtre quotidienne où les push sont muettes. La notif est toujours créée mais sans bannière. Évalué en timezone user.                                                        |
| **Merge profond**     | Update partiel d'un objet nested : on ne remplace pas l'objet entier, juste les clés envoyées. Crucial pour `PATCH`.                                                          |
| **Lazy init**         | Création à la demande : la ligne `NotificationPreferences` est créée la première fois que le user ouvre l'écran ou qu'on consulte ses prefs. Évite de devoir migrer en masse. |
| **Opt-out**           | Tout est activé par défaut, l'utilisateur désactive ce qu'il ne veut pas. Inverse d'opt-in (tout désactivé par défaut).                                                       |
| **IANA timezone**     | Identifiant standardisé de fuseau horaire (`Africa/Douala`, `Europe/Paris`). À préférer à des offsets fixes (+01:00) car gère automatiquement DST/heure d'été.                |

---
