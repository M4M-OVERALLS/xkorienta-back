require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.DATABASE_URL;

const miniTestsData = [
    {
        title: "Flash Test - Mathématiques Terminale",
        description: "Testez vos connaissances en analyse et probabilités",
        subject: "Mathématiques",
        learningUnit: "Analyse - Fonctions",
        difficulty: "INTERMEDIATE",
        duration: 2,
        isPublicDemo: true,
        isPublished: true,
        maxAttempts: 999,
        questions: [
            {
                text: "Quelle est la dérivée de f(x) = x³ + 2x² - 5x + 1 ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 1,
                tags: ["dérivation", "calcul", "analyse"],
                options: [
                    { text: "3x² + 4x - 5", isCorrect: true },
                    { text: "3x² + 2x - 5", isCorrect: false },
                    { text: "x² + 4x - 5", isCorrect: false },
                    { text: "3x² + 4x + 5", isCorrect: false }
                ]
            },
            {
                text: "Calculez la limite: lim(x→0) (sin(x)/x)",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 2,
                tags: ["limites", "raisonnement", "analyse"],
                options: [
                    { text: "1", isCorrect: true },
                    { text: "0", isCorrect: false },
                    { text: "∞", isCorrect: false },
                    { text: "La limite n'existe pas", isCorrect: false }
                ]
            },
            {
                text: "Quelle est la primitive de f(x) = 2x ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "BEGINNER",
                order: 3,
                tags: ["intégration", "calcul", "analyse"],
                options: [
                    { text: "x² + C", isCorrect: true },
                    { text: "2x² + C", isCorrect: false },
                    { text: "x²/2 + C", isCorrect: false },
                    { text: "2", isCorrect: false }
                ]
            },
            {
                text: "Dans un repère orthonormé, quelle est l'équation d'une droite passant par A(1,2) et de coefficient directeur 3 ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 4,
                tags: ["géométrie", "raisonnement", "algèbre"],
                options: [
                    { text: "y = 3x - 1", isCorrect: true },
                    { text: "y = 3x + 2", isCorrect: false },
                    { text: "y = 3x + 1", isCorrect: false },
                    { text: "y = x + 3", isCorrect: false }
                ]
            },
            {
                text: "Quelle est la probabilité d'obtenir un nombre pair en lançant un dé équilibré à 6 faces ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "BEGINNER",
                order: 5,
                tags: ["probabilités", "logique", "calcul"],
                options: [
                    { text: "1/2", isCorrect: true },
                    { text: "1/3", isCorrect: false },
                    { text: "2/3", isCorrect: false },
                    { text: "1/6", isCorrect: false }
                ]
            }
        ]
    },
    {
        title: "Flash Test - Physique-Chimie",
        description: "Mécanique et électricité - Niveau Première",
        subject: "Physique-Chimie",
        learningUnit: "Mécanique",
        difficulty: "INTERMEDIATE",
        duration: 2,
        isPublicDemo: true,
        isPublished: true,
        maxAttempts: 999,
        questions: [
            {
                text: "Quelle est l'unité de la force dans le système international ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "BEGINNER",
                order: 1,
                tags: ["connaissances", "unités", "mécanique"],
                options: [
                    { text: "Newton (N)", isCorrect: true },
                    { text: "Joule (J)", isCorrect: false },
                    { text: "Watt (W)", isCorrect: false },
                    { text: "Pascal (Pa)", isCorrect: false }
                ]
            },
            {
                text: "Quelle est la formule de l'énergie cinétique ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 2,
                tags: ["formules", "énergie", "mécanique"],
                options: [
                    { text: "Ec = 1/2 × m × v²", isCorrect: true },
                    { text: "Ec = m × v", isCorrect: false },
                    { text: "Ec = m × g × h", isCorrect: false },
                    { text: "Ec = F × d", isCorrect: false }
                ]
            },
            {
                text: "Selon la loi d'Ohm, quelle relation lie tension (U), résistance (R) et intensité (I) ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 3,
                tags: ["électricité", "lois", "raisonnement"],
                options: [
                    { text: "U = R × I", isCorrect: true },
                    { text: "U = I / R", isCorrect: false },
                    { text: "U = R + I", isCorrect: false },
                    { text: "U = R - I", isCorrect: false }
                ]
            },
            {
                text: "Quelle est la vitesse de la lumière dans le vide (approximativement) ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "BEGINNER",
                order: 4,
                tags: ["connaissances", "optique", "constantes"],
                options: [
                    { text: "300 000 km/s", isCorrect: true },
                    { text: "30 000 km/s", isCorrect: false },
                    { text: "3 000 km/s", isCorrect: false },
                    { text: "3 000 000 km/s", isCorrect: false }
                ]
            },
            {
                text: "Dans un circuit en série, comment varie l'intensité du courant ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 5,
                tags: ["électricité", "circuits", "raisonnement"],
                options: [
                    { text: "Elle est la même en tout point", isCorrect: true },
                    { text: "Elle diminue progressivement", isCorrect: false },
                    { text: "Elle augmente progressivement", isCorrect: false },
                    { text: "Elle varie aléatoirement", isCorrect: false }
                ]
            }
        ]
    },
    {
        title: "Flash Test - Philosophie",
        description: "Conscience et inconscient - Terminale",
        subject: "Philosophie",
        learningUnit: "La conscience",
        difficulty: "ADVANCED",
        duration: 2,
        isPublicDemo: true,
        isPublished: true,
        maxAttempts: 999,
        questions: [
            {
                text: "Selon Descartes, quelle est la première certitude indubitable ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 1,
                tags: ["rationalisme", "argumentation", "concepts"],
                options: [
                    { text: "Je pense, donc je suis", isCorrect: true },
                    { text: "Dieu existe", isCorrect: false },
                    { text: "Le monde extérieur existe", isCorrect: false },
                    { text: "Les mathématiques sont vraies", isCorrect: false }
                ]
            },
            {
                text: "Qui a développé la théorie de l'inconscient psychanalytique ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "BEGINNER",
                order: 2,
                tags: ["connaissances", "auteurs", "psychanalyse"],
                options: [
                    { text: "Sigmund Freud", isCorrect: true },
                    { text: "René Descartes", isCorrect: false },
                    { text: "Jean-Paul Sartre", isCorrect: false },
                    { text: "Emmanuel Kant", isCorrect: false }
                ]
            },
            {
                text: "Selon Sartre, l'homme est-il libre ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "ADVANCED",
                order: 3,
                tags: ["existentialisme", "réflexion", "liberté"],
                options: [
                    { text: "Oui, il est 'condamné à être libre'", isCorrect: true },
                    { text: "Non, il est déterminé par son inconscient", isCorrect: false },
                    { text: "Partiellement, selon les circonstances", isCorrect: false },
                    { text: "La question n'a pas de sens", isCorrect: false }
                ]
            },
            {
                text: "Quelle est la devise des Lumières selon Kant ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 4,
                tags: ["connaissances", "histoire", "philosophie"],
                options: [
                    { text: "Sapere aude (Ose savoir)", isCorrect: true },
                    { text: "Cogito ergo sum", isCorrect: false },
                    { text: "Carpe diem", isCorrect: false },
                    { text: "Memento mori", isCorrect: false }
                ]
            },
            {
                text: "Qu'est-ce que le 'malin génie' chez Descartes ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "ADVANCED",
                order: 5,
                tags: ["méthode", "doute", "argumentation"],
                options: [
                    { text: "Une hypothèse méthodologique pour douter de tout", isCorrect: true },
                    { text: "Une preuve de l'existence de Dieu", isCorrect: false },
                    { text: "Une critique de la science", isCorrect: false },
                    { text: "Une théorie sur le mal", isCorrect: false }
                ]
            }
        ]
    },
    {
        title: "Flash Test - Français",
        description: "Figures de style et analyse littéraire",
        subject: "Français",
        learningUnit: "Figures de style",
        difficulty: "INTERMEDIATE",
        duration: 2,
        isPublicDemo: true,
        isPublished: true,
        maxAttempts: 999,
        questions: [
            {
                text: "Quelle figure de style est utilisée dans 'Ses yeux sont des étoiles' ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "BEGINNER",
                order: 1,
                tags: ["figures-de-style", "analyse", "poésie"],
                options: [
                    { text: "Métaphore", isCorrect: true },
                    { text: "Comparaison", isCorrect: false },
                    { text: "Personnification", isCorrect: false },
                    { text: "Hyperbole", isCorrect: false }
                ]
            },
            {
                text: "Qu'est-ce qu'une anaphore ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 2,
                tags: ["figures-de-style", "connaissances", "rhétorique"],
                options: [
                    { text: "La répétition d'un mot en début de phrase", isCorrect: true },
                    { text: "Une exagération", isCorrect: false },
                    { text: "Une opposition", isCorrect: false },
                    { text: "Une atténuation", isCorrect: false }
                ]
            },
            {
                text: "Dans 'Je meurs de faim', quelle figure de style est employée ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "BEGINNER",
                order: 3,
                tags: ["figures-de-style", "analyse", "expression"],
                options: [
                    { text: "Hyperbole", isCorrect: true },
                    { text: "Litote", isCorrect: false },
                    { text: "Euphémisme", isCorrect: false },
                    { text: "Ironie", isCorrect: false }
                ]
            },
            {
                text: "Quel mouvement littéraire est associé à Victor Hugo ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 4,
                tags: ["littérature", "histoire", "auteurs"],
                options: [
                    { text: "Le Romantisme", isCorrect: true },
                    { text: "Le Réalisme", isCorrect: false },
                    { text: "Le Surréalisme", isCorrect: false },
                    { text: "Le Classicisme", isCorrect: false }
                ]
            },
            {
                text: "Qu'est-ce qu'un alexandrin ?",
                type: "MULTIPLE_CHOICE",
                points: 1,
                difficulty: "INTERMEDIATE",
                order: 5,
                tags: ["versification", "connaissances", "poésie"],
                options: [
                    { text: "Un vers de 12 syllabes", isCorrect: true },
                    { text: "Un vers de 10 syllabes", isCorrect: false },
                    { text: "Un vers de 8 syllabes", isCorrect: false },
                    { text: "Un vers libre", isCorrect: false }
                ]
            }
        ]
    }
];

async function seedMiniTests() {
    try {
        await mongoose.connect(MONGODB_URI);

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const Exam = mongoose.model('Exam', new mongoose.Schema({}, { strict: false }));
        const Question = mongoose.model('Question', new mongoose.Schema({}, { strict: false }));
        const Option = mongoose.model('Option', new mongoose.Schema({}, { strict: false }));
        const Subject = mongoose.model('Subject', new mongoose.Schema({}, { strict: false }));
        const LearningUnit = mongoose.model('LearningUnit', new mongoose.Schema({}, { strict: false }));

        // Trouver un enseignant pour associer les exams
        let teacher = await User.findOne({ role: 'TEACHER' });
        
        if (!teacher) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('Demo2024!', 10);
            
            teacher = await User.create({
                name: 'Prof Démo',
                email: 'prof.demo@xkorienta.cm',
                password: hashedPassword,
                role: 'TEACHER',
                isVerified: true,
                subsystem: 'FRANCOPHONE'
            });
        }

        // Helper function pour créer/récupérer un Subject
        async function getOrCreateSubject(subjectName) {
            let subject = await Subject.findOne({ name: subjectName });
            if (!subject) {
                // Générer un code unique basé sur le nom
                const code = subjectName
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '_')
                    .substring(0, 10);
                
                subject = await Subject.create({
                    name: subjectName,
                    code: code,
                    description: `Matière ${subjectName}`,
                    createdBy: teacher._id
                });
            }
            return subject;
        }

        // Helper function pour créer/récupérer un LearningUnit
        async function getOrCreateLearningUnit(unitTitle, subjectId) {
            let unit = await LearningUnit.findOne({ title: unitTitle, subject: subjectId });
            if (!unit) {
                unit = await LearningUnit.create({
                    title: unitTitle,
                    description: `Unité d'enseignement: ${unitTitle}`,
                    subject: subjectId,
                    order: 1,
                    createdBy: teacher._id
                });
            }
            return unit;
        }

        // Supprimer les anciens mini-tests de démo
        const deletedExams = await Exam.deleteMany({ isPublicDemo: true });

        // Créer les nouveaux mini-tests
        for (const miniTestData of miniTestsData) {

            // Créer/récupérer Subject et LearningUnit
            const subject = await getOrCreateSubject(miniTestData.subject);
            const learningUnit = miniTestData.learningUnit 
                ? await getOrCreateLearningUnit(miniTestData.learningUnit, subject._id)
                : null;

            // Créer d'abord l'exam (sans questions)
            const exam = await Exam.create({
                title: miniTestData.title,
                description: miniTestData.description,
                subject: subject._id,
                learningUnit: learningUnit?._id,
                difficultyLevel: miniTestData.difficulty,
                duration: miniTestData.duration,
                isPublicDemo: miniTestData.isPublicDemo,
                isPublished: miniTestData.isPublished,
                isActive: true,
                status: 'PUBLISHED',
                maxAttempts: miniTestData.maxAttempts,
                questions: [], // Sera rempli après
                createdBy: teacher._id,
                totalPoints: miniTestData.questions.reduce((sum, q) => sum + q.points, 0),
                subSystem: 'FRANCOPHONE',
                targetLevels: [],
                pedagogicalObjective: 'FORMATIVE_ASSESSMENT',
                evaluationType: 'QUIZ',
                learningMode: 'SELF_PACED',
                closeMode: 'MANUAL',
                startTime: new Date(),
                endTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an
                config: {
                    shuffleQuestions: true,
                    shuffleOptions: true,
                    showResults: true,
                    allowReview: true
                }
            });

            // Maintenant créer les questions avec l'examId et leurs options
            const createdQuestions = [];
            for (const questionData of miniTestData.questions) {
                // Extraire les options avant de créer la question
                const { options, ...questionFields } = questionData;
                
                // Créer la question
                const question = await Question.create({
                    ...questionFields,
                    examId: exam._id,
                    createdBy: teacher._id
                });
                
                // Créer les options pour cette question
                if (options && options.length > 0) {
                    for (let i = 0; i < options.length; i++) {
                        await Option.create({
                            questionId: question._id,
                            text: options[i].text,
                            isCorrect: options[i].isCorrect,
                            order: i,
                            stats: {
                                timesSelected: 0,
                                selectionRate: 0
                            }
                        });
                    }
                }
                
                createdQuestions.push(question._id);
            }

            // Mettre à jour l'exam avec les IDs des questions
            exam.questions = createdQuestions;
            await exam.save();
        }

    } catch (error) {
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

seedMiniTests();
