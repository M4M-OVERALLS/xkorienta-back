# Module 16 — Forum & Conversations

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token` (Rôles multiples)  
> **Real-Time** : Intégration *Pusher* intégrée pour les messageries instantanées.

---

## Vue d'ensemble

Ce module orchestre la dimension sociale et collaborative de la plateforme. Il se sépare en deux entités:
1. **Les Conversations (Messagerie direct)** : Des salons de chat privés entre 2 personnes ou plus en temps réel (via Pusher).
2. **Les Forums** : Des espaces de discussion structurés par classe ou groupe, utiles pour du Q/A ou des annonces générales (Threads/Posts).

---

## Partie 1 : Messagerie Instantanée (Conversations)

Les conversations `DIRECT` (ex: Eleve A et Eleve B) ou de groupe.

### 1.1 Lister ses conversations

```
GET /api/conversations?limit=20&page=1
```

**Auth requise** : Oui

Renvoie la liste des chats où l'utilisateur connecté est un `participant`. La ressource inclut le dernier message (`lastMessage`) pour affichage dans une sidebar type "WhatsApp".

### 1.2 Créer ou Obtenir une Conversation Directe

```
POST /api/conversations
```

**Auth requise** : Oui

*Note: Si vous demandez la création d'un chat `DIRECT` avec une personne avec qui vous parlez déjà, l'API renvoie la conversation existante sans créer de doublon.*

```json
{
  "participantIds": ["60d5ec...", "5f4b..."],
  "type": "DIRECT", 
  "title": "Nom optionnel du groupe"
}
```

### 1.3 Naviguer dans les Messages

```
GET /api/conversations/:id/messages?limit=50
```

Renvoie les 50 messages les plus récents (du plus vieux au plus récent en front). Les messages retournés sont mis à jour en base de données comme "lus" (`readBy`). Gère la pagination par curseur (`?before={date}`).

### 1.4 Envoyer un Message (et Pusher)

```
POST /api/conversations/:id/messages
```

```json
{
  "content": "Salut, tu as compris le chapitre 3 ?",
  "type": "TEXT" 
}
```

#### 🔌 Intégration Temps Réel (Pusher)
Dès qu'un message est posté, le backend le notifie en DB, mais déclenche aussi un événement `Pusher`.
- **Channel** : `"presence-conversation-{conversation_id}"` ou `"private-conversation-{conversation_id}"`
- **Event** : `"new-message"`

---

## Partie 2 : Forums (Discussions par Classe)

Utile pour les Classes (`classId`) où l'enseignant ou l'élève peut lancer un topic ouvert à tous. 

### 2.1 Lister ou Créer un Forum

- `GET /api/forums?classId=123` : Retourne la liste des forums (catégories/threads) pour cette classe.
- `POST /api/forums` : Créer un nouveau Topic/Forum.
  ```json
  {
    "title": "Questions sur la Physique Quantique",
    "description": "Tout sur l'examen blanc",
    "classId": "...",
    "type": "CLASS"
  }
  ```

### 2.2 Administrer un Forum (Modifier / Archiver)

- `GET /api/forums/:id` : Récupère les détails complexes d'un forum (statistiques utiles pour le layout).
- `PUT /api/forums/:id` : Mettre à jour les propriétés du forum (nom, description, `isPrivate`, `allowStudentPosts`).
  ```json
  {
    "name": "Questions sur la Physique Quantique",
    "description": "Nouveau titre",
    "isPrivate": false,
    "allowStudentPosts": true
  }
  ```
- `DELETE /api/forums/:id` : Soft-delete (archivage) réservé au créateur du forum.

### 2.3 Posts et Réponses (Threads)

- `GET /api/forums/:forumId/posts?page=1&limit=20` : Lire le contenu textuel des commentaires/posts publiés dans le forum par les divers utilisateurs. Pagination numérotée classique.
- `POST /api/forums/:forumId/posts` : Lancer une nouvelle discussion / nouveau post.
  ```json
  {
    "content": "Je pense que c'est une histoire de chat et de boite.",
    "attachments": []
  }
  ```
- `POST /api/forums/:forumId/posts/:postId/replies` : Répondre à un post existant.
  ```json
  {
    "content": "Oui effectivement, c'est l'expérience de Schrödinger."
  }
  ```
