# Module 27 — Push Notifications (FCM)

> **Audience** : Équipe mobile Flutter  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3001`)  
> **Auth** : Cookie `next-auth.session-token`  
> **Dépendance** : `firebase_messaging` (Flutter) + session active

---

## Vue d'ensemble

Xkorienta utilise **Firebase Cloud Messaging (FCM)** pour envoyer des notifications push au téléphone de l'utilisateur, même quand l'app est fermée.

### Schéma du flow complet

```
┌─────────────┐  1. Login (next-auth)   ┌─────────────────┐
│ App Flutter │ ──────────────────────► │ Backend Xkorienta│
│             │ ◄─────────────────────  │                  │
└─────────────┘  session cookie          └─────────────────┘
      │
      │  2. Demande son token FCM à Firebase
      ▼
┌─────────────┐
│  Firebase   │ ──► génère un FCM token unique (~150 chars)
└─────────────┘
      │
      │  3. Envoie le token au backend
      ▼
POST /api/notification-devices
{ token, platform, deviceId }
      │
      │  4. Événement métier (résultat d'examen, badge…)
      ▼
Backend → NotificationObserver → FCM multicast
      │
      ▼
┌─────────────┐
│  Firebase   │ ──► route la notif vers le bon téléphone
└─────────────┘
      │
      ▼
┌─────────────┐
│ Téléphone   │  ✅ Bannière affichée, même app fermée
│             │  ✅ Tap → navigate vers data.route
└─────────────┘
```

---

## Pré-requis Flutter

L'app doit intégrer `firebase_messaging` et demander la permission à l'utilisateur :

```dart
final messaging = FirebaseMessaging.instance;

// 1. Demander la permission (iOS)
await messaging.requestPermission();

// 2. Récupérer le FCM token
final token = await messaging.getToken();
// token ≈ "dGhpcyBpcyBhIGZjbSB0b2tlbg..."
```

> Le token est propre à chaque installation de l'app sur un appareil donné. Il peut changer si l'app est réinstallée ou que Firebase le renouvelle.

---

## 1. Enregistrer un device — `POST /api/notification-devices`

**Quand l'appeler** : à chaque login ET à chaque fois que Firebase notifie un renouvellement de token (`onTokenRefresh`).

**Auth requise** : Oui — la session doit être active.

### Requête

```http
POST /api/notification-devices
Content-Type: application/json
```

```json
{
  "token": "dGhpcyBpcyBhIGZjbSB0b2tlbg...",
  "platform": "android",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `token` | `string` | ✅ | FCM token récupéré via `FirebaseMessaging.getToken()` |
| `platform` | `"android" \| "ios" \| "web"` | ✅ | Plateforme de l'appareil |
| `deviceId` | `string` | ❌ | UUID v4 de l'appareil (optionnel, aide au debug) |

### Comportement — Idempotence (important !)

Ce endpoint est appelé **à chaque ouverture de l'app après login**. Il fait un **upsert sur le token** :
- Si le token existe déjà en base → mise à jour (`updatedAt`, `lastUsedAt`, `userId`)
- Si le token est nouveau → création

**Un user peut avoir N lignes (N appareils).** La notif sera envoyée à tous.

### Réponse 200 — Succès

```json
{
  "success": true,
  "message": "Device registered"
}
```

### Réponses d'erreur

| Status | Exemple de body | Cause |
|---|---|---|
| `400` | `{ "success": false, "message": "Le champ token est requis" }` | Token manquant ou vide |
| `400` | `{ "success": false, "message": "Le champ platform doit être android, ios ou web" }` | Platform invalide |
| `401` | `{ "success": false, "message": "Unauthorized" }` | Session expirée ou absente |
| `500` | `{ "success": false, "message": "..." }` | Erreur serveur |

### Exemple Flutter complet

```dart
Future<void> registerFCMToken() async {
  final token = await FirebaseMessaging.instance.getToken();
  if (token == null) return;

  await http.post(
    Uri.parse('$baseUrl/api/notification-devices'),
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie, // cookie next-auth
    },
    body: jsonEncode({
      'token': token,
      'platform': Platform.isAndroid ? 'android' : 'ios',
      'deviceId': await _getDeviceId(), // uuid v4
    }),
  );
}

// Renouvellement automatique du token
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
  registerFCMToken(); // même appel, l'upsert gère la mise à jour
});
```

---

## 2. Désenregistrer un device — `DELETE /api/notification-devices`

**Quand l'appeler** : **juste avant** le signout (`next_auth.signOut()`). La session doit encore être valide au moment de l'appel.

**Auth requise** : Oui.

### Requête

```http
DELETE /api/notification-devices
Content-Type: application/json
```

```json
{
  "token": "dGhpcyBpcyBhIGZjbSB0b2tlbg..."
}
```

### Réponse 200 — Succès

```json
{
  "success": true,
  "message": "Device removed"
}
```

### Exemple Flutter complet

```dart
Future<void> logout() async {
  final token = await FirebaseMessaging.instance.getToken();

  // 1. Supprimer le device AVANT le signout
  if (token != null) {
    await http.delete(
      Uri.parse('$baseUrl/api/notification-devices'),
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: jsonEncode({ 'token': token }),
    );
  }

  // 2. Ensuite seulement : déconnecter la session
  await NextAuth.signOut();
}
```

---

## 3. Structure du payload FCM reçu par l'app

Quand un événement métier se produit (résultat d'examen, badge, etc.), le backend envoie automatiquement une notification push. Voici la structure exacte que l'app reçoit.

### Notification visible (bannière)

```json
{
  "notification": {
    "title": "Examen réussi ! 🎉",
    "body": "Score: 18/20 (90%)"
  }
}
```

Affichée **automatiquement par l'OS** — aucun code Flutter nécessaire quand l'app est fermée.

### Data payload (accès programmatique)

```json
{
  "data": {
    "notificationId": "64f3a1b2c8d4e5f6a7b8c9d0",
    "type": "success",
    "route": "/exam/64a3f7abc/result",
    "examId": "64a3f7abc",
    "attemptId": "64b8c9d0e1f2a3b4",
    "score": "18",
    "percentage": "90"
  }
}
```

> **Important** : Toutes les valeurs de `data` sont des **strings** — FCM l'exige. Convertir les nombres avant usage : `int.parse(data['score']!)`.

### Champs clés du data payload

| Champ | Type | Description |
|---|---|---|
| `notificationId` | `string` | ID de la notification en base — utiliser pour `PATCH /api/notifications` (marquer comme lue) |
| `type` | `string` | Type de notification (`success`, `info`, `badge`, `alert`, `xp`, `level_up`) |
| `route` | `string` | **Route de navigation déjà résolue** — naviguer directement sans construire l'URL |
| Autres champs | `string` | Dépendent du type (ex: `examId`, `badgeName`, `forumId`…) |

### Config Android requise

Le backend envoie `channel_id: "xkorienta_default_channel"`. Sur Android 8+, ce channel **doit exister dans l'app** sinon la notification est silencieuse :

```dart
// À appeler une seule fois au démarrage de l'app
const channel = AndroidNotificationChannel(
  'xkorienta_default_channel',
  'Notifications Xkorienta',
  importance: Importance.high,
);

await FlutterLocalNotificationsPlugin()
  .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
  ?.createNotificationChannel(channel);
```

---

## 4. Navigation au tap sur la bannière (`data.route`)

Le champ `data.route` est **toujours résolu** par le backend avec les vrais IDs. L'app n'a qu'à naviguer vers cette URL directement.

### Mapping route → écran

| `data.route` | Écran |
|---|---|
| `/exam/{examId}/result` | Résultat d'examen |
| `/exam/{examId}/pending` | Examen en attente de correction |
| `/messaging/chat/{conversationId}` | Chat privé |
| `/messaging/forum/{forumId}` | Post de forum |
| `/assistance/review` | Réponse d'assistance |
| `/profile/badges` | Badges débloqués |
| `/profile` | Profil utilisateur |
| `/notifications` | Liste des notifications (fallback) |

### Exemple Flutter — gestion du tap

```dart
// App en background ou terminée — tap sur la bannière
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  final route = message.data['route'];
  if (route != null && route.isNotEmpty) {
    NavigationService.navigateTo(route);
  }
});

// App déjà ouverte — notification reçue en foreground
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // Afficher un snackbar ou une bannière in-app
  showInAppBanner(
    title: message.notification?.title ?? '',
    body: message.notification?.body ?? '',
    onTap: () {
      final route = message.data['route'];
      if (route != null) NavigationService.navigateTo(route);
    },
  );

  // Marquer comme lu via l'API si souhaité
  final notifId = message.data['notificationId'];
  if (notifId != null) markNotificationRead(notifId);
});

// Récupérer le message initial si l'app était TERMINÉE
final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
if (initialMessage != null) {
  final route = initialMessage.data['route'];
  if (route != null) NavigationService.navigateTo(route);
}
```

---

## 5. Marquer une notification comme lue

Après réception d'une push, vous pouvez marquer la notification comme lue via l'API existante (Module 14) en utilisant le `notificationId` du payload FCM :

```http
PATCH /api/notifications
Content-Type: application/json

{
  "notificationId": "{{notificationId_du_payload_FCM}}"
}
```

---

## 6. Gestion des tokens invalides

Le backend nettoie **automatiquement** les tokens expirés ou invalides après chaque envoi push (app désinstallée, token corrompu…). Aucune action requise côté mobile.

---

## 7. Cas multi-appareils

Un même compte peut être connecté sur plusieurs appareils simultanément. **Chaque appareil reçoit la push indépendamment.** Il n'y a pas de déconnexion forcée des autres sessions lors de l'enregistrement d'un nouveau device.

---

## 8. Checklist d'intégration Flutter

```
[ ] firebase_messaging installé et configuré dans firebase_options.dart
[ ] google-services.json (Android) / GoogleService-Info.plist (iOS) présents
[ ] Channel Android "xkorienta_default_channel" créé au démarrage
[ ] POST /api/notification-devices appelé après chaque login
[ ] onTokenRefresh écoute → re-POST /api/notification-devices
[ ] DELETE /api/notification-devices appelé AVANT le signout
[ ] Gestion onMessage (foreground), onMessageOpenedApp (background), getInitialMessage (app terminée)
[ ] Navigation via data.route implémentée
[ ] Conversion string → type natif pour les champs numériques du payload
```

---

## 9. Tests sans attendre le backend

Pour tester les notifications en isolé depuis la **Firebase Console** :

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com) → projet `xkorienta`
2. Menu **Engage → Messaging → Send your first message**
3. Renseigner titre + corps
4. Onglet **Test on device** → coller votre FCM token (récupéré via `FirebaseMessaging.instance.getToken()`)
5. Clic **Test**

> Pour récupérer votre token en dev, ajouter temporairement dans `initState` :
> ```dart
> final token = await FirebaseMessaging.instance.getToken();
> print('FCM TOKEN: $token'); // copier depuis les logs
> ```
