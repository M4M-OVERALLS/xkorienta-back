# Module 15 — Assistance & AI

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token` (Rôles : `STUDENT`, `TEACHER`)

---

## Vue d'ensemble

Ce module couvre deux composantes différentes mais adressant toutes deux la thématique de "l'Aide" :
1. **L'Assistance Humaine (Ticketing)** : Un système de tickets de support académique entre les étudiants et les enseignants. Les requêtes peuvent être internes (vers son propre prof, gratuit) ou externes (vers un autre prof de la plateforme, potentiellement payant avec un bouton de *Claim*).
2. **L'Assistance Intellectuelle Automatisée (AI)** : Outils basés sur l'intelligence artificielle (ex: reformulation de questions pour les enseignants).

---

## 1. Aide Académique (Requests)

### 1.1 Lister les demandes d'assistance

```
GET /api/requests?status=PENDING&type=TUTORING
```

**Auth requise** : Oui (`STUDENT` ou `TEACHER`)

> Affiche toutes les requêtes formulées par l'étudiant connecté, ou les requêtes assignées/disponibles pour le prof connecté.

#### Paramètres de recherche (Query)
- `status` : `PENDING`, `AVAILABLE`, `ACCEPTED`, `REJECTED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`
- `type` : `TUTORING`, `EVALUATION`, `ASSISTANCE`, `REMEDIATION`

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ec...",
      "type": "TUTORING",
      "title": "Aide sur les intégrales",
      "status": "PENDING",
      "priority": "MEDIUM",
      "teacherType": "SCHOOL"
    }
  ]
}
```

### 1.2 Créer une demande d'assistance

```
POST /api/requests
```

**Auth requise** : Oui (`STUDENT` uniquement)

> Permet à un élève de lever la main virtuellement.

#### Corps de la requête

```json
{
  "title": "Je ne comprends pas la notion de Mol",
  "message": "J'ai relu le cours 3 fois mais l'exercice 4 reste un mystère...",
  "type": "TUTORING", 
  "priority": "HIGH",
  "teacherType": "SCHOOL",
  "subjectId": "...",
  "teacherId": "..." 
}
```
*(Note : le `teacherId` est optionnel si on laisse le système ou les enseignants externes attribuer ou réclamer la requête)*.

### 1.3 Obtenir / Modifier / Annuler une seule requête

#### Voir le détail (GET)
```
GET /api/requests/:requestId
```

#### Modifier / Accepter (PUT)
```
PUT /api/requests/:requestId
```
*(Utilisé par l'enseignant pour scheduler, changer le statut ou laisser un feedback final)*.
Exemple de body (Enseignant qui programme une session) :
```json
{
  "status": "SCHEDULED",
  "scheduledAt": "2025-02-15T10:00:00Z",
  "meetingLink": "https://meet.google.com/xyz"
}
```

#### Annuler (DELETE)
```
DELETE /api/requests/:requestId
```
*(L'étudiant peut annuler sa requête uniquement si son statut est encore `PENDING` ou `AVAILABLE`)*.

---

### 1.4 Réclamer une requête externe (Teacher "Claim")

```
POST /api/requests/:requestId/claim
```

**Auth requise** : Oui (`TEACHER` uniquement)

> Les demandes en pool public peuvent être récupérées ("claimed") par le permier enseignant disponible prêt à les traiter (Souvent pour du tutorat rémunéré inter-écoles). Si validé, l'assigne à ce `TEACHER` et passe la demande en `ACCEPTED`.

---

## 2. Conversation sur un Ticket

Un ticket de support possède son propre mini-chat asynchrone intégré. Ne confondez pas avec la route Forum globale.

### 2.1 Lister les messages d'une requête

```
GET /api/requests/:requestId/messages
```

**Auth requise** : Contexte (`STUDENT` propriétaire ou `TEACHER` assigné)

#### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "senderRole": "student",
      "senderName": "Jean Dupont",
      "content": "Avez-vous vu mon fichier joint ?",
      "sentAt": "2024-11-20T10:00:00Z"
    }
  ]
}
```

### 2.2 Envoyer un nouveau message

```
POST /api/requests/:requestId/messages
```

```json
{
  "content": "Oui, je le regarde ce soir et je vous dis quoi."
}
```
*(Note : Si le Teacher envoie un message sur un statut `PENDING`, le statut bascule automatiquement sur `ACCEPTED`).*

---

## 3. Assistance IA 

### 3.1 Outil IA "Reformulate"

```
POST /api/ai/reformulate
```

**Auth requise** : Oui (Le plus souvent `TEACHER` lors de la création d'exercices)

> Interroge le service IA (HuggingFace) du backend pour reformuler un texte, le résumer, ou modifier son ton. Très utilisé pour varier les énoncés d'examens.

#### Corps de la requête

```json
{
  "text": "L'énergie cinétique c'est la formule 1/2 m v2. Le corps bouge.",
  "options": {
     "tone": "academic",
     "length": "longer"
  }
}
```

#### Réponse 200

```json
{
  "text": "L'énergie cinétique est définie comme l'énergie physique inhérente..."
}
```
