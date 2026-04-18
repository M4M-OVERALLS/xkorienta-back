# Plan de Documentation — Intégration Frontend

> **Cible** : Équipe frontend externe  
> **Format** : Un fichier `.md` + une collection Postman `.json` par module  
> **Stockage** : `quizlock-api/docs/frontend-integration/`

---

## État d'avancement

| # | Module | Rôles | Priorité | MD | Postman |
|---|--------|-------|----------|----|---------|
| 01 | Auth / Session | Tous | 🔴 Critique | — | — |
| 02 | Onboarding | Tous | 🔴 Haute | ✅ | ✅ |
| 03 | User Profile | Tous | 🔴 Haute | ✅ | ✅ |
| 04 | Schools | Teacher, Admin | 🔴 Haute | ✅ | ✅ |
| 05 | Classes | Teacher, Admin | 🔴 Haute | ✅ | ✅ |
| 06 | Syllabus | Teacher, Student | 🔴 Haute | ✅ | ✅ |
| **07** | **Exams (CRUD + workflow)** | **Teacher** | **🔴 Haute** | **✅** | **✅** |
| **08** | **Attempts (prise d'examen)** | **Student** | **🔴 Haute** | **✅** | **✅** |
| **09** | **Students (espace étudiant)** | **Student** | **🔴 Haute** | **✅** | **✅** |
| **10** | **Teachers** | **Teacher, Admin** | **🟡 Moyenne** | **✅** | **✅** |
| **11** | **Self-Assessment** | **Student** | **🟡 Moyenne** | **✅** | **✅** |
| **12** | **Analytics & Insights** | **Tous** | **🟡 Moyenne** | **✅** | **✅** |
| **13** | **Late Codes** | **Teacher, Student** | **🟡 Moyenne** | **✅** | **✅** |
| **14** | **Notifications** | **Tous** | **🟡 Moyenne** | **✅** | **✅** |
| **15** | **Assistance / AI** | **Student** | **🟢 Basse** | **✅** | **✅** |
| **16** | **Forum / Conversations** | **Tous** | **🟢 Basse** | **✅** | **✅** |
| 17 | Admin (validation) | Admin | 🔴 Haute | ⏳ | ⏳ |
| 18 | Orientation (étudiant) | Student | 🟢 Basse | ⏳ | ⏳ |
| **19** | **Education Structure** | **Tous** | **🟢 Basse** | **✅** | **✅** |
| 20 | Public Mini-Tests | Public | 🟢 Basse | ✅ | ✅ |

---

## Pages Frontend → Modules API

### Enseignant (`/teacher/*`)

| Page Frontend | Module(s) API |
|---------------|---------------|
| `/teacher` | User Profile, Analytics |
| `/teacher/classes` | 05-Classes |
| `/teacher/school` | 04-Schools |
| `/teacher/schools/browse` | 04-Schools |
| `/teacher/schools/join` | 04-Schools |
| `/teacher/schools/create` | 04-Schools |
| `/teacher/syllabus` | 06-Syllabus |
| `/teacher/syllabus/create` | 06-Syllabus, Classes, Education Structure |
| `/teacher/syllabus/:id` | 06-Syllabus |
| `/teacher/syllabus/:id/edit` | 06-Syllabus |
| `/teacher/exams` | **07-Exams** |
| `/teacher/exams/create` | **07-Exams**, Syllabus, Education Structure |
| `/teacher/messages` | 16-Forum/Conversations |
| `/teacher/students` | 09-Students |
| `/teacher/notifications` | 14-Notifications |

### Étudiant (`/student/*`)

| Page Frontend | Module(s) API |
|---------------|---------------|
| `/student` | 09-Students, Analytics |
| `/student/subjects` | 19-Education Structure |
| `/student/classes` | 05-Classes |
| `/student/leaderboard` | 09-Students (gamification) |
| `/student/analytics` | 12-Analytics |
| `/student/challenges` | 09-Students (challenges) |
| `/student/assistance` | 15-Assistance/AI |
| `/student/messages` | 16-Forum/Conversations |
| `/student/notifications` | 14-Notifications |
| `/student/history` | 08-Attempts |
| `/student/orientation/*` | 18-Orientation |

### Admin (`/admin/*`)

| Page Frontend | Module(s) API |
|---------------|---------------|
| `/admin` | 17-Admin |
| `/admin/teachers` | 10-Teachers, 17-Admin |
| `/admin/classes` | 05-Classes, 17-Admin |
| `/admin/compose` | 17-Admin |
| `/admin/notifications` | 14-Notifications |
| `/settings` | 03-User Profile |

---

## Convention de nommage des fichiers

```
docs/frontend-integration/
├── 00-plan.md                              ← Ce fichier
├── 01-auth.md                              ← À créer
├── 02-onboarding.md                        ✅
├── 03-user-profile.md                      ✅
├── 04-schools.md                           ✅
├── 05-classes.md                           ✅
├── 06-syllabus.md                          ✅
├── 07-exams.md                             ✅
├── 08-attempts.md                          ← À créer
├── 19-education-structure.md               ✅
├── 20-public-mini-tests.md                 ✅
├── ...
└── postman/
    ├── 02-onboarding.postman_collection.json    ✅
    ├── 03-user-profile.postman_collection.json  ✅
    ├── 04-schools.postman_collection.json       ✅
    ├── 05-classes.postman_collection.json       ✅
    ├── 06-syllabus.postman_collection.json      ✅
    ├── 07-exams.postman_collection.json         ✅
    ├── 20-public-mini-tests.postman_collection.json ✅
    └── ...
```

---

## Variables Postman globales

Toutes les collections utilisent les variables d'environnement suivantes :

| Variable | Valeur par défaut | Description |
|----------|-------------------|-------------|
| `baseUrl` | `http://localhost:3000` | URL de base de l'API |
| `teacherExamId` | _(à remplir)_ | ID d'un examen existant |
| `syllabusId` | _(à remplir)_ | ID d'un syllabus existant |
| `classId` | _(à remplir)_ | ID d'une classe existante |
| `attemptId` | _(à remplir)_ | ID d'une tentative |

> **Auth** : Cookie `next-auth.session-token` géré automatiquement par Postman si vous utilisez "Cookies" dans les paramètres de collection.
