# 🔄 Gestion des Cycles Scolaires

Ce document explique comment gérer les cycles scolaires dans QuizLock, en particulier pour le contexte camerounais où les établissements peuvent avoir différentes configurations.

## 📚 Contexte

Au Cameroun, les établissements scolaires peuvent avoir différentes configurations :

### École Primaire

- ✅ **École primaire complète** : Maternelle (PS → GS) + Primaire (CP → CM2)
- ⚪ **Primaire uniquement** : CP → CM2
- ⚪ **Maternelle uniquement** : PS → GS

### École Secondaire

- ✅ **Collège-Lycée combiné** : 6ème → Terminale _(cas le plus fréquent)_
- ⚪ **Collège uniquement** : 6ème → 3ème
- ⚪ **Lycée uniquement** : 2nde → Terminale

### Enseignement Supérieur

- ✅ **Université complète** : Licence + Master
- ⚪ **Licence uniquement** : L1 → L3
- ⚪ **Master uniquement** : M1 → M2

---

## 🏗️ Architecture de la solution

### 1. Modèle de données

Le modèle `School` contient maintenant un champ `cycles` :

```typescript
interface ISchool {
  type: SchoolType; // PRIMARY, SECONDARY, HIGHER_ED...
  cycles?: Cycle[]; // Cycles effectivement enseignés
  // ... autres champs
}
```

**Exemples** :

```typescript
// Collège-Lycée combiné (le plus fréquent)
{
    type: SchoolType.SECONDARY,
    cycles: [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE]
}

// Collège uniquement
{
    type: SchoolType.SECONDARY,
    cycles: [Cycle.SECONDAIRE_PREMIER_CYCLE]
}

// Lycée uniquement
{
    type: SchoolType.SECONDARY,
    cycles: [Cycle.SECONDAIRE_SECOND_CYCLE]
}
```

### 2. Stratégies mises à jour

Les stratégies `PrimaryExamStrategy`, `SecondaryExamStrategy`, et `HigherEdExamStrategy` ont été mises à jour pour accepter un paramètre `schoolCycles` :

```typescript
interface ISchoolTypeStrategy {
  isEducationLevelCompatible(
    educationLevelId: string,
    schoolCycles?: Cycle[], // 🆕 Nouveau paramètre optionnel
  ): Promise<boolean>;
}
```

**Comportement** :

- Si `schoolCycles` n'est **pas fourni** → Accepte tous les niveaux du type d'école (comportement par défaut)
- Si `schoolCycles` est **fourni** → Valide que le niveau appartient bien à l'un des cycles de l'école

---

## 🛠️ Utilisation

### 1. Vérifier la compatibilité d'un niveau avec une école

```typescript
import { isEducationLevelCompatibleWithSchool } from "@/lib/strategies/school-type";

// Vérifier si un niveau 6ème est compatible avec un lycée
const isCompatible = await isEducationLevelCompatibleWithSchool(
  "507f1f77bcf86cd799439011", // ID du lycée
  "507f191e810c19729de860ea", // ID de la 6ème
);

console.log(isCompatible); // false (un lycée n'enseigne que 2nde → Tle)
```

### 2. Vérifier plusieurs niveaux à la fois

```typescript
import { areEducationLevelsCompatibleWithSchool } from "@/lib/strategies/school-type";

const result = await areEducationLevelsCompatibleWithSchool(schoolId, [
  "6ème",
  "5ème",
  "2nde",
]);

if (!result.compatible) {
  console.log("Niveaux incompatibles :", result.incompatibleLevels);
  // Résultat pour un collège uniquement :
  // [{ id: '...', name: '2nde', cycle: 'LYCEE' }]
}
```

### 3. Obtenir les niveaux compatibles avec une école

```typescript
import { getCompatibleEducationLevelsForSchool } from "@/lib/strategies/school-type";

const levels = await getCompatibleEducationLevelsForSchool(schoolId);

console.log(levels);
// Pour un lycée uniquement :
// [
//   { id: '...', name: '2nde', cycle: 'LYCEE' },
//   { id: '...', name: '1ère', cycle: 'LYCEE' },
//   { id: '...', name: 'Terminale', cycle: 'LYCEE' }
// ]
```

### 4. Suggérer les cycles pour une école (UI)

```typescript
import { getSuggestedCyclesForSchoolType } from "@/lib/strategies/school-type";
import { SchoolType } from "@/models/School";

const suggestions = getSuggestedCyclesForSchoolType(SchoolType.SECONDARY);

console.log(suggestions);
// {
//   default: [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE],
//   options: [
//     {
//       cycles: [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE],
//       label: "Collège-Lycée combiné",
//       description: "6ème → Terminale (cas le plus fréquent au Cameroun)",
//       isCommon: true
//     },
//     {
//       cycles: [Cycle.SECONDAIRE_PREMIER_CYCLE],
//       label: "Collège uniquement",
//       description: "6ème → 3ème",
//       isCommon: false
//     },
//     // ...
//   ]
// }
```

---

## 🔄 Migration des données existantes

### Exécuter la migration

```bash
node scripts/migrate-add-school-cycles.js
```

### Ce que fait le script

Le script analyse chaque école et peuple le champ `cycles` :

| Type d'école      | Cycles par défaut                               | Logique                             |
| ----------------- | ----------------------------------------------- | ----------------------------------- |
| `PRIMARY`         | `[MATERNELLE, PRIMAIRE]`                        | École primaire complète             |
| `SECONDARY`       | `[COLLEGE, LYCEE]`                              | Collège-Lycée combiné (cas courant) |
| `HIGHER_ED`       | `[SUPERIEUR]` ou déduit des niveaux académiques | Analyse les `academicLevel`         |
| `TRAINING_CENTER` | `[]`                                            | Pas de cycles applicables           |
| `OTHER`           | `[]`                                            | Pas de cycles applicables           |

### Vérification post-migration

Le script affiche un rapport détaillé :

```
=== Vérification de la migration ===

📊 Écoles :
   - Total : 150
   - Avec cycles : 142
   - Sans cycles : 8
   ✅ Toutes les écoles ont des cycles définis

📊 Répartition par type d'école :

   SECONDARY : 85 école(s)
      └─ Cycles : COLLEGE, LYCEE
      └─ Cycles : COLLEGE
      └─ Cycles : LYCEE

   PRIMARY : 45 école(s)
      └─ Cycles : MATERNELLE, PRIMAIRE

   HIGHER_ED : 12 école(s)
      └─ Cycles : SUPERIEUR
```

---

## 🎯 Cas d'usage concrets

### Cas 1 : Création d'un examen pour un collège

```typescript
// Un professeur dans un collège uniquement (6ème → 3ème)
// veut créer un examen

const school = await School.findById(schoolId);
// { type: SECONDARY, cycles: [COLLEGE] }

// Obtenir les niveaux compatibles
const levels = await getCompatibleEducationLevelsForSchool(schoolId);
// Résultat : [6ème, 5ème, 4ème, 3ème]

// Si le prof essaie d'ajouter la 2nde
const isCompatible = await isEducationLevelCompatibleWithSchool(
  schoolId,
  secondeLevelId,
);
// Résultat : false

// Message UI : "La classe 2nde n'est pas disponible dans votre établissement (Collège uniquement)."
```

### Cas 2 : Validation lors de l'assignation d'un examen

```typescript
// Avant d'assigner un examen à une classe, vérifier la compatibilité
const exam = await Exam.findById(examId).populate("targetLevels");

const result = await areEducationLevelsCompatibleWithSchool(
  schoolId,
  exam.targetLevels.map((l) => l._id),
);

if (!result.compatible) {
  throw new Error(
    `Cet examen contient des niveaux incompatibles avec votre école :
        ${result.incompatibleLevels.map((l) => l.name).join(", ")}`,
  );
}
```

### Cas 3 : Interface de création d'école

```tsx
// Component: SchoolCyclesSelector.tsx

function SchoolCyclesSelector({ schoolType, value, onChange }) {
  const suggestions = getSuggestedCyclesForSchoolType(schoolType);

  return (
    <div>
      <h3>Quels cycles enseignez-vous ?</h3>
      {suggestions.options.map((option) => (
        <button
          key={option.cycles.join("-")}
          onClick={() => onChange(option.cycles)}
          className={option.isCommon ? "recommended" : ""}
        >
          {option.label}
          {option.isCommon && <Badge>Recommandé</Badge>}
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  );
}
```

---

## ✅ Avantages de cette approche

1. **Flexible** : Chaque école déclare exactement ses cycles
2. **Pas de breaking change** : Compatible avec l'architecture existante
3. **Validation automatique** : Empêche les incohérences (ex: 6ème dans un lycée)
4. **Contexte camerounais** : Reflète la réalité des établissements combinés
5. **Rétrocompatible** : Si `cycles` est vide, utilise le comportement par défaut

---

## 🚀 Migration depuis les anciennes versions

Si vous avez des écoles existantes sans le champ `cycles` :

1. ✅ Exécuter le script de migration : `node scripts/migrate-add-school-cycles.js`
2. ✅ Vérifier les résultats dans le rapport
3. ✅ Ajuster manuellement les écoles si nécessaire (via l'interface admin)
4. ✅ Les nouvelles écoles devront définir leurs cycles à la création

---

## 📝 Notes importantes

- Le champ `cycles` est **optionnel** : si non défini, le système utilise les valeurs par défaut
- Pour les **établissements combinés** (cas majoritaire), utiliser `[COLLEGE, LYCEE]`
- Pour les **écoles spécialisées** (collège seul, lycée seul), définir le cycle précis
- Les stratégies acceptent toujours le paramètre `schoolCycles` comme **optionnel** pour garantir la rétrocompatibilité

---

## 🔗 Références

- Modèle : `/src/models/School.ts`
- Stratégies : `/src/lib/strategies/school-type/`
- Helpers : `/src/lib/strategies/school-type/helpers.ts`
- Migration : `/scripts/migrate-add-school-cycles.js`
