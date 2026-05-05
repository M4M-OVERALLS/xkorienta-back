# Module 14 — Notifications & Événements

> **Audience** : Équipe frontend externe & Développeurs Backend  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token` (Rôles multiples)

---

## Vue d'ensemble

Le système de notifications de Quizlock repose sur une architecture orientée événements (**Event-Driven Architecture**).  
Plutôt que de créer les notifications directement post-action, le code émet un "Événement" (`publishEvent`). Un "Observateur" (`NotificationObserver`) écoute ces événements et décide, en tâche de fond, s'il faut générer et sauvegarder une alerte dans la collection `Notification`.

Ce module documente l'API destinée au frontend (pour afficher la cloche de notifications) **et** la procédure backend pour créer des événements.

---

## 1. Partie Frontend (Consommation API)

### 1.1 Récupérer les notifications

```
GET /api/notifications
```

**Auth requise** : Oui

> Récupère les 50 dernières notifications de l'utilisateur connecté et compte celles non lues.

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "id": "60d5ecb8b343d8389...",
      "type": "info",
      "title": "Nouveau Syllabus Disponible 📚",
      "message": "Le Syllabus de Mathématiques \"Algèbre Linéaire\" est maintenant disponible.",
      "timestamp": "2024-03-10T12:00:00Z",
      "read": false,
      "data": {
        "syllabusId": "..."
      }
    },
    {
      "id": "60d5ec...",
      "type": "success",
      "title": "Examen réussi ! 🎉",
      "message": "Score: 18/20 (90%)",
      "read": true,
      "data": {
        "examId": "...",
        "attemptId": "...",
        "score": 18,
        "percentage": 90
      }
    }
  ],
  "unreadCount": 1
}
```

> **Note Frontend** : Le champ `type` (`info`, `success`, `alert`, `badge`, `level_up`, `xp`, etc.) vous permet d'afficher une icône ou une couleur différente dans la liste déroulante (dropdown) des notifications. Le champ `data` contient les IDs nécessaires si vous voulez rendre la notification cliquable (ex: rediriger vers l'examen).

### 1.2 Marquer comme lue(s)

```
PATCH /api/notifications
```

**Auth requise** : Oui

#### Corps de la requête : Marquer une seule
```json
{
  "notificationId": "60d5ecb8b343d8389..."
}
```

#### Corps de la requête : Tout marquer comme lu
```json
{
  "markAllAsRead": true
}
```

#### Réponse 200
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### 1.3 Supprimer une notification

```
DELETE /api/notifications?id=60d5ecb8b343d8389...
```

**Auth requise** : Oui

#### Réponse 200
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

## 2. Partie Backend (Créer un événement et une notification)

Si vous devez développer une nouvelle route API ou un nouveau service sur le backend et désirez déclencher une notification, **ne créez pas directement la ligne dans la table `Notification`**. Utilisez l'EventPublisher.

### Étape 1 : Définir le type d'événement (si nouveau)
Ouvrez le fichier `src/lib/events/types.ts`.
Ajoutez un Enum dans `EventType` si besoin :
```ts
export enum EventType {
    // ...
    MY_NEW_EVENT = 'MY_NEW_EVENT'
}
```

*(Puis définissez l'interface correspondante en bas du fichier, ex. `MyNewEvent extends Event`)*.

### Étape 2 : Publier l'événement dans le Controller/Service
N'importe où dans votre code (ex: `TeacherService`, `ClassController`), importez `publishEvent` et `EventType`.

```typescript
import { publishEvent } from '@/lib/events/EventPublisher';
import { EventType } from '@/lib/events/types';

// Une fois votre logique métier terminée
await publishEvent({
    type: EventType.EXAM_COMPLETED,
    timestamp: new Date(),
    userId: user._id, // L'ID de l'acteur principal (optionnel)
    data: {
        examId: exam._id,
        score: finalScore,
        passed: true
        // Ajoutez tout contexte nécessaire
    }
});
```

### Étape 3 : Capture de l'événement (L'observateur)
Ouvrez le fichier `src/lib/events/observers/NotificationObserver.ts`.
1. Ajoutez votre Event dans l'array retourné par `getInterestedEvents()`.
2. Interceptez-le dans le `switch(event.type)` de la méthode `update(event)`.
3. Créez un constructeur de `Notification` (`await Notification.create({...})` ou `insertMany`) afin d'envoyer l'alerte à la bonne personne (étudiant, professeur concerné, etc.).

#### Exemple au sein de `NotificationObserver.ts` :
```typescript
private async handleExamCompleted(event: ExamCompletedEvent): Promise<void> {
    if (!event.userId) return;

    await Notification.create({
        userId: event.userId, // À qui on envoie la notification
        type: event.data.passed ? "success" : "info",
        title: event.data.passed ? "Examen réussi ! 🎉" : "Examen terminé",
        message: `Score: ${event.data.score}/${event.data.maxScore}`,
        read: false,
        data: event.data
    });
}
```

Cette architecture découplée permet :
- De ne pas ralentir la route API initiale (l'événement est `Promisified`).
- De déclencher **plusieurs comportements** (ex: Gamification ET Notifications) sans polluer le code source du service principal.
