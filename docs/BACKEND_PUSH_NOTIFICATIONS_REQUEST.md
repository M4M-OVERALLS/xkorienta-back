# Demande Backend — Push Notifications via Firebase Cloud Messaging

Cette doc est faite pour que tu puisses implémenter les push notifs **même si tu n'as jamais touché à Firebase**. Je commence par expliquer comment ça marche, puis je liste précisément ce que j'attends de toi côté backend.

---

## 1. Vue d'ensemble — c'est quoi une push notif et FCM ?

### Le problème

Aujourd'hui, l'app mobile Xkorienta affiche les notifications via `/api/notifications` (la cloche). **Mais l'app doit être ouverte pour les voir.** Si l'utilisateur a fermé l'app et qu'un résultat d'examen arrive, il ne le saura qu'en rouvrant l'app.

### La solution : FCM (Firebase Cloud Messaging)

FCM est un service Google qui permet d'envoyer des notifications au téléphone d'un utilisateur **même quand son app est fermée**. C'est comme un facteur entre ton serveur backend et le téléphone.

### Schéma du flow complet

```
┌──────────────────────┐    1. Login NextAuth     ┌──────────────────────┐
│   Téléphone user      │ ───────────────────────► │   Backend Xkorienta   │
│   (app Flutter)       │ ◄─────────────────────── │                      │
└──────────────────────┘    session cookie         └──────────────────────┘
         │
         │  2. L'app demande son "adresse postale" à Firebase
         ▼
┌──────────────────────┐
│      Firebase         │  ──► génère un FCM token unique pour ce téléphone
│   (Google Cloud)      │       (chaîne de ~150 caractères)
└──────────────────────┘
         │
         │  3. L'app envoie ce token au backend
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│   POST /api/notification-devices                                       │
│   { token: "AAA...", platform: "android", deviceId: "uuid..." }       │
│                                                                       │
│   → Backend stocke dans la collection NotificationDevice              │
│     { userId: "U1", token: "AAA...", platform: "android", ... }       │
└──────────────────────────────────────────────────────────────────────┘
         │
         │  4. Plus tard : événement métier
         │     (ex: résultat d'examen prêt)
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│   NotificationObserver (côté backend) :                                │
│                                                                       │
│   a) Crée la notif in-app (déjà existant)                            │
│      → Notification.create({ userId: "U1", type, title, message })   │
│                                                                       │
│   b) NOUVEAU : envoie aussi une push FCM                             │
│      → Récupère tous les tokens du user "U1"                         │
│      → admin.messaging().sendEachForMulticast({ tokens, ... })       │
└──────────────────────────────────────────────────────────────────────┘
         │
         │  5. Firebase route la notif vers le bon téléphone
         ▼
┌──────────────────────┐
│      Firebase         │  ──► sait que "AAA..." = téléphone du user U1
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│   Téléphone user      │  ✅ La bannière s'affiche, même app fermée
│                       │  ✅ Tap sur la bannière → l'app s'ouvre
│                       │     directement sur l'écran ciblé
└──────────────────────┘
```

### Au logout

```
┌──────────────────────┐    DELETE /api/notification-devices    ┌─────────────┐
│   Téléphone user      │ ─────────────────────────────────────► │  Backend     │
│                       │    { token: "AAA..." }                  │              │
└──────────────────────┘                                          └─────────────┘
                                                                        │
                                                                        ▼
                                            Supprime la ligne de NotificationDevice
                                            → l'utilisateur ne reçoit plus rien
                                              jusqu'au prochain login
```

---

## 2. Ce que le mobile (Flutter) attend EXACTEMENT du backend

Le code mobile est **déjà 100% prêt**. Il fait déjà les actions suivantes, et il attend que tes endpoints répondent comme spécifié :

| #   | Quand                                                    | Ce que l'app fait                                               | Ce que tu dois faire                                                                     |
| --- | -------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | À chaque login                                           | Récupère son FCM token et `POST /api/notification-devices` avec | Stocker `(userId, token, platform, deviceId)` en base — **upsert** sur le token          |
| 2   | À chaque rotation de token FCM (rare, géré par Firebase) | Re-`POST /api/notification-devices` avec le nouveau token       | Idem — **upsert** sur le token                                                           |
| 3   | À chaque logout                                          | `DELETE /api/notification-devices` avec le token                | Supprimer la ligne `(userId, token)`                                                     |
| 4   | Quand une notif arrive en background                     | Affiche la bannière automatiquement (géré par l'OS)             | Rien à faire — c'est juste un payload FCM bien formé qu'il faut envoyer (voir section 5) |
| 5   | Quand l'utilisateur tape la bannière                     | Lit `data.route` du payload FCM et navigue                      | Inclure un champ `data.route` **déjà résolu** dans chaque push (voir section 5.2)        |

**Côté toi, il faut donc :**

1. **Créer un modèle** `NotificationDevice` (section 4)
2. **Créer 2 endpoints** : `POST` et `DELETE` `/api/notification-devices` (section 4)
3. **Étendre `NotificationObserver`** : après chaque `Notification.create`, envoyer aussi une push FCM via `firebase-admin` (section 5)
4. **Nettoyer automatiquement** les tokens invalides retournés par Firebase (section 6)

C'est tout — pas de WebSocket, pas de polling, pas de cron.

---

## 3. Ce que tu reçois pour démarrer

- **Service Account JSON Firebase** (fichier `xkorienta-firebase-adminsdk-xxxxx.json`)
- **Project ID Firebase** : `xkorienta`

### Installation

```bash
npm install firebase-admin
```

### Initialisation au démarrage du serveur

```ts
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!),
  ),
});
```

⚠️ **Sécurité critique** :

- Le JSON donne un **accès total** à Firebase pour le projet — à traiter comme un mot de passe
- **Stocker dans une variable d'environnement** `FIREBASE_SERVICE_ACCOUNT_JSON` (ou un secret manager)
- **JAMAIS commiter le fichier JSON dans git**
- Ajouter `*firebase-adminsdk*.json` dans `.gitignore` par sécurité

---

## 4. Modèle + Endpoints

### 4.1 Modèle `NotificationDevice`

```ts
NotificationDevice {
  userId:      ObjectId;       // FK vers User
  token:       string;         // FCM token (~150 caractères)
  platform:    "android" | "ios" | "web";
  deviceId?:   string;         // UUID v4 envoyé par le client (optionnel)
  createdAt:   Date;
  updatedAt:   Date;
  lastUsedAt?: Date;
}
```

**Contraintes** :

- Index **unique** sur `token`
- Index sur `userId` (pour les lookups rapides au moment d'envoyer une push)
- Un même `userId` peut avoir **plusieurs lignes** (un user = N appareils possibles)

---

### 4.2 `POST /api/notification-devices`

**But** : enregistrer un nouveau device OU rafraîchir un device existant.

**Auth** : session NextAuth (cookie).

**Body envoyé par l'app** :

```json
{
  "token": "dGhpcyBpcyBhIGZjbSB0b2tlbg...",
  "platform": "android",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**⚠️ Comportement critique — IDEMPOTENCE** :

Ce endpoint est appelé **à chaque ouverture de l'app après login**. Si tu fais un `INSERT` brut à chaque fois, tu auras N lignes en doublon pour le même token → l'utilisateur recevra la même notif N fois.

**Il faut faire un upsert sur le token** :

```ts
const existing = await NotificationDevice.findOne({ token: body.token });

if (existing) {
  // Le token existe déjà — UPDATE, pas INSERT.
  // On réécrit userId au cas où l'appareil aurait changé d'utilisateur
  // (ex: deux personnes qui se prêtent un téléphone).
  existing.userId = session.userId;
  existing.platform = body.platform;
  existing.deviceId = body.deviceId;
  existing.updatedAt = new Date();
  existing.lastUsedAt = new Date();
  await existing.save();
} else {
  await NotificationDevice.create({
    userId: session.userId,
    token: body.token,
    platform: body.platform,
    deviceId: body.deviceId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: new Date(),
  });
}
```

**Réponse succès (200)** :

```json
{ "success": true, "message": "Device registered" }
```

**Réponse erreur (4xx/5xx)** :

```json
{ "success": false, "message": "Message d'erreur lisible" }
```

---

### 4.3 `DELETE /api/notification-devices`

**But** : désinscrire un device au logout.

**Auth** : session NextAuth (l'app envoie ce DELETE **avant** le signout, donc la session est encore valide).

**Body** :

```json
{ "token": "dGhpcyBpcyBhIGZjbSB0b2tlbg..." }
```

**Comportement** :

```ts
await NotificationDevice.deleteOne({
  userId: session.userId,
  token: body.token,
});
```

> Filtrer sur `userId` ET `token` empêche un user malveillant de supprimer le token d'un autre.

**Réponse** :

```json
{ "success": true, "message": "Device removed" }
```

---

## 5. Envoi FCM dans `NotificationObserver`

### 5.1 Où ajouter le code

Aujourd'hui, `NotificationObserver.ts` fait :

```ts
await Notification.create({ userId, type, title, message, read: false, data });
```

À ajouter **juste après cette création** :

```ts
// 1. Récupère tous les devices actifs du user
const devices = await NotificationDevice.find({ userId });
if (devices.length === 0) return; // aucun device → on saute

// 2. Construit le payload FCM
const fcmMessage = {
  notification: {
    title: title, // Affiché sur la bannière
    body: message, // Texte court sous le titre
  },
  data: {
    notificationId: String(notification._id),
    type: type,
    route: resolveRouteFromType(type, data), // ← Section 5.2
    ...flattenDataForFcm(data), // FCM exige des string uniquement
  },
  android: {
    notification: { channel_id: "xkorienta_default_channel" },
  },
  apns: {
    payload: { aps: { sound: "default" } },
  },
};

// 3. Envoi multicast (un seul appel pour tous les devices du user)
const tokens = devices.map((d) => d.token);
const response = await admin.messaging().sendEachForMulticast({
  tokens,
  ...fcmMessage,
});

// 4. Nettoyage des tokens invalides (Section 6)
await cleanupInvalidTokens(devices, response);

// 5. Mise à jour de lastUsedAt sur les tokens qui ont réussi
const successfulTokens = devices
  .filter((_, i) => response.responses[i].success)
  .map((d) => d.token);

if (successfulTokens.length > 0) {
  await NotificationDevice.updateMany(
    { token: { $in: successfulTokens } },
    { $set: { lastUsedAt: new Date() } },
  );
}
```

### 5.2 Champ `data.route` — TOUJOURS résolu

Quand l'utilisateur tape la bannière, l'app lit `data.route` et navigue vers cette URL. **Il faut envoyer la route déjà résolue avec les vrais IDs**, pas un template avec placeholders.

✅ **Bon** :

```json
"route": "/exam/65a3f7abc/result"
```

❌ **Mauvais** :

```json
"route": "/exam/:examId/result"
```

**Mapping `type` → route à implémenter dans `resolveRouteFromType`** :

| `type`                | Route à construire                 |
| --------------------- | ---------------------------------- |
| `exam_result`         | `/exam/{examId}/result`            |
| `exam_pending`        | `/exam/{examId}/pending`           |
| `new_message`         | `/messaging/chat/{conversationId}` |
| `forum_reply`         | `/messaging/forum/{forumId}`       |
| `assistance_response` | `/assistance/review`               |

À étendre quand de nouveaux `type` seront ajoutés. Le backend reste la **source de vérité** du mapping.

### 5.3 Détails critiques du payload — à ne pas oublier

| Champ                             | Pourquoi c'est important                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `notification.title` / `body`     | Texte affiché sur l'écran de verrouillage et la barre de notif                                                    |
| `data.notificationId`             | Permet au client de marquer comme lu via `PATCH /api/notifications`                                               |
| `data.route`                      | **Déjà résolue** — section 5.2                                                                                    |
| `android.notification.channel_id` | **Exactement `xkorienta_default_channel`** — sinon Android 8+ silencie la notif                                   |
| `apns.payload.aps.sound`          | Sans ça, iOS ne joue pas de son et ne vibre pas                                                                   |
| **Valeurs de `data`**             | **Doivent toutes être des `string`** — FCM rejette nombres, booléens, objets imbriqués. Convertir tout en string. |

### 5.4 Fonction utilitaire `flattenDataForFcm`

Comme FCM exige des string uniquement dans `data`, prévois une petite fonction :

```ts
function flattenDataForFcm(data: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined) continue;
    result[key] =
      typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return result;
}
```

---

## 6. Nettoyage automatique des tokens invalides

Firebase peut retourner certains codes d'erreur quand un token n'est plus valide (app désinstallée, etc.). Il faut supprimer ces tokens en base pour ne pas continuer à essayer de les joindre.

```ts
async function cleanupInvalidTokens(
  devices: NotificationDevice[],
  response: admin.messaging.BatchResponse,
) {
  const tokensToDelete: string[] = [];

  response.responses.forEach((res, i) => {
    if (!res.success) {
      const code = res.error?.code;
      if (
        code === "messaging/registration-token-not-registered" || // app désinstallée
        code === "messaging/invalid-registration-token" || // token corrompu
        code === "messaging/invalid-argument" // token mal formé
      ) {
        tokensToDelete.push(devices[i].token);
      }
    }
  });

  if (tokensToDelete.length > 0) {
    await NotificationDevice.deleteMany({ token: { $in: tokensToDelete } });
  }
}
```

⚠️ **Ne pas supprimer** sur les autres codes (`messaging/server-unavailable`, `messaging/internal-error`, etc.) — ce sont des erreurs **temporaires**, le token est toujours valide.

---

## 7. Multi-device — important à comprendre

Un utilisateur peut être connecté sur **plusieurs appareils en même temps** (téléphone + tablette + téléphone secondaire).

**Comportement attendu** : envoyer la notif à **TOUS** les `NotificationDevice` du `userId`, sans déconnexion forcée des autres devices.

C'est déjà le comportement par défaut du code section 5.1 (`find({ userId })` retourne toutes les lignes). Rien à ajouter.

---

## 8. Cas de test à valider

| #   | Cas                                                        | Attendu                                                    |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Premier login d'un user → POST `/api/notification-devices` | 1 ligne créée en base                                      |
| 2   | Re-login du même user sur le même appareil (idempotence)   | 1 seule ligne, `updatedAt` mis à jour — **pas de doublon** |
| 3   | Login sur un 2e appareil avec le même compte               | 2 lignes pour ce `userId`                                  |
| 4   | Création d'une notif (résultat d'examen par ex.)           | Les 2 appareils reçoivent la push                          |
| 5   | Logout sur 1 appareil                                      | 1 seule ligne supprimée, l'autre continue de recevoir      |
| 6   | Token invalide (appareil désinstallé)                      | Ligne supprimée automatiquement au prochain envoi          |

---

## 9. Tests en isolation (sans dépendre du mobile)

Pour tester pendant le dev, sans attendre que l'app mobile soit dispo :

**Méthode 1 — Firebase Console** :

1. Va sur https://console.firebase.google.com → projet `xkorienta`
2. Menu **Engage → Messaging**
3. **Send your first message** → renseigne titre + corps
4. Onglet **Test** → colle un FCM token de test (le chef de projet t'en fournira un)
5. Clic **Send**

**Méthode 2 — Script Node.js avec ton code** :

```ts
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert(/* ton JSON */),
});

await admin.messaging().send({
  token: "FCM_TOKEN_DE_TEST",
  notification: { title: "Test", body: "Hello depuis le backend" },
  data: { route: "/notifications" },
  android: { notification: { channel_id: "xkorienta_default_channel" } },
});
```

---

## 10. Coordination avec le mobile

Quand tu auras terminé :

1. Dis-moi **"c'est en ligne"**
2. Je lance l'app sur mon téléphone de test et je te transmets mon FCM token
3. Tu lances un envoi vers ce token via ton `NotificationObserver` (déclenche un événement métier — créer un examen, ou ce que tu veux)
4. On vérifie ensemble que :
   - La notif arrive sur le téléphone ✅
   - Le tap navigue vers l'écran ciblé ✅
   - Une 2e push n'est pas envoyée en double ✅
   - Le `lastUsedAt` est bien mis à jour en base ✅

---

## Checklist finale

- [ ] Service Account JSON stocké en variable d'environnement
- [ ] `firebase-admin` installé et initialisé au démarrage
- [ ] Modèle `NotificationDevice` créé avec index unique sur `token`
- [ ] `POST /api/notification-devices` implémenté **avec upsert sur le token**
- [ ] `DELETE /api/notification-devices` implémenté
- [ ] `NotificationObserver` étendu : envoi FCM multicast après chaque `Notification.create`
- [ ] Fonction `resolveRouteFromType` implémentée pour résoudre les routes (section 5.2)
- [ ] Fonction `flattenDataForFcm` pour stringifier les valeurs (section 5.4)
- [ ] Nettoyage auto des tokens invalides (section 6)
- [ ] Les 6 cas de test (section 8) validés

---

## Glossaire — termes à connaître

| Terme                                      | Définition                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **FCM** (Firebase Cloud Messaging)         | Service Google qui livre des notifications aux téléphones                                                                              |
| **FCM token**                              | Identifiant unique d'un téléphone vu par Firebase. Comme un numéro de téléphone, mais qui peut changer (réinstallation de l'app, etc.) |
| **APNs** (Apple Push Notification service) | L'équivalent FCM côté Apple. Firebase fait le pont — on n'a pas à s'en soucier côté backend                                            |
| **Push notification**                      | Notification poussée par le serveur vers le téléphone (vs **pull** où c'est le téléphone qui interroge le serveur)                     |
| **Upsert**                                 | UPDATE si existe, INSERT sinon (en une opération atomique)                                                                             |
| **Idempotence**                            | Refaire la même action N fois donne le même résultat (pas de doublon)                                                                  |
| **Multicast FCM**                          | Envoyer le même message à plusieurs tokens d'un coup (1 appel HTTP pour N destinataires)                                               |
| **Service Account JSON**                   | Fichier qui authentifie ton backend auprès de Firebase. **Secret critique**.                                                           |

---

Si tu bloques sur un point, ping-moi — je peux soit clarifier ici, soit on fait une session ensemble.
