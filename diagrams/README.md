# Diagrammes PlantUML - Quizlock API

Ce dossier contient les diagrammes de classe PlantUML découpés en modules pour faciliter la visualisation et l'export.

## Structure des fichiers

### Design Patterns

1. **01-patterns-strategy.puml** - Pattern Strategy
   - Evaluation Strategies (QCM, TrueFalse, Adaptive, etc.)
   - Authentication Strategies (Credentials, Google, GitHub)
   - AuthStrategyManager (Singleton)

2. **02-patterns-decorator.puml** - Pattern Decorator
   - ExamDecorator et ses implémentations
   - TimeBonusDecorator, StreakBonusDecorator, BadgeDecorator, etc.

3. **03-patterns-chain-of-responsibility.puml** - Pattern Chain of Responsibility
   - AccessHandler et ses handlers (Global, Local, Subject, Level, Field)
   - AccessHandlerChain (Factory + Singleton)

4. **04-patterns-builder.puml** - Pattern Builder
   - SyllabusBuilder pour construire des structures de cours complexes

5. **05-patterns-composite.puml** - Pattern Composite
   - EducationalComponent (hiérarchie éducative)
   - EducationLevel → Field → Subject → LearningUnit

6. **06-patterns-observer.puml** - Pattern Observer
   - EventPublisher (Singleton)
   - Observers (Email, XP, Notification, Stats, Badge)

### Events & Factories

7. **07-events.puml** - Système d'événements
   - EventType enum
   - Event interface et implémentations

8. **08-factories.puml** - Factory Patterns
   - ProfileFactory & ProfileFactoryV2
   - EvaluationStrategyFactory
   - ExamDecoratorFactory
   - AccessHandlerChain
   - EducationalComponentFactory
   - AuthStrategyManager

### Modèles de domaine

9. **09-models-user.puml** - Modèles utilisateur
   - User, LearnerProfile, PedagogicalProfile

10. **10-models-exam-system.puml** - Système d'examen
    - Exam, Question, Option, Attempt, Response

11. **11-models-academic-structure.puml** - Structure académique
    - School, Syllabus, Subject, LearningUnit, EducationLevel, Field, Class, Concept

## Utilisation

### Sur PlantUML Online

Visitez https://www.plantuml.com/plantuml/uml/ et copiez-collez le contenu d'un fichier .puml.

### Avec l'extension VS Code

1. Installer l'extension "PlantUML" par jebbs
2. Ouvrir un fichier .puml
3. Appuyer sur `Alt+D` (ou `Cmd+D` sur Mac) pour prévisualiser
4. Clic droit → "Export Current Diagram" pour exporter en PNG/SVG/PDF

### Avec PlantUML CLI (une fois installé)

```bash
# Générer un PNG
plantuml -tpng 01-patterns-strategy.puml

# Générer un PDF
plantuml -tpdf 01-patterns-strategy.puml

# Générer tous les diagrammes en PNG
plantuml -tpng diagrams/*.puml

# Générer tous les diagrammes en PDF
plantuml -tpdf diagrams/*.puml
```

## Fichier original

Le diagramme complet original se trouve dans :
```
../architecture-class-diagram.puml
```

Ce fichier contient TOUS les éléments mais est trop volumineux pour PlantUML Online.

## Légende des couleurs

- 🟢 **Vert** (#E8F5E9) : Design Patterns
- 🔵 **Bleu** (#E3F2FD) : Modèles de domaine
- 🟡 **Jaune** (#FFF9C4) : Factories
- 🟣 **Rose** (#FCE4EC) : Observer Pattern
- 🟪 **Violet** (#F3E5F5) : Events

## Design Patterns utilisés

L'architecture utilise 7 design patterns :

1. **Strategy** - Pour les évaluations et l'authentification
2. **Decorator** - Pour enrichir les résultats d'examen
3. **Chain of Responsibility** - Pour le contrôle d'accès
4. **Builder** - Pour construire des syllabus complexes
5. **Composite** - Pour la hiérarchie éducative
6. **Observer** - Pour la gestion d'événements
7. **Factory** - Pour la création d'objets complexes

## Localisation du code

- `src/lib/patterns/` - Patterns (Strategy, Decorator, Chain, Builder, Composite)
- `src/lib/events/` - Observer Pattern et Events
- `src/lib/factories/` - Factories
- `src/lib/auth/strategies/` - Authentication Strategies
- `src/models/` - Modèles de domaine
