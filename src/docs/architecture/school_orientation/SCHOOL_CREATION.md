# Création d'une école (backend)

## Objectif

Mettre à disposition un endpoint unique (multi-steps côté frontend) pour créer une école en persistant les données dans les modèles existants : `School`, `SchoolProfile`, `RegulatoryApproval`, `SchoolScore`, `InfrastructureMetric` et `Partner`.

---

## Endpoint

| Méthode | URL | Description |
|---------|-----|-------------|
| `POST` | `/api/school/{teacherId}/create` | Créer une nouvelle école |

### Authentification

- **Requise** : Oui (session NextAuth)
- **Rôle autorisé** : `UserRole.TEACHER` uniquement

### Headers requis

```
Content-Type: application/json
```

---

## Payload attendu (SchoolCreationForm)

```typescript
type SchoolCreationPartner = {
    name: string
    sector?: string
    type?: string
    proof?: string
    country?: string
    website?: string
}

type SchoolCreationForm = {
    identity: {
        name: string          // Obligatoire
        acronym?: string
        type: string          // Obligatoire (ex: "HIGHER_ED", "TRAINING_CENTER", etc.)
        city?: string
        department?: string
        region?: string
        country?: string
        address?: string
        website?: string
        contactEmail?: string
        contactPhone?: string
    }
    training?: {
        dominantFields?: string[]
        dominantSpecialties?: string[]
        specialtiesOffered?: string[]
        diplomas?: string[]
        teachingLanguages?: string[]   // "Français", "Anglais", etc.
        modalities?: string            // "Hybride", "Présentiel", "Distance"
    }
    legal?: {
        accreditationNumber?: string   // Si fourni, crée un RegulatoryApproval
        openingAuthorization?: string
        authorizationDate?: string     // Format ISO: "2023-09-12"
        mainSupervision?: string       // Ex: "MINESUP"
        secondarySupervisions?: string[]
        verificationDocs?: string[]
        foreignDiplomasNoAccreditation?: string
        foreignDiplomasWithAccreditation?: string
        status?: string                // "CONFORME", "Issued", "Expired", etc.
    }
    performance?: {
        foundedYear?: string           // Ex: "2008"
        yearsOfExistence?: string
        successRates?: string
        officialRanking?: string
        accreditations?: string
    }
    insertion?: {
        localPartners?: SchoolCreationPartner[]
        internationalPartners?: SchoolCreationPartner[]
        internshipAgreements?: string
        internshipAgreementCount?: string
        alumniTracking?: string
        alumniExamples?: string
        topRecruiters?: string[]
        insertionRate6?: string
        insertionRate12?: string
    }
    infrastructure?: {
        campusCompliant?: string
        libraryResources?: string
        libraryQuality?: string
        labs?: string                  // "Oui" / "Non"
        labEquipment?: string
        itPark?: string
        itParkVolume?: string
        internetQuality?: string       // "Faible", "Moyen", "Forte"
        accessibility?: string         // "Oui" / "Non"
        safetyNotes?: string
    }
    financial?: {
        annualCost?: string
        feeRegistration?: string
        feeTuition?: string
        feeExams?: string
        feeMaterials?: string
        otherFees?: string
        scholarships?: string
        cityCostOfLiving?: string
    }
    studentExperience?: {
        clubs?: string
        mentoring?: string
        satisfactionRate?: string
        mobility?: string
        discipline?: string
    }
    score?: {
        legality?: string              // 0-100
        performance?: string           // 0-100
        insertion?: string             // 0-100
        infrastructures?: string       // 0-100
        affordability?: string         // 0-100
        global?: string                // 0-100
    }
}
```

---

## Mapping backend

### School (modèle principal)

| Champ frontend | Champ backend | Notes |
|----------------|---------------|-------|
| `identity.name` | `name` | Obligatoire |
| `identity.acronym` | `acronym` | |
| `identity.type` | `type` | Normalisé vers `SchoolType` enum |
| `identity.address` | `address` | |
| `identity.city` | `city` | Résolution par `_id` ou `name` |
| `identity.department` | `department` | Résolution par `_id` ou `name` |
| `identity.region` | `region` | Résolution par `_id` ou `name` |
| `identity.country` | `country` | Résolution par `_id` ou `name` |
| `identity.*Email/Phone/Website` | `contactInfo` | Objet imbriqué |
| `training.modalities` | `modality` | Normalisation automatique |
| `training.teachingLanguages` | `Languages` | Normalisation automatique |
| `performance.foundedYear` | `foundedYear` | Converti en nombre |
| **Session utilisateur** | `owner` | **ID du teacher connecté** |
| **Session utilisateur** | `admins` | [ID du teacher] |
| **Session utilisateur** | `teachers` | [ID du teacher] |

### SchoolProfile

Stocke toutes les données textuelles détaillées :
- `identity` (labels textuels)
- `training`
- `performance`
- `insertion`
- `infrastructure`
- `financial`
- `studentExperience`

### RegulatoryApproval

Créé **uniquement si** `legal.accreditationNumber` est fourni.

| Champ frontend | Champ backend |
|----------------|---------------|
| `legal.accreditationNumber` | `approvalNumber` |
| `legal.status` | `approvalStatus` |
| `legal.authorizationDate` | `approvalDate` |
| `legal.openingAuthorization` | `openingAuthorization` |
| `legal.mainSupervision` | `issuedBy` ou `issuedByName` |
| `legal.secondarySupervisions` | `secondarySupervisions` |
| `legal.verificationDocs` | `verificationDocs` |

### SchoolScore

Créé si la section `score` est fournie. Scores bornés entre 0 et 100.

### InfrastructureMetric

Créé si au moins un des champs `labs`, `accessibility`, ou `internetQuality` est fourni.

### Partner

Les partenaires sont créés automatiquement à partir de `insertion.localPartners` et `insertion.internationalPartners` si `name` + `sector` sont fournis.

---

## Réponses HTTP

### Succès (201)

```json
{
    "success": true,
    "data": {
        "school": { "_id": "...", "name": "...", ... },
        "profile": { "_id": "...", ... },
        "regulatoryApproval": { "_id": "...", ... },
        "score": { "_id": "...", ... },
        "infrastructureMetric": { "_id": "...", ... }
    }
}
```

### Erreurs

| Code | Message | Cause |
|------|---------|-------|
| `401` | "Non authentifié" | Pas de session |
| `403` | "Seuls les enseignants peuvent créer une école" | Rôle non autorisé |
| `400` | "Missing required identity fields" | `identity.name` ou `identity.type` manquant |
| `500` | "Erreur serveur" | Erreur interne |

---

## Procédure d'intégration côté frontend

### 1. Types TypeScript

```typescript
// types/school-creation.ts

export type SchoolCreationPartner = {
    name: string
    sector?: string
    type?: string
    proof?: string
    country?: string
    website?: string
}

export type SchoolCreationForm = {
    identity: {
        name: string
        acronym?: string
        type: string
        city?: string
        department?: string
        region?: string
        country?: string
        address?: string
        website?: string
        contactEmail?: string
        contactPhone?: string
    }
    training?: {
        dominantFields?: string[]
        dominantSpecialties?: string[]
        specialtiesOffered?: string[]
        diplomas?: string[]
        teachingLanguages?: string[]
        modalities?: string
    }
    legal?: {
        accreditationNumber?: string
        openingAuthorization?: string
        authorizationDate?: string
        mainSupervision?: string
        secondarySupervisions?: string[]
        verificationDocs?: string[]
        foreignDiplomasNoAccreditation?: string
        foreignDiplomasWithAccreditation?: string
        status?: string
    }
    performance?: {
        foundedYear?: string
        yearsOfExistence?: string
        successRates?: string
        officialRanking?: string
        accreditations?: string
    }
    insertion?: {
        localPartners?: SchoolCreationPartner[]
        internationalPartners?: SchoolCreationPartner[]
        internshipAgreements?: string
        internshipAgreementCount?: string
        alumniTracking?: string
        alumniExamples?: string
        topRecruiters?: string[]
        insertionRate6?: string
        insertionRate12?: string
    }
    infrastructure?: {
        campusCompliant?: string
        libraryResources?: string
        libraryQuality?: string
        labs?: string
        labEquipment?: string
        itPark?: string
        itParkVolume?: string
        internetQuality?: string
        accessibility?: string
        safetyNotes?: string
    }
    financial?: {
        annualCost?: string
        feeRegistration?: string
        feeTuition?: string
        feeExams?: string
        feeMaterials?: string
        otherFees?: string
        scholarships?: string
        cityCostOfLiving?: string
    }
    studentExperience?: {
        clubs?: string
        mentoring?: string
        satisfactionRate?: string
        mobility?: string
        discipline?: string
    }
    score?: {
        legality?: string
        performance?: string
        insertion?: string
        infrastructures?: string
        affordability?: string
        global?: string
    }
}

export type SchoolCreationResponse = {
    success: boolean
    data?: {
        school: { _id: string; name: string }
        profile: { _id: string }
        regulatoryApproval?: { _id: string }
        score?: { _id: string }
        infrastructureMetric?: { _id: string }
    }
    message?: string
}
```

### 2. Service de création

```typescript
// services/school.service.ts

import type { SchoolCreationForm, SchoolCreationResponse } from "@/types/school-creation"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

export async function createSchool(teacherId: string, form: SchoolCreationForm): Promise<SchoolCreationResponse> {
    const response = await fetch(`${API_BASE}/api/school/${teacherId}/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include", // Envoie le cookie de session NextAuth
        body: JSON.stringify(form),
    })

    const json = await response.json()

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Non authentifié. Veuillez vous reconnecter.")
        }
        if (response.status === 403) {
            throw new Error("Accès refusé. Seuls les enseignants peuvent créer une école.")
        }
        if (response.status === 400) {
            throw new Error(json.message || "Données invalides. Vérifiez les champs requis.")
        }
        throw new Error(json.message || "Erreur serveur. Veuillez réessayer.")
    }

    return json as SchoolCreationResponse
}
```

### 3. Exemple d'utilisation dans un composant React

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createSchool } from "@/services/school.service"
import type { SchoolCreationForm } from "@/types/school-creation"

export default function CreateSchoolPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // État du formulaire multi-steps
    const [formData, setFormData] = useState<SchoolCreationForm>({
        identity: {
            name: "",
            type: "HIGHER_ED",
        },
    })

    const handleSubmit = async () => {
        // Validation minimale
        if (!formData.identity.name.trim()) {
            setError("Le nom de l'école est requis")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const result = await createSchool(formData)

            if (result.success && result.data?.school?._id) {
                // Redirection vers la page de l'école créée
                router.push(`/teacher/schools/${result.data.school._id}`)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Une erreur est survenue")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Créer une école</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Vos composants de formulaire multi-steps ici */}

            <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? "Création en cours..." : "Créer l'école"}
            </button>
        </div>
    )
}
```

### 4. Exemple de payload complet

```typescript
const form: SchoolCreationForm = {
    identity: {
        name: "Institut Polytechnique Saint-Marc",
        acronym: "IPESM",
        type: "HIGHER_ED",
        city: "Yaoundé",
        department: "Mfoundi",
        region: "Centre",
        country: "Cameroun",
        address: "Rue du Lac, BP 1234",
        website: "https://ipesm.edu.cm",
        contactEmail: "contact@ipesm.edu.cm",
        contactPhone: "+237 6 99 00 00 00",
    },
    training: {
        dominantFields: ["Informatique", "Génie industriel"],
        dominantSpecialties: ["Data & IA", "Cybersécurité"],
        specialtiesOffered: ["Développement web", "Systèmes embarqués"],
        diplomas: ["BTS", "Licence Pro", "Master"],
        teachingLanguages: ["Français", "Anglais"],
        modalities: "Hybride",
    },
    legal: {
        accreditationNumber: "MINESUP-AGR-2023-1457",
        openingAuthorization: "Délivrée",
        authorizationDate: "2023-09-12",
        mainSupervision: "MINESUP",
        secondarySupervisions: ["MINEFOP", "MINPOSTEL"],
        verificationDocs: ["scan_arrete_ouverture.pdf"],
        status: "CONFORME",
    },
    performance: {
        foundedYear: "2008",
        yearsOfExistence: "17",
        successRates: "88%",
        officialRanking: "Top 10 MINESUP 2024",
    },
    insertion: {
        localPartners: [
            { name: "Camtel", sector: "Télécoms" },
            { name: "MTN Cameroon", sector: "Télécoms" },
        ],
        internationalPartners: [
            { name: "ESIGELEC", sector: "Éducation", country: "France" },
        ],
        topRecruiters: ["Orange", "Camtel", "GIZ"],
        insertionRate12: "84%",
    },
    infrastructure: {
        labs: "Oui",
        internetQuality: "Forte",
        accessibility: "Oui",
    },
    score: {
        legality: "92",
        performance: "86",
        insertion: "81",
        infrastructures: "88",
        affordability: "74",
        global: "84",
    },
}

// Appel
const response = await fetch(`/api/school/${teacherId}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(form),
})
```

---

## Récapitulatif

| Élément | Valeur |
|---------|--------|
| **Méthode** | `POST` |
| **URL** | `/api/school/create` |
| **Content-Type** | `application/json` |
| **Auth** | Session NextAuth (cookie avec `credentials: "include"`) |
| **Rôle requis** | `TEACHER` |
| **Champs obligatoires** | `identity.name`, `identity.type` |
| **Owner automatique** | L'ID du teacher connecté est utilisé comme `owner` |

---

## Notes techniques

1. **Pas de transactions MongoDB** : Le code fonctionne sans replica set (standalone MongoDB). En cas d'erreur pendant la création, un rollback manuel est effectué.

2. **Résolution des références** : Les champs `city`, `department`, `region`, `country` peuvent être passés soit comme ObjectId, soit comme nom (résolution automatique).

3. **Normalisation** : Les valeurs comme `modalities` ("Hybride", "hybride", "HYBRIDE") et `teachingLanguages` ("Français", "francais") sont normalisées automatiquement.

4. **Partenaires** : Les partenaires sont créés automatiquement s'ils n'existent pas déjà dans la base.
