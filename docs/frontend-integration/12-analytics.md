# Module 12 — Analytics & Insights

> **Audience** : Équipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token`

---

## Vue d'ensemble

Le module Analytics fournit des données agrégées et décisionnelles pour différents rôles.
- Pour les **Professeurs / Directeurs / Inspecteurs** : Une API centralisée `GET /api/analytics` qui génère des rapports variés selon le paramètre `type` (comparaison de classes, forces/faiblesses, corrélations, cohorte).
- Pour les **Étudiants** : Une API `GET /api/student/analytics` dédiée qui retourne leurs propres métriques de progression afin d'alimenter leur dashboard global (gamification exclue, traitée ailleurs).

---

## 1. Analytics Étudiant (Dashboard Principal)

```
GET /api/student/analytics
```

**Auth requise** : Oui (`STUDENT`)

Récupère les statistiques macroscopiques d'un étudiant (taux de complétion, moyennes, temps passé).

#### Réponse 200 (Success)
```json
{
  "success": true,
  "analytics": {
    "overallProgress": 78,
    "averageScore": 14.5,
    "totalExamsTaken": 12,
    "totalStudyTime": 3600,
    "subjectPerformance": [
       { "subjectId": "...", "subjectName": "Mathématiques", "average": 15 },
       { "subjectId": "...", "subjectName": "Physique", "average": 12 }
    ],
    "recentActivity": [ /* ... */ ]
  }
}
```

---

## 2. Analytics Avancés (Profs, Admins, Inspecteurs)

```
GET /api/analytics?type={type}&[...]
```
**Auth requise** : `TEACHER`, `SCHOOL_ADMIN`, `INSPECTOR`, `PRINCIPAL`, `RECTOR`

Un endpoint "couteau-suisse" où le paramètre `type` détermine le moteur d'analyse à déclencher et les paramètres requis.

### Les Différents `type` disponibles :

| `type` | Paramètres URL Requis / Optionnels | Description | Retour Typique |
|--------|-----------------------------------|-------------|----------------|
| `strengths` | `studentId` | Identifie les forces et faiblesses individuelles (concepts acquis vs non acquis). | Objet `{ strengths: [...], weaknesses: [...] }` |
| `compare-classes` | `schoolId`, `subjectId` (opt) | Compare les performances des classes au sein d'une école. | Array comparatif avec moyennes et distributions. |
| `compare-schools` | `schoolIds` (séparés par virgules), `region` (opt) | Compare les cohortes d'écoles complètes. | Tableau croisé dynamique d'écoles. |
| `subject` | `classId`, `subjectId` | Analyse en profondeur les notes d'une classe pour une matière précise. | Avg score, concepts bloquants globaux. |
| `progression` | `studentId`, `startDate` (ISO), `endDate` (ISO) | Évolution au fil du temps (par défaut 30 j). | Series temporelles pour graphiques. |
| `cohort` | `studentIds` (séparés par virgules), `cohortName` (opt) | Crée un rapport consolidé sur un groupe personnalisé d'élèves. | Métriques globales du groupe. |
| `correlations` | `studentIds` (séparés par virgules, min 5) | Trouve des corrélations statistiques (ex: les élèves bons en géométrie sont-ils bons en algèbre ?). | Matrice de corrélation de Pearson. |
| `engagement` | `(aucun)` utilise le token | Récupère le taux d'engagement et le taux de réponse du prof actuel. | `{ responseRate: 98, activeForums: 3 }` |

#### Exemple d'Appel (Progression)
```
GET /api/analytics?type=progression&studentId=65e1fbc21a4f0b29c9c10bc4&startDate=2024-01-01T00:00:00Z
```

#### Réponse 200
```json
{
  "success": true,
  "data": {
    "trend": "UPWARD",
    "dataPoints": [
      { "date": "2024-01-15", "score": 12 },
      { "date": "2024-02-15", "score": 14.5 }
    ]
  }
}
```

#### Erreurs
- **401/403** : Non autorisé ou rôle invalide.
- **400** : Paramètre obligatoire manquant (ex: `message: "studentId required"` pour le type `strengths`).
