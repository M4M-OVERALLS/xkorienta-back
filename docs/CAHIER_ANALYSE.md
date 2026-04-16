# Cahier d'Analyse — Xkorienta

> **Projet :** Xkorienta (anciennement QuizLock)
> **Version :** 1.0
> **Date :** Avril 2026
> **Statut :** MVP validé

---

## Table des matières

1. [Contexte et présentation du projet](#1-contexte-et-présentation-du-projet)
2. [Objectifs du projet](#2-objectifs-du-projet)
3. [Périmètre et limites du MVP](#3-périmètre-et-limites-du-mvp)
4. [Acteurs du système](#4-acteurs-du-système)
5. [Diagramme de cas d'utilisation](#5-diagramme-de-cas-dutilisation)
6. [Description détaillée des cas d'utilisation](#6-description-détaillée-des-cas-dutilisation)
7. [Diagrammes de séquence](#7-diagrammes-de-séquence)
8. [Diagrammes d'états](#8-diagrammes-détats)
9. [Diagramme d'activité](#9-diagramme-dactivité)
10. [Exigences non fonctionnelles](#10-exigences-non-fonctionnelles)
11. [Règles métier](#11-règles-métier)
12. [Contraintes et risques](#12-contraintes-et-risques)
13. [Glossaire](#13-glossaire)

---

## 1. Contexte et présentation du projet

### 1.1 Contexte général

Xkorienta est une plateforme éducative numérique conçue pour le système scolaire centrafricain/camerounais. Elle s'adresse aux établissements secondaires et supérieurs opérant dans un contexte bilingue (francophone/anglophone) et multi-cycle (primaire, secondaire, technique, BTS/HND, licence, master, doctorat).

Le système éducatif ciblé est caractérisé par :
- Une dualité linguistique forte (sous-systèmes Francophone et Anglophone)
- Des cycles académiques variés, de la maternelle au doctorat
- Un accès inégal au numérique, d'où la nécessité d'un mode freemium (sans compte)
- Un fort besoin d'orientation scolaire et professionnelle pour les lycéens

### 1.2 Problèmes identifiés

| # | Problème | Impact |
|---|----------|--------|
| P1 | Absence d'outil d'évaluation numérique adapté au contexte local | Enseignants contraints à l'évaluation papier, sans analytics |
| P2 | Difficultés d'orientation scolaire et professionnelle | Choix de filières non éclairés, taux d'échec post-bac élevé |
| P3 | Manque de suivi individualisé des apprenants | Impossible de détecter précocement les élèves en difficulté |
| P4 | Isolation des enseignants dans la création de contenu | Pas de mutualisation ni de collaboration pédagogique |
| P5 | Accès limité aux ressources d'auto-évaluation | Les élèves ne peuvent pas s'entraîner en dehors de la classe |

### 1.3 Solution apportée

Xkorienta propose :
- Un **moteur d'évaluation** (QCM, vrai/faux, questions ouvertes, études de cas) avec correction automatisée
- Un **module d'orientation** (xkorienta) guidant les lycéens vers les filières et écoles adaptées à leur profil
- Un **espace collaboratif** permettant aux enseignants de créer, partager et gérer des examens
- Un **système de gamification** motivant l'engagement des apprenants (XP, badges, classements)
- Un **accès freemium** via des mini-tests publics sans nécessiter de compte

---

## 2. Objectifs du projet

### 2.1 Objectifs fonctionnels

- **OBJ-F01 :** Permettre aux enseignants de créer, publier et gérer des examens en ligne
- **OBJ-F02 :** Permettre aux élèves de passer des examens et de consulter leurs résultats
- **OBJ-F03 :** Fournir un système d'auto-évaluation par concepts avec échelle à 7 niveaux
- **OBJ-F04 :** Proposer un module d'orientation personnalisé (xkorienta) aux élèves de terminale
- **OBJ-F05 :** Offrir un tableau de bord analytique pour les enseignants et les administrateurs
- **OBJ-F06 :** Sécuriser les examens contre la triche (plein écran, changement d'onglet)
- **OBJ-F07 :** Gérer les absences légitimes via un système de codes de retard
- **OBJ-F08 :** Permettre l'accès freemium (mini-tests publics sans inscription)

### 2.2 Objectifs non fonctionnels

- **OBJ-NF01 :** Performance — réponse API < 2 secondes en charge normale
- **OBJ-NF02 :** Disponibilité — uptime ≥ 99,5 %
- **OBJ-NF03 :** Sécurité — authentification JWT, hachage bcrypt, validation entrées
- **OBJ-NF04 :** Maintenabilité — architecture en couches, couverture de tests ≥ 80 %
- **OBJ-NF05 :** Accessibilité — interface responsive, support mobile

---

## 3. Périmètre et limites du MVP

### 3.1 Inclus dans le MVP

```
✅ Inscription / Connexion (email, mot de passe, Google OAuth)
✅ Gestion des profils utilisateurs
✅ Création et gestion des écoles
✅ Création et gestion des classes
✅ Création d'examens (V3 et V4 multi-chapitres)
✅ Passage d'examens avec correction automatique (QCM, V/F)
✅ Auto-évaluation par concepts
✅ Tableau de bord enseignant et élève
✅ Analytics de classe et individuels
✅ Gamification (XP, badges, classements)
✅ Forums de classe
✅ Module d'orientation (xkorienta)
✅ Mini-tests publics (freemium, sans compte)
✅ Système de codes de retard
✅ Notifications
✅ Messagerie
```

### 3.2 Hors périmètre (versions futures)

```
🔲 Paiements en ligne (abonnements premium)
🔲 Correction automatique des questions ouvertes par IA (partielle)
🔲 Application mobile native (iOS / Android)
🔲 Intégration LMS externe (Moodle, Canvas)
🔲 Vidéoconférence intégrée
🔲 Certification numérique vérifiable
```

---

## 4. Acteurs du système

### 4.1 Acteurs principaux

| Acteur | Rôle | Description |
|--------|------|-------------|
| **Visiteur** | Non authentifié | Accède aux mini-tests publics et à la page d'orientation sans compte |
| **Étudiant (Student)** | Apprenant authentifié | Passe des examens, consulte ses résultats, utilise le module d'orientation |
| **Enseignant (Teacher)** | Créateur de contenu | Crée des examens, gère des classes, consulte les analytics |
| **Administrateur école (School Admin)** | Gestionnaire d'établissement | Valide les classes, gère les enseignants, accède aux statistiques école |
| **Inspecteur (Inspector)** | Validateur pédagogique | Valide ou refuse les examens soumis par les enseignants |
| **Administrateur système (Admin)** | Super administrateur | Gère l'ensemble de la plateforme, valide les écoles |

### 4.2 Acteurs secondaires (systèmes externes)

| Acteur | Type | Rôle |
|--------|------|------|
| **MongoDB** | Base de données | Persistance de toutes les données |
| **Google OAuth** | Service tiers | Authentification via compte Google |
| **GitHub OAuth** | Service tiers | Authentification via compte GitHub |
| **Pusher** | Service temps réel | Notifications et surveillance d'examens en temps réel |
| **HuggingFace** | Service IA | Reformulation et génération de questions |
| **Nodemailer / SMTP** | Service email | Envoi d'emails (réinitialisation MDP, notifications) |

---

## 5. Diagramme de cas d'utilisation

### 5.1 Vue globale du système

```plantuml
@startuml UC_Global
left to right direction
skinparam actorStyle awesome
skinparam packageStyle rectangle
skinparam backgroundColor #FAFAFA
skinparam ArrowColor #555555
skinparam ActorBorderColor #333333

title Diagramme de cas d'utilisation — Xkorienta (Vue globale)

actor "Visiteur" as V #LightGray
actor "Étudiant" as S #AED6F1
actor "Enseignant" as T #A9DFBF
actor "Admin École" as SA #F9E79F
actor "Inspecteur" as I #F1948A
actor "Admin Système" as ADM #D2B4DE

rectangle "Xkorienta" {

  package "Authentification" {
    usecase "S'inscrire" as UC_REG
    usecase "Se connecter" as UC_LOGIN
    usecase "Réinitialiser MDP" as UC_RESET
    usecase "OAuth (Google/GitHub)" as UC_OAUTH
  }

  package "Évaluation" {
    usecase "Créer un examen" as UC_CREATE_EXAM
    usecase "Publier un examen" as UC_PUBLISH
    usecase "Passer un examen" as UC_TAKE
    usecase "Soumettre l'examen" as UC_SUBMIT
    usecase "Consulter les résultats" as UC_RESULTS
    usecase "Auto-évaluation" as UC_SELF
    usecase "Mini-test public" as UC_MINI
  }

  package "Gestion pédagogique" {
    usecase "Gérer les classes" as UC_CLASS
    usecase "Inviter des étudiants" as UC_INVITE
    usecase "Collaborer sur un examen" as UC_COLLAB
    usecase "Surveiller en temps réel" as UC_MONITOR
    usecase "Valider un examen" as UC_VALIDATE
  }

  package "École & Structure" {
    usecase "Créer une école" as UC_SCHOOL
    usecase "Valider une école" as UC_SCHOOL_VALID
    usecase "Gérer les enseignants" as UC_TEACHERS
  }

  package "Analytics & Gamification" {
    usecase "Tableau de bord" as UC_DASHBOARD
    usecase "Consulter analytics" as UC_ANALYTICS
    usecase "Classements" as UC_LEADERBOARD
    usecase "Défis / Challenges" as UC_CHALLENGES
  }

  package "Orientation" {
    usecase "Explorer les filières" as UC_ORIENT
    usecase "Recommandations écoles" as UC_SCHOOL_REC
  }

  package "Communication" {
    usecase "Forums de classe" as UC_FORUM
    usecase "Messagerie" as UC_MSG
    usecase "Notifications" as UC_NOTIF
  }
}

' Visiteur
V --> UC_LOGIN
V --> UC_REG
V --> UC_MINI
V --> UC_ORIENT

' Étudiant
S --> UC_LOGIN
S --> UC_TAKE
S --> UC_SUBMIT
S --> UC_SELF
S --> UC_RESULTS
S --> UC_DASHBOARD
S --> UC_LEADERBOARD
S --> UC_CHALLENGES
S --> UC_ORIENT
S --> UC_SCHOOL_REC
S --> UC_FORUM
S --> UC_MSG
S --> UC_NOTIF

' Enseignant
T --> UC_LOGIN
T --> UC_CREATE_EXAM
T --> UC_PUBLISH
T --> UC_CLASS
T --> UC_INVITE
T --> UC_COLLAB
T --> UC_MONITOR
T --> UC_DASHBOARD
T --> UC_ANALYTICS
T --> UC_FORUM
T --> UC_MSG
T --> UC_SCHOOL
T --> UC_NOTIF

' Admin École
SA --> UC_LOGIN
SA --> UC_TEACHERS
SA --> UC_CLASS
SA --> UC_ANALYTICS
SA --> UC_DASHBOARD

' Inspecteur
I --> UC_LOGIN
I --> UC_VALIDATE

' Admin Système
ADM --> UC_SCHOOL_VALID
ADM --> UC_ANALYTICS
ADM --> UC_NOTIF

' Héritages
S --|> V
T --|> V

' Inclusions
UC_TAKE ..> UC_SUBMIT : <<include>>
UC_CREATE_EXAM ..> UC_PUBLISH : <<extend>>
UC_PUBLISH ..> UC_VALIDATE : <<extend>>

@enduml
```

### 5.2 Cas d'utilisation — Module Évaluation (zoom)

```plantuml
@startuml UC_Evaluation
left to right direction
skinparam actorStyle awesome
skinparam backgroundColor #FAFAFA

title Module Évaluation — Détail

actor "Enseignant" as T #A9DFBF
actor "Étudiant" as S #AED6F1
actor "Inspecteur" as I #F1948A

rectangle "Module Évaluation" {
  usecase "Créer examen (V3/V4)" as UC1
  usecase "Ajouter questions" as UC2
  usecase "Configurer anti-triche" as UC3
  usecase "Gérer codes retard" as UC4
  usecase "Soumettre validation" as UC5
  usecase "Valider / Refuser examen" as UC6
  usecase "Publier examen" as UC7
  usecase "Dupliquer examen" as UC8
  usecase "Surveiller en temps réel" as UC9
  usecase "Rejoindre lobby examen" as UC10
  usecase "Passer examen" as UC11
  usecase "Utiliser code retard" as UC12
  usecase "Consulter résultat" as UC13
  usecase "Télécharger résultat PDF" as UC14
}

T --> UC1
T --> UC2
T --> UC3
T --> UC4
T --> UC5
T --> UC7
T --> UC8
T --> UC9

I --> UC6

S --> UC10
S --> UC11
S --> UC12
S --> UC13
S --> UC14

UC1 ..> UC2 : <<include>>
UC5 ..> UC6 : <<include>>
UC6 ..> UC7 : <<extend>> : si validé
UC10 ..> UC11 : <<include>>
UC13 ..> UC14 : <<extend>>

@enduml
```

---

## 6. Description détaillée des cas d'utilisation

### UC-01 : S'inscrire sur la plateforme

| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-01 |
| **Nom** | Inscription utilisateur |
| **Acteur principal** | Visiteur |
| **Préconditions** | L'utilisateur n'a pas de compte existant |
| **Postconditions** | Compte créé, utilisateur redirigé vers l'onboarding |
| **Priorité** | Haute |

**Scénario nominal :**
1. Le visiteur accède à la page `/register`
2. Il saisit son nom, son email (ou téléphone), et son mot de passe
3. Il sélectionne sa catégorie (Enseignant ou Étudiant)
4. Le système valide les données (format email, force MDP ≥ 8 caractères)
5. Le système hache le mot de passe (bcrypt, salt=12)
6. Le compte est créé en base de données
7. L'utilisateur est redirigé vers `/onboarding`

**Scénarios alternatifs :**
- A1 : Email déjà utilisé → Message d'erreur 409 "Email déjà enregistré"
- A2 : Inscription via Google OAuth → Redirection OAuth, récupération du profil Google
- A3 : Inscription via numéro de téléphone (sans email) → Identifiant = téléphone

**Scénarios d'erreur :**
- E1 : Données invalides → Réponse 400 avec messages de validation champ par champ
- E2 : Serveur indisponible → Page d'erreur 500

---

### UC-02 : Se connecter

| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-02 |
| **Nom** | Authentification |
| **Acteur principal** | Tout utilisateur enregistré |
| **Préconditions** | L'utilisateur possède un compte actif |
| **Postconditions** | Session JWT créée, utilisateur redirigé selon son rôle |
| **Priorité** | Haute |

**Scénario nominal :**
1. L'utilisateur saisit son email/téléphone et son mot de passe
2. Le système vérifie les credentials via `POST /api/auth/verify`
3. Le backend compare le mot de passe avec le hash bcrypt
4. Un token JWT est généré (expiration 30 jours)
5. La session est enrichie avec le rôle, l'école, et les permissions
6. Redirection selon le rôle : `/dashboard/student`, `/dashboard/teacher`, etc.

**Scénarios alternatifs :**
- A1 : Connexion Google OAuth → Vérification du `id_token` sur le backend Google
- A2 : Compte non onboardé → Redirection vers `/onboarding`

**Scénarios d'erreur :**
- E1 : Identifiants incorrects → 401 "Identifiants invalides"
- E2 : Compte non trouvé → 404

---

### UC-03 : Créer un examen (V4)

| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-03 |
| **Nom** | Création d'examen multi-chapitres |
| **Acteur principal** | Enseignant |
| **Préconditions** | Enseignant authentifié, classe existante |
| **Postconditions** | Examen en état DRAFT sauvegardé |
| **Priorité** | Haute |

**Scénario nominal :**
1. L'enseignant accède au builder V4 (`/dashboard/teacher/exams/builder-v4`)
2. Il configure les métadonnées (titre, matière, classe, durée)
3. Il crée un ou plusieurs chapitres avec pondération
4. Il ajoute des questions (QCM, V/F, ouvertes, étude de cas) par chapitre
5. Il configure les options (mélange questions/réponses, anti-triche, feedback immédiat)
6. Il sauvegarde le brouillon → statut DRAFT
7. Il soumet pour validation → statut PENDING_VALIDATION

**Scénarios alternatifs :**
- A1 : Sauvegarde automatique toutes les 30 secondes (autosave)
- A2 : Duplication d'un examen existant → création d'un clone DRAFT
- A3 : Génération de questions par IA (HuggingFace) → ajout automatique

**Scénarios d'erreur :**
- E1 : Aucune question ajoutée → Impossible de soumettre, message 400
- E2 : Titre manquant → Validation bloquante

---

### UC-04 : Passer un examen

| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-04 |
| **Nom** | Session d'examen |
| **Acteur principal** | Étudiant |
| **Préconditions** | Examen publié, étudiant inscrit dans la classe |
| **Postconditions** | Tentative enregistrée avec score, étudiant voit ses résultats |
| **Priorité** | Haute |

**Scénario nominal :**
1. L'étudiant accède au lobby de l'examen
2. Il vérifie les informations (durée, nombre de questions, règles)
3. Il démarre l'examen → tentative créée en base (statut STARTED)
4. Le système charge les questions (mélangées si configuré)
5. L'étudiant répond aux questions, le temps est décompté
6. Il soumet l'examen → tentative passe en COMPLETED
7. Le score est calculé automatiquement
8. L'étudiant est redirigé vers la page de résultat

**Scénarios alternatifs :**
- A1 : Connexion coupée → Token de reprise (resume token) permet de continuer
- A2 : Utilisation d'un code retard → Examen alternatif débloqué
- A3 : Détection d'événement anti-triche → Alerte enregistrée, enseignant notifié en temps réel

**Scénarios d'erreur :**
- E1 : Temps écoulé → Soumission automatique, statut EXPIRED
- E2 : Tentative déjà existante → Blocage (une seule tentative par défaut)

---

### UC-05 : Module d'orientation (xkorienta)

| Champ | Valeur |
|-------|--------|
| **Identifiant** | UC-05 |
| **Nom** | Orientation scolaire et professionnelle |
| **Acteur principal** | Étudiant, Visiteur |
| **Préconditions** | Aucune (accessible sans compte) |
| **Postconditions** | Recommandations d'écoles et filières affichées |
| **Priorité** | Haute |

**Scénario nominal :**
1. L'utilisateur accède à `/xkorienta` ou `/dashboard/student/orientation`
2. Il renseigne son profil : niveau actuel, résultats, préférences
3. Le système analyse le profil via `PredictionEngine` et `AIInsightsService`
4. Les écoles et filières compatibles sont affichées avec scores de compatibilité
5. L'utilisateur peut filtrer par type d'établissement, localisation, frais
6. Il consulte le détail d'une filière ou école
7. Il peut sauvegarder ses favoris (si connecté)

---

## 7. Diagrammes de séquence

### 7.1 Séquence : Authentification par identifiants

```plantuml
@startuml SEQ_Auth
skinparam backgroundColor #FAFAFA
skinparam sequenceArrowThickness 2
skinparam roundcorner 10
skinparam sequenceBoxBorderColor #AAAAAA

title Séquence — Authentification par identifiants

actor "Utilisateur" as U
participant "Frontend\n(Next.js)" as FE
participant "NextAuth\n(next-auth)" as NA
participant "Backend API\n(quizlock-api)" as API
database "MongoDB" as DB

U -> FE : Soumet formulaire\n(email, mot de passe)
FE -> NA : signIn("credentials", { identifier, password })
NA -> API : POST /api/auth/verify\n{ identifier, password }
API -> DB : User.findOne({ email | phone: identifier })
DB --> API : Document utilisateur ou null
alt Utilisateur non trouvé
  API --> NA : null
  NA --> FE : Erreur 401
  FE --> U : "Identifiants invalides"
else Utilisateur trouvé
  API -> API : bcrypt.compare(password, user.passwordHash)
  alt Mot de passe incorrect
    API --> NA : null
    NA --> FE : Erreur 401
    FE --> U : "Identifiants invalides"
  else Authentification réussie
    API --> NA : { id, name, email, role, schoolId, image }
    NA -> NA : Génère token JWT\n(exp: 30j)
    NA -> NA : Callback jwt()\n→ enrichit token\n(id, role, schoolId)
    NA -> NA : Callback session()\n→ construit session
    NA --> FE : Session active
    FE -> FE : Détermine redirection\nselon user.role
    FE --> U : Redirige vers\ndashboard correspondant
  end
end

@enduml
```

### 7.2 Séquence : Création et publication d'un examen

```plantuml
@startuml SEQ_CreateExam
skinparam backgroundColor #FAFAFA
skinparam sequenceArrowThickness 2
skinparam roundcorner 10

title Séquence — Création et publication d'un examen (V4)

actor "Enseignant" as T
participant "Frontend\n(Builder V4)" as FE
participant "API Backend" as API
participant "ExamServiceV4" as SVC
participant "ExamRepository" as REPO
database "MongoDB" as DB
participant "Inspecteur" as I

T -> FE : Accède au builder V4
FE -> API : POST /api/exams/v4/draft\n{ title, subject, classId }
API -> SVC : createDraft(teacherId, data)
SVC -> REPO : save(examDraft)
REPO -> DB : insert(Exam { status: DRAFT })
DB --> REPO : examId
REPO --> SVC : exam
SVC --> API : { examId, status: DRAFT }
API --> FE : 201 Created

loop Ajout de contenu
  T -> FE : Ajoute chapitres & questions
  FE -> API : PUT /api/exams/v4/{draftId}/metadata\nPUT /api/exams/v4/{draftId}/questions
  API -> SVC : updateDraft(draftId, updates)
  SVC -> REPO : update(examId, changes)
  REPO -> DB : updateOne(...)
  DB --> REPO : OK
  REPO --> SVC : updatedExam
  SVC --> API : 200 OK
  API --> FE : Examen mis à jour
end

T -> FE : Soumet pour validation
FE -> API : POST /api/exams/{id}/submit-validation
API -> SVC : submitForValidation(examId)
SVC -> DB : update status → PENDING_VALIDATION
SVC -> SVC : Notifie les inspecteurs\n(Pusher event)
API --> FE : 200 { status: PENDING_VALIDATION }
FE --> T : "Examen soumis pour validation"

note over I : Inspecteur reçoit\nla notification
I -> API : PUT /api/exams/{id}/validate\n{ approved: true }
API -> SVC : validateExam(examId, inspectorId)
SVC -> DB : update status → VALIDATED
API --> I : 200 OK

T -> FE : Publie l'examen
FE -> API : POST /api/exams/{id}/publish
API -> SVC : publishExam(examId)
SVC -> DB : update status → PUBLISHED
SVC -> SVC : Notifie les étudiants\nde la classe
API --> FE : 200 { status: PUBLISHED }
FE --> T : "Examen publié !"

@enduml
```

### 7.3 Séquence : Passage d'un examen

```plantuml
@startuml SEQ_TakeExam
skinparam backgroundColor #FAFAFA
skinparam sequenceArrowThickness 2
skinparam roundcorner 10

title Séquence — Passage d'un examen (Student flow)

actor "Étudiant" as S
participant "Frontend\n(Exam Page)" as FE
participant "API Backend" as API
participant "AttemptService" as ASVC
participant "AntiCheat\nMonitor" as AC
database "MongoDB" as DB
participant "Enseignant\n(Monitor)" as T

S -> FE : Accède au lobby\n/student/exam/{id}/lobby
FE -> API : GET /api/student/exams/{id}/lobby
API --> FE : { examInfo, rules, duration }
FE --> S : Affiche informations examen

S -> FE : Démarre l'examen
FE -> API : POST /api/attempts/start\n{ examId, studentId }
API -> ASVC : startAttempt(examId, studentId)
ASVC -> DB : create Attempt { status: STARTED,\nstartedAt, resumeToken }
DB --> ASVC : attempt
ASVC -> API : { attemptId, questions, resumeToken }
API --> FE : Questions (mélangées si config)
FE --> S : Affiche les questions\n+ timer

loop Réponses aux questions
  S -> FE : Sélectionne une réponse
  FE -> API : POST /api/attempts/answer\n{ attemptId, questionId, answer }
  API -> ASVC : saveAnswer(attemptId, qId, answer)
  ASVC -> DB : update Attempt.responses
  DB --> ASVC : OK
  API --> FE : 200 OK
end

note over AC : Surveillance anti-triche
AC -> FE : Détecte sortie plein écran
FE -> API : POST /api/attempts/{id}/anti-cheat-event\n{ type: "FULLSCREEN_EXIT" }
API -> DB : log AntiCheatEvent
API -> AC : Notifie enseignant (Pusher)
AC --> T : Alerte en temps réel

S -> FE : Soumet l'examen
FE -> API : POST /api/attempts/{id}/submit
API -> ASVC : submitAttempt(attemptId)
ASVC -> ASVC : calculateScore(responses, questions)
ASVC -> DB : update Attempt {\n  status: COMPLETED,\n  score, percentage, passed\n}
DB --> ASVC : OK
ASVC -> ASVC : updateGamification\n(XP, badges, leaderboard)
API --> FE : { score, percentage,\npassed, feedback }
FE --> S : Page de résultat

@enduml
```

### 7.4 Séquence : Orientation (module xkorienta)

```plantuml
@startuml SEQ_Orientation
skinparam backgroundColor #FAFAFA
skinparam sequenceArrowThickness 2
skinparam roundcorner 10

title Séquence — Module d'orientation xkorienta

actor "Lycéen / Visiteur" as U
participant "Frontend\n(Orientation)" as FE
participant "API Backend" as API
participant "PredictionEngine" as PE
participant "AIInsightsService" as AI
database "MongoDB\n(Schools, Fields)" as DB

U -> FE : Accède à /xkorienta
FE -> API : GET /api/schools/public
API -> DB : School.find({ validated: true })\n.select(fields)
DB --> API : Liste d'écoles
API --> FE : { schools }
FE --> U : Affiche carte des écoles

U -> FE : Renseigne son profil\n(série, résultats, préférences)
FE -> API : POST /api/student/orientation/schools\n{ profile, preferences }
API -> PE : computeCompatibility(profile, schools)
PE -> DB : Charge School.specialties,\nField.requirements
DB --> PE : Données de référence
PE -> PE : Algorithme de compatibilité\n(critères académiques, géographie, frais)
PE --> API : { schoolScores: [{school, score, match}] }

API -> AI : generateInsights(profile, topSchools)
AI --> API : { insights, recommendations }

API --> FE : {\n  schools: (triées par score),\n  insights,\n  recommendations\n}
FE --> U : Recommandations personnalisées\nwith scores de compatibilité

U -> FE : Clique sur une filière
FE -> API : GET /api/student/orientation/specialties/{id}
API -> DB : Field.findById(id).populate(...)
DB --> API : Détails filière
API --> FE : { field, schools, careers, requirements }
FE --> U : Fiche détaillée de la filière

@enduml
```

---

## 8. Diagrammes d'états

### 8.1 Cycle de vie d'un examen

```plantuml
@startuml STATE_Exam
skinparam backgroundColor #FAFAFA
skinparam stateBorderColor #555555
skinparam stateBackgroundColor #EBF5FB
skinparam ArrowColor #333333

title Cycle de vie d'un examen

[*] --> DRAFT : Enseignant crée l'examen

DRAFT : Brouillon
DRAFT : Modifiable à tout moment
DRAFT : Non visible aux étudiants

DRAFT --> PENDING_VALIDATION : soumettre_pour_validation()
DRAFT --> DRAFT : modifier_contenu()

PENDING_VALIDATION : En attente de validation
PENDING_VALIDATION : Non modifiable
PENDING_VALIDATION : Visible par les inspecteurs

PENDING_VALIDATION --> VALIDATED : valider() [par Inspecteur]
PENDING_VALIDATION --> DRAFT : refuser() [avec commentaire]

VALIDATED : Validé pédagogiquement
VALIDATED : Prêt à être publié

VALIDATED --> PUBLISHED : publier() [par Enseignant]
VALIDATED --> DRAFT : retirer_pour_modif()

PUBLISHED : En ligne
PUBLISHED : Visible et passable par les étudiants
PUBLISHED : Résultats collectés en temps réel

PUBLISHED --> ARCHIVED : archiver()
PUBLISHED --> PUBLISHED : monitorer() [en temps réel]

ARCHIVED : Archivé
ARCHIVED : Lecture seule
ARCHIVED : Historique conservé

ARCHIVED --> [*]

@enduml
```

### 8.2 Cycle de vie d'une tentative d'examen

```plantuml
@startuml STATE_Attempt
skinparam backgroundColor #FAFAFA
skinparam stateBorderColor #555555
skinparam stateBackgroundColor #EAFAF1
skinparam ArrowColor #333333

title Cycle de vie d'une tentative (Attempt)

[*] --> STARTED : Étudiant démarre l'examen\n(POST /api/attempts/start)

STARTED : En cours
STARTED : Timer actif
STARTED : Anti-triche actif
STARTED : Resume token généré

STARTED --> COMPLETED : Étudiant soumet\n(POST /api/attempts/{id}/submit)
STARTED --> EXPIRED : Temps écoulé\n(soumission automatique)
STARTED --> ABANDONED : Étudiant abandonne\n(timeout serveur)

state RESUMED <<choice>>
STARTED --> RESUMED : Connexion perdue
RESUMED --> STARTED : reprendre(resumeToken)\n(dans la fenêtre autorisée)
RESUMED --> ABANDONED : délai dépassé

COMPLETED : Terminé
COMPLETED : Score calculé
COMPLETED : Gamification mise à jour
COMPLETED : Résultats disponibles

EXPIRED : Expiré (temps écoulé)
EXPIRED : Soumission automatique
EXPIRED : Score partiel calculé

ABANDONED : Abandonné
ABANDONED : Score = 0 ou partiel

COMPLETED --> [*]
EXPIRED --> [*]
ABANDONED --> [*]

note right of COMPLETED
  score = somme des points corrects
  percentage = (score / totalPoints) * 100
  passed = percentage >= examPassingScore
end note

@enduml
```

### 8.3 Cycle de vie d'une école

```plantuml
@startuml STATE_School
skinparam backgroundColor #FAFAFA
skinparam stateBorderColor #555555
skinparam stateBackgroundColor #FEF9E7

title Cycle de vie d'une école

[*] --> PENDING : Enseignant crée l'école

PENDING : En attente
PENDING : Visible uniquement par créateur

PENDING --> VALIDATED : Admin valide
PENDING --> REJECTED : Admin rejette

VALIDATED : Active
VALIDATED : Visible publiquement
VALIDATED : Enseignants peuvent rejoindre

REJECTED : Rejetée
REJECTED : Enseignant peut corriger et re-soumettre

REJECTED --> PENDING : corriger_et_resoumettre()
VALIDATED --> [*]

@enduml
```

---

## 9. Diagramme d'activité

### 9.1 Processus d'inscription et d'onboarding

```plantuml
@startuml ACT_Onboarding
skinparam backgroundColor #FAFAFA
skinparam ActivityBorderColor #555555
skinparam ActivityBackgroundColor #EBF5FB
skinparam ArrowColor #333333
skinparam roundcorner 10

title Activité — Inscription et onboarding

start

:Visiteur accède à /register;

fork
  :Formulaire classique\n(email, MDP, rôle);
fork again
  :OAuth Google / GitHub;
end fork

:Validation des données\n(format, unicité);

if (Données valides ?) then (Non)
  :Afficher erreurs de validation;
  stop
else (Oui)
  :Créer le compte en base;
  :Initialiser le profil\n(LearnerProfile ou PedagogicalProfile);
  :Rediriger vers /onboarding;
endif

:Page de sélection du rôle\n(Étudiant ou Enseignant);

if (Rôle = Enseignant ?) then (Oui)
  :Onboarding enseignant;
  :Saisie des informations\npédagogiques (matière, niveau);
  if (École existante ?) then (Oui)
    :Rechercher et rejoindre école;
    :Demande de rattachement\n(approbation Admin École);
  else (Non)
    :Créer une nouvelle école;
    :École en statut PENDING;
    :Notification Admin Système;
  endif
else (Non — Étudiant)
  :Onboarding étudiant;
  :Saisie des informations\n(classe, niveau, école);
  :Initialiser profil apprenant;
  if (Invitation de classe ?) then (Oui)
    :Rejoindre classe via token;
  else (Non)
    :Tableau de bord étudiant vide;
  endif
endif

:Redirection dashboard correspondant;

stop

@enduml
```

### 9.2 Processus complet de passage d'examen

```plantuml
@startuml ACT_ExamFlow
skinparam backgroundColor #FAFAFA
skinparam ActivityBorderColor #555555
skinparam ActivityBackgroundColor #EAFAF1
skinparam ArrowColor #333333
skinparam roundcorner 10

title Activité — Passage d'un examen

start

:Étudiant accède à la liste d'examens;
:Sélectionne un examen disponible;
:Accède au lobby;

:Lecture des règles\n(durée, nb questions, anti-triche);

if (Code retard nécessaire ?) then (Oui)
  :Saisit le code retard;
  if (Code valide ?) then (Non)
    :Message d'erreur;
    stop
  else (Oui)
    :Examen alternatif chargé;
  endif
else (Non)
endif

:Démarre l'examen;
:Tentative créée (STARTED);

repeat

  :Affiche question courante;

  fork
    :Étudiant répond;
    :Réponse sauvegardée en base;
  fork again
    :Timer en cours;
    :Anti-triche actif\n(fullscreen, focus);
  end fork

  if (Événement anti-triche ?) then (Oui)
    :Logguer l'événement;
    :Notifier enseignant (Pusher);
    :Avertissement affiché;
  else (Non)
  endif

  if (Connexion perdue ?) then (Oui)
    :Tenter reprise avec resumeToken;
    if (Reprise possible ?) then (Oui)
      :Reprendre depuis la dernière réponse;
    else (Non)
      :Tentative ABANDONED;
      stop
    endif
  else (Non)
  endif

repeat while (Questions restantes ET temps restant ?) is (Oui)

if (Soumission manuelle ?) then (Oui)
  :Étudiant clique Soumettre;
else (Non — temps écoulé)
  :Soumission automatique;
  :Statut → EXPIRED;
endif

:Calcul du score;
:Mise à jour gamification\n(XP, badges, leaderboard);
:Statut → COMPLETED;

if (Feedback immédiat activé ?) then (Oui)
  :Affiche corrections détaillées;
else (Non)
  :Affiche score et résultat global;
endif

:Propose téléchargement PDF;

stop

@enduml
```

---

## 10. Exigences non fonctionnelles

### 10.1 Performance

| Exigence | Cible | Mesure |
|----------|-------|--------|
| Temps de réponse API (95e percentile) | < 2 s | Charge normale (50 utilisateurs simultanés) |
| Temps de chargement page initiale | < 3 s | Sur connexion 3G |
| Throughput | ≥ 200 requêtes/min | Pic de charge (examens simultanés) |
| Démarrage d'une tentative | < 1 s | Incluant la génération du token |

### 10.2 Sécurité

| Exigence | Implémentation |
|----------|---------------|
| Authentification | JWT, expiration 30 jours, refresh token |
| Hachage des mots de passe | bcrypt, salt rounds = 12 |
| Validation des entrées | Zod + mongoose-sanitize (prévention NoSQL injection) |
| Protection XSS | sanitize-html sur toutes les entrées HTML |
| Protection CSRF | NextAuth CSRF token intégré |
| Rate limiting | Implémenté sur les endpoints sensibles (login, register) |
| Headers de sécurité | Helmet.js (X-Frame-Options, HSTS, CSP) |
| Exposition minimale | Pas de stack trace en production, pas de données sensibles dans les réponses |

### 10.3 Disponibilité et fiabilité

| Exigence | Cible |
|----------|-------|
| Disponibilité | ≥ 99,5 % (hors maintenance planifiée) |
| Sauvegarde des données | Quotidienne, rétention 30 jours |
| Reprise après incident | RTO ≤ 1 heure |
| Résistance aux pannes réseau | Resume token pour les tentatives en cours |

### 10.4 Maintenabilité

| Exigence | Cible |
|----------|-------|
| Couverture de tests | ≥ 80 % de couverture de branches |
| Architecture | Couches séparées : Controller → Service → Repository |
| Documentation API | Swagger/OpenAPI intégré |
| Typage | TypeScript strict mode, zéro `any` |

### 10.5 Accessibilité et compatibilité

| Exigence | Cible |
|----------|-------|
| Navigateurs supportés | Chrome, Firefox, Safari, Edge (2 dernières versions) |
| Résolution minimale | 360px (mobile) |
| Internationalisation | Français, Anglais (next-intl) |
| Mode hors ligne | Non requis dans le MVP |

---

## 11. Règles métier

### 11.1 Gestion des examens

| ID | Règle |
|----|-------|
| RM-E01 | Un examen ne peut être publié qu'après avoir été validé par un inspecteur |
| RM-E02 | Un étudiant ne peut pas passer un examen s'il n'est pas inscrit dans la classe associée |
| RM-E03 | Par défaut, un étudiant ne peut passer un examen qu'une seule fois |
| RM-E04 | Tout événement anti-triche est loggué et visible par l'enseignant en temps réel |
| RM-E05 | Lorsque le temps est écoulé, l'examen est soumis automatiquement |
| RM-E06 | Un code de retard ne peut être utilisé qu'une seule fois et a une date d'expiration |
| RM-E07 | Le score est calculé côté serveur — jamais côté client |
| RM-E08 | Un examen archivé ne peut pas être republié |

### 11.2 Gestion des utilisateurs et rôles

| ID | Règle |
|----|-------|
| RM-U01 | Un enseignant doit être rattaché à une école validée pour créer des classes |
| RM-U02 | Un administrateur école ne peut gérer que son propre établissement |
| RM-U03 | La connexion est possible par email ou par numéro de téléphone |
| RM-U04 | Les mots de passe doivent contenir au minimum 8 caractères |
| RM-U05 | L'image de profil est stockée en base de données ; elle n'est jamais insérée dans le token JWT |

### 11.3 Gamification

| ID | Règle |
|----|-------|
| RM-G01 | Les points d'XP sont attribués uniquement à la complétion d'une tentative avec statut COMPLETED |
| RM-G02 | Un badge ne peut être attribué qu'une seule fois par utilisateur |
| RM-G03 | Le classement (leaderboard) est calculé quotidiennement et mis en cache |
| RM-G04 | Une série (streak) est réinitialisée si l'étudiant ne se connecte pas pendant 24 heures |

### 11.4 Accès freemium

| ID | Règle |
|----|-------|
| RM-F01 | Les mini-tests publics sont accessibles sans compte (session invité) |
| RM-F02 | Les résultats des sessions invités ne sont pas sauvegardés de façon permanente |
| RM-F03 | Un utilisateur invité ne peut pas accéder aux fonctionnalités sociales (forums, messagerie) |

---

## 12. Contraintes et risques

### 12.1 Contraintes techniques

| Contrainte | Description |
|------------|-------------|
| **CT-01** | MongoDB comme seul système de stockage (pas de base relationnelle) |
| **CT-02** | Cookie NextAuth limité à 4 Ko par chunk — les images base64 ne peuvent pas être stockées dans le JWT |
| **CT-03** | Next.js 16 (App Router) — architecture SSR/SSG à respecter |
| **CT-04** | Dépendance à Pusher pour le temps réel (service tiers payant) |

### 12.2 Contraintes métier

| Contrainte | Description |
|------------|-------------|
| **CM-01** | Support obligatoire du système scolaire camerounais bilingue (franco/anglophone) |
| **CM-02** | Certains utilisateurs n'ont pas d'adresse email — le téléphone doit suffire |
| **CM-03** | Accès freemium requis pour les populations à faible connectivité |

### 12.3 Risques identifiés

| ID | Risque | Probabilité | Impact | Mitigation |
|----|--------|-------------|--------|------------|
| R01 | Surcharge lors d'examens simultanés | Moyenne | Élevé | Pagination des questions, mise en cache |
| R02 | Perte de tentative en cas de coupure réseau | Élevée | Élevé | Resume token côté serveur |
| R03 | Dépassement des limites de cookies (JWT trop volumineux) | Haute | Moyen | Ne jamais stocker base64 dans le JWT |
| R04 | Dépendance à HuggingFace pour la génération IA | Faible | Faible | Fonctionnalité optionnelle, fallback manuel |
| R05 | Scalabilité MongoDB en forte charge | Faible | Élevé | Index sur toutes les colonnes de recherche, pagination obligatoire |

---

## 13. Glossaire

| Terme | Définition |
|-------|------------|
| **Attempt** | Tentative de passage d'un examen par un étudiant |
| **Anti-triche** | Mécanisme détectant les comportements suspects pendant un examen (changement d'onglet, sortie plein écran) |
| **Builder V4** | Interface de création d'examens multi-chapitres avec pondération |
| **Code retard (LateCode)** | Code alphanumérique permettant à un étudiant absent d'accéder à un examen alternatif |
| **Draft** | Brouillon d'examen, état initial non visible des étudiants |
| **Freemium** | Mode d'accès sans compte permettant de passer des mini-tests publics |
| **Gamification** | Système de points (XP), badges et classements pour motiver les apprenants |
| **Inspecteur** | Rôle chargé de valider pédagogiquement les examens avant publication |
| **JWT** | JSON Web Token — format de token utilisé pour les sessions utilisateur |
| **LearnerProfile** | Profil pédagogique complet d'un étudiant (styles d'apprentissage, progression, gamification) |
| **Pusher** | Service tiers de communication temps réel (WebSocket) |
| **Resume token** | Token permettant à un étudiant de reprendre un examen interrompu |
| **Self-assessment** | Auto-évaluation par concepts, permettant à l'étudiant de mesurer sa maîtrise sur une échelle à 7 niveaux |
| **Xkorienta** | Module d'orientation scolaire et professionnelle intégré à la plateforme |

---

*Document établi sur la base du MVP validé de la plateforme Xkorienta — Avril 2026*
*Pour toute modification, soumettre une demande de revue documentaire.*
