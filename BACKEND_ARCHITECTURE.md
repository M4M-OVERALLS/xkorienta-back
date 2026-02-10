# Architecture Backend - Quizlock API

> **Pattern adopté:** Route → Controller → Service → Repository  
> **Date:** Janvier 2026

---

## 📋 Vue d'ensemble

Le backend de Quizlock suit une architecture en couches stricte pour garantir la maintenabilité, la testabilité et la séparation des responsabilités.

### Structure des couches

```
Request → Route → Controller → Service → Repository → Database
         ↓         ↓            ↓          ↓
      Auth/DB   HTTP Logic   Business   Data Access
```

---

## 🎯 Responsabilités par couche

### 1. **Route** (`src/app/api/*/route.ts`)
- Point d'entrée Next.js
- Authentification via `getServerSession`
- Connexion à la base de données (`connectDB`)
- Validation basique des paramètres (IDs, etc.)
- Délégation au Controller

**Exemple:**
```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { ClassController } from "@/lib/controllers/ClassController";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    await connectDB();
    return ClassController.getClasses(req, session.user.id);
}
```

---

### 2. **Controller** (`src/lib/controllers/*Controller.ts`)
- Parse les requêtes HTTP (body, query params)
- Formate les réponses JSON
- Gère les codes de statut HTTP (200, 400, 500...)
- Délégue la logique métier au Service
- Gère les erreurs et les traduit en réponses HTTP

**Exemple:**
```typescript
export class ClassController {
    static async getClasses(req: Request, userId: string) {
        try {
            const classes = await ClassService.getTeacherClasses(userId);
            return NextResponse.json({ success: true, data: classes });
        } catch (error: any) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 500 }
            );
        }
    }
}
```

---

### 3. **Service** (`src/lib/services/*Service.ts`)
- Logique métier pure
- Validation des données métier
- Orchestration de plusieurs Repositories si nécessaire
- Agnostique du contexte HTTP
- Lève des exceptions (`throw new Error()`)

**Exemple:**
```typescript
export class ClassService {
    static async getTeacherClasses(teacherId: string) {
        const classes = await Class.find({ mainTeacher: teacherId })
            .populate('school level field specialty')
            .lean();
        return classes;
    }
}
```

---

### 4. **Repository** (`src/lib/repositories/*Repository.ts`)
- Accès direct à la base de données
- Encapsule les requêtes Mongoose/MongoDB
- Retourne des modèles ou des DTOs
- Gère la logique de persistance

**Exemple:**
```typescript
export class AuthRepository {
    async findByEmailWithPassword(email: string) {
        await connectDB();
        return User.findOne({ email }).select('+password');
    }
}
```

---

## ✅ Modules déjà refactorés

| Module | Routes | Controller | Service | Repository |
|--------|--------|------------|---------|------------|
| **Authentification** | ✅ `/api/auth/verify` | ✅ `AuthController` | ✅ `AuthService` | ✅ `AuthRepository` |
| **Inscription** | ✅ `/api/register/v2` | ✅ `RegistrationController` | ✅ `RegistrationService` | ✅ `RegistrationRepository` |
| **Classes** | ✅ `/api/classes/*` | ✅ `ClassController` | ✅ `ClassService` | (intégré dans Service) |
| **Écoles** | ✅ `/api/schools/*` | ✅ `SchoolController` | ✅ `SchoolService` | ✅ `SchoolRepository` |
| **Profils** | ✅ `/api/profiles/pedagogical` | ✅ `ProfileController` | ✅ `ProfileService` | (intégré dans Service) |
| **Niveaux/Filières** | ✅ `/api/education-levels`, `/api/fields` | ✅ `EducationStructureController` | ✅ `EducationStructureService` | (intégré dans Service) |
| **Spécialités (apprenant)** | ✅ `/api/student/specialties` | ✅ `StudentController` | ✅ `StudentService` | ✅ `SpecialtyRepository` |

---

## 🎯 Fonctionnalité: Liste des spécialités pour l'apprenant

### Endpoint
- **GET** `/api/student/specialties`
- Auth requis (session NextAuth)
- Paramètre optionnel: `?studentId=...` (sinon session)

### Source des données
- `Specialty` → informations de base (domaine, filière, niveau, durée, etc.)
- `SpecialtySkill` → `Skill` (compétences)
- `SpecialtyOutcome` → `CareerOutcome` (débouchés)
- `SchoolProgram` → `School` (écoles proposant la spécialité)
- `SpecialtyScore` (scores employabilité / popularité)

### DTO renvoyé
Le DTO est défini dans `src/lib/dtos/SpecialtyDTO.ts` et expose une structure stable pour le frontend:

```typescript
{
  _id: string
  specialty_id: string
  domain: string
  field: string
  specialty_name: string
  level: string
  degree_awarded: string
  duration_years: number
  language: string[]
  mode: string
  prerequisites?: string[]
  general_objective?: string
  specific_objectives?: string[]
  value_proposition?: string
  exit_profile?: string
  created_at: string
  skills: { skill_id: string; name: string; skill_type: string }[]
  career_outcomes: { outcome_id: string; name: string; sector: string }[]
  schools_offering: { school_id: string; school_name: string; tuition_fee?: { min: number; max: number; currency: string } }[]
  average_salary?: { min: number; max: number; currency: string }
  employment_rate?: number
  popularity_score?: number
}
```

### Intégration frontend (résumé)
- Appeler `GET /api/student/specialties` côté client (ou server component).
- Consommer `data` pour afficher les cartes de spécialités et les sections associées (skills, débouchés, écoles, scores).
- Utiliser les champs `employment_rate` et `popularity_score` pour les badges/indicateurs.

---

## 🔄 Standards de qualité

### Typage TypeScript
- Typage strict obligatoire
- Éviter `any` sauf cas exceptionnels
- Interfaces pour les DTOs et paramètres

### Gestion des erreurs
```typescript
// Service - Lève des exceptions
if (!user) throw new Error("User not found");

// Controller - Traduit en HTTP
catch (error: any) {
    return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
    );
}
```

### Conventions de nommage
- **Classes:** PascalCase (`AuthController`, `ClassService`)
- **Méthodes:** camelCase (`getClasses`, `verifyCredentials`)
- **Fichiers:** Match le nom de la classe

---

## 📝 Checklist pour nouveau module

- [ ] Créer le Controller dans `src/lib/controllers/`
- [ ] (Optionnel) Créer le Repository dans `src/lib/repositories/`
- [ ] Service existe déjà ou à créer dans `src/lib/services/`
- [ ] Créer/Modifier la Route dans `src/app/api/`
- [ ] Authentification dans la Route si nécessaire
- [ ] Tests unitaires (TODO)

---

## 🎓 Ressources

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [NextAuth.js](https://next-auth.js.org/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
