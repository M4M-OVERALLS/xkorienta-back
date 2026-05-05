# 🧪 Tests - QuizLock API

**Agent 3 - Expert TDD**

Ce dossier contient tous les tests pour le backend QuizLock API, suivant la méthodologie TDD (Test-Driven Development).

---

## 📋 Structure des Tests

```
__tests__/
├── integration/           # Tests d'intégration (endpoints API)
│   ├── auth/
│   │   └── register-with-unverified-school.test.ts
│   ├── schools/
│   │   └── search-schools.test.ts
│   └── exams/
│       └── public-exams.test.ts
│
├── unit/                  # Tests unitaires (services, utils)
│   └── services/
│       ├── UnverifiedSchoolService.test.ts
│       └── SchoolSearchService.test.ts
│
└── README.md
```

---

## 🚀 Installation

### Dépendances requises

```bash
npm install --save-dev \
  jest \
  @jest/globals \
  @types/jest \
  ts-jest \
  supertest \
  @types/supertest \
  mongodb-memory-server
```

### Configuration

Les fichiers de configuration sont déjà créés :
- `jest.config.ts` - Configuration principale
- `jest.setup.ts` - Setup global des tests

---

## 🏃 Exécution des Tests

### Tous les tests
```bash
npm test
```

### Tests en mode watch (développement)
```bash
npm test -- --watch
```

### Tests d'intégration uniquement
```bash
npm test -- __tests__/integration
```

### Tests unitaires uniquement
```bash
npm test -- __tests__/unit
```

### Tests avec couverture
```bash
npm test -- --coverage
```

### Un fichier spécifique
```bash
npm test -- register-with-unverified-school
```

---

## 📊 Couverture de Code

### Objectifs de couverture

Selon **CLAUDE.md - Agent 3** :
- **Minimum requis** : 80% de couverture de branches
- **Objectif** : ≥85% de couverture globale

### Générer un rapport de couverture
```bash
npm test -- --coverage --coverageReporters=html
```

Le rapport sera disponible dans `coverage/index.html`

---

## 📝 Convention de Nommage

### Structure des tests

```typescript
describe('[FeatureName]', () => {
  describe('[methodName]', () => {
    it('should [comportement attendu] when [condition]', async () => {
      // Arrange - Préparation
      const data = { ... };

      // Act - Exécution
      const result = await service.method(data);

      // Assert - Vérification
      expect(result).toBe(expected);
    });

    it('should throw [erreur] when [condition invalide]', async () => {
      // ...
    });
  });
});
```

### Catégories de tests

1. **Use Cases** - Tests des cas d'usage nominaux
2. **Cas Limites** - Valeurs extrêmes, vides, nulles
3. **Erreurs** - Gestion des erreurs (400, 401, 403, 404, 409, 500)
4. **Performance** - Temps de réponse < seuils définis
5. **Sécurité** - Injections, XSS, sanitization

---

## 🗄️ Base de Données de Test

### MongoDB In-Memory

Les tests utilisent `mongodb-memory-server` pour créer une base de données temporaire :

```typescript
beforeAll(async () => {
  await mongoose.connect(process.env.TEST_DATABASE_URL);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  // Nettoyer les collections
  await User.deleteMany({});
});
```

### Variables d'environnement

Créer un fichier `.env.test` :

```env
TEST_DATABASE_URL=mongodb://localhost:27017/quizlock-test
TEST_API_URL=http://localhost:3001
NODE_ENV=test
```

---

## 🔍 Debugging des Tests

### Mode verbose
```bash
npm test -- --verbose
```

### Isoler un test
```typescript
it.only('should run only this test', () => {
  // ...
});
```

### Ignorer un test temporairement
```typescript
it.skip('should skip this test', () => {
  // ...
});
```

### Logs de debug
```typescript
console.log('Debug:', JSON.stringify(data, null, 2));
```

---

## ✅ Checklist Avant Commit

Avant de committer du code, vérifier :

- [ ] Tous les tests passent : `npm test`
- [ ] Couverture ≥ 80% : `npm test -- --coverage`
- [ ] Pas de tests ignorés (`skip` ou `only`)
- [ ] Pas de `console.log` de debug restants
- [ ] Tests de sécurité présents (injection, XSS)
- [ ] Tests de performance présents

---

## 📚 Ressources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)

### Standards du Projet
- **CLAUDE.md** - Règles de développement
- **Agent 3 - Expert TDD** - Standards TDD

---

## 🐛 Problèmes Courants

### MongoDB ne démarre pas
```bash
# Vérifier que MongoDB est installé
mongod --version

# Ou utiliser Docker
docker run -d -p 27017:27017 mongo
```

### Timeout des tests
```typescript
// Augmenter le timeout pour un test spécifique
it('should handle slow operation', async () => {
  // ...
}, 30000); // 30 secondes
```

### Erreur "Cannot find module"
```bash
# Vérifier les path aliases
npm run build

# Nettoyer le cache Jest
npm test -- --clearCache
```

---

## 📞 Support

Pour toute question sur les tests :
1. Consulter **CLAUDE.md - Agent 3**
2. Vérifier les exemples dans `__tests__/integration/`
3. Lire la documentation Jest

---

**Rappel** : Ces tests doivent être écrits **AVANT** l'implémentation (TDD) !
