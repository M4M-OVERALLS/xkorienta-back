# Module 19 - Education Structure

> **Audience** : Equipe frontend externe  
> **Base URL** : `{{baseUrl}}` (ex: `http://localhost:3000`)  
> **Auth** : Cookie `next-auth.session-token`  
> **Objectif** : alimenter les selecteurs de creation (ecole, classe, syllabus, examen, question)

---

## Vue d'ensemble

Le module `Education Structure` expose les referentiels academiques utilises dans tout le produit :
- niveaux d'education ;
- matieres ;
- filieres ;
- unites d'apprentissage ;
- concepts et competences.

Le systeme couvre plusieurs sous-systemes (`FRANCOPHONE`, `ANGLOPHONE`, `BILINGUAL`) et plusieurs cycles (`PRIMARY`, `LOWER_SECONDARY`, `UPPER_SECONDARY`, `UNIVERSITY`, ...).

---

## Convention API (a appliquer partout)

### Requete
- Methode HTTP : `GET` uniquement pour ce module.
- Parametres : transmis en query string.
- Valeurs multiples : format CSV (`id1,id2,id3`) si supporte.

### Reponse succes
Format standard observe :
```json
{
  "success": true,
  "count": 10,
  "data": []
}
```

### Reponse erreur (pattern conseille cote frontend)
Le payload peut varier selon endpoint/middleware, prevoir au minimum :
```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### Bonnes pratiques frontend
- Toujours gerer l'etat vide (`count = 0`).
- Debouncer les recherches si appel dynamique.
- Mettre en cache local (React Query/SWR) les referentiels peu volatils.
- Reinitialiser les champs dependants (ex: changer `level` doit vider `subject`, `unit`, `concept`).

---

## 1) Niveaux d'education (`education-levels`)

Renvoie les classes/niveaux (ex: `Terminale D`, `Form 5`, `Licence 1`).

```http
GET /api/education-levels
```

### Query params
- `subSystem` (string) : `FRANCOPHONE` | `ANGLOPHONE` | `BILINGUAL`
- `cycle` (string) : `PRIMARY` | `LOWER_SECONDARY` | `UPPER_SECONDARY` | `UNIVERSITY` | ...
- `isActive` (boolean) : `true` | `false`

> Note metier : quand `subSystem=FRANCOPHONE`, les niveaux `BILINGUAL` peuvent aussi etre retournes.

### Exemple
```http
GET /api/education-levels?subSystem=FRANCOPHONE&cycle=UPPER_SECONDARY&isActive=true
```

### Reponse 200
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "lvl_1",
      "name": "Terminale D",
      "subSystem": "FRANCOPHONE",
      "cycle": "UPPER_SECONDARY"
    },
    {
      "_id": "lvl_2",
      "name": "Terminale C",
      "subSystem": "BILINGUAL",
      "cycle": "UPPER_SECONDARY"
    }
  ]
}
```

---

## 2) Matieres (`subjects`)

Renvoie les matieres, filtrables par niveau/filiere/type.

```http
GET /api/subjects
```

### Query params
- `level` (string) : ID de `education-level` ou liste CSV (`id1,id2`)
- `field` (string) : ID de filiere
- `subjectType` (string) : ex: `THEORY`, `PRACTICAL`

### Exemple
```http
GET /api/subjects?level=lvl_1,lvl_2&subjectType=THEORY
```

### Reponse 200
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "sub_math",
      "name": "Mathematiques",
      "levels": ["lvl_1", "lvl_2"],
      "isActive": true
    }
  ]
}
```

---

## 3) Filieres (`fields`)

Renvoie les filieres/specialites (ex: `Serie C`, `Serie D`, `Informatique`, `Medecine`).

```http
GET /api/fields
```

### Query params
- `level` (string) : ID de niveau ou CSV
- `cycle` (string) : cycle academique
- `category` (string) : categorie metier
- `parentField` (string) : ID parent (structure hierarchique)

### Exemple
```http
GET /api/fields?cycle=UPPER_SECONDARY&level=lvl_1
```

### Usage UX recommande
- Afficher d'abord les filieres racines (`parentField` absent).
- Charger les specialites enfants au clic/expand.

---

## 4) Unites d'apprentissage (`learning-units`)

Renvoie les modules/chapitres/lecons selon la matiere et la hierarchie.

```http
GET /api/learning-units
```

### Query params
- `subject` (string) : ID matiere (pratiquement indispensable)
- `parentUnit` (string) : `"null"` pour les racines, sinon ID d'une unite parente
- `unitType` (string) : `MODULE` | `CHAPTER` | `LESSON`

### Exemple
```http
GET /api/learning-units?subject=sub_math&parentUnit=null&unitType=MODULE
```

### Recommandation d'integration
- Charger en cascade : `MODULE -> CHAPTER -> LESSON`.
- Conserver les IDs selectionnes dans le state global du formulaire.

---

## 5) Concepts et competences

Utilises pour tagger finement les questions d'examen et piloter la progression.

### 5.1 Concepts (`concepts`)
```http
GET /api/concepts?syllabusId={{id}}&unit={{id}}
```
- `syllabusId` : ID du syllabus courant
- `unit` : ID de l'unite d'apprentissage

Usage : recuperer les notions precises couvertes par une unite.

### 5.2 Competences (`competencies`)
```http
GET /api/competencies?subject={{id}}
```
- `subject` : ID de la matiere

Usage : recuperer les competences attendues (ex: resoudre une equation du second degre).

---

## Flux d'integration frontend recommande

Ordre de chargement pour un formulaire de creation d'examen/question :
1. Charger `education-levels`
2. Charger `fields` (si applicable au niveau selectionne)
3. Charger `subjects` (selon `level`/`field`)
4. Charger `learning-units` (selon `subject`)
5. Charger `concepts` + `competencies`

Ce flux limite les incoherences (ex: unite qui ne correspond pas a la matiere selectionnee).

---

## Exemples rapides (JavaScript)

```js
const params = new URLSearchParams({
  subSystem: "FRANCOPHONE",
  cycle: "UPPER_SECONDARY",
  isActive: "true"
});

const res = await fetch(`/api/education-levels?${params.toString()}`, {
  credentials: "include"
});

if (!res.ok) throw new Error("Impossible de charger les niveaux");
const payload = await res.json();
```

```js
function toOptions(items) {
  return items.map((item) => ({ value: item._id, label: item.name }));
}
```

---

## Checklist d'integration

- Verifier l'authentification par cookie (`credentials: "include"`).
- Gerer les etats `loading`, `error`, `empty`.
- Eviter les appels inutiles (conditionner les requetes aux dependances).
- Journaliser les erreurs cote client sans exposer de donnees sensibles.
- Tester le cas `FRANCOPHONE` + retour `BILINGUAL`.
