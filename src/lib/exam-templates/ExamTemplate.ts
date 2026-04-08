import {
    ExamType,
    EvaluationType,
    PedagogicalObjective,
    LearningMode,
    DifficultyLevel,
    CloseMode,
    SelfAssessmentLevel
} from '@/models/enums'
import { ExamConfig, SelfAssessmentConfig } from '@/models/Exam'

/**
 * Interface pour un template d'examen
 * Définit la configuration par défaut pour chaque type d'examen
 */
export interface ExamTemplate {
    id: string
    examType: ExamType
    name: string
    description: string
    category: 'DIAGNOSTIC' | 'FORMATIVE' | 'SUMMATIVE' | 'SPECIAL' | 'COMPETITION' | 'ADAPTIVE'

    // Configuration par défaut
    defaultConfig: Partial<{
        evaluationType: EvaluationType
        pedagogicalObjective: PedagogicalObjective
        learningMode: LearningMode
        difficultyLevel: DifficultyLevel
        graded: boolean
        weightInFinalGrade: number

        // Config exam
        shuffleQuestions: boolean
        shuffleOptions: boolean
        showResultsImmediately: boolean
        allowReview: boolean
        passingScore: number
        maxAttempts: number
        timeBetweenAttempts: number
        enableImmediateFeedback: boolean

        // Anti-triche
        antiCheat: {
            fullscreenRequired: boolean
            disableCopyPaste: boolean
            trackTabSwitches: boolean
            webcamRequired: boolean
            maxTabSwitches: number
            preventScreenshot: boolean
            blockRightClick: boolean
        }

        // Temporel
        closeMode: CloseMode
        suggestedDuration: number // Durée suggérée en minutes

        // Auto-évaluation
        selfAssessmentConfig?: SelfAssessmentConfig
    }>

    // Recommandations
    recommendations: {
        minQuestions?: number
        maxQuestions?: number
        idealChapterCount?: number // Nombre idéal de chapitres
        suggestedWeight?: number // Poids suggéré dans la note finale
    }
}

/**
 * Configuration de l'auto-évaluation par défaut (7 niveaux)
 */
const DEFAULT_SELF_ASSESSMENT_CONFIG: SelfAssessmentConfig = {
    enabled: true,
    scale: {
        min: 0,
        max: 6
    },
    levels: [
        { value: 0, emoji: '❓', label: 'Je ne sais pas' },
        { value: 1, emoji: '😵', label: 'Totalement incapable' },
        { value: 2, emoji: '😰', label: 'Incapable même avec aide' },
        { value: 3, emoji: '🤔', label: 'Incapable sans aide' },
        { value: 4, emoji: '🙂', label: 'Capable avec aide' },
        { value: 5, emoji: '😊', label: 'Capable sans aide' },
        { value: 6, emoji: '🌟', label: 'Parfaitement capable' }
    ],
    requireAllConcepts: true
}

/**
 * Tous les templates d'examens
 * Organisés par catégorie pédagogique
 */
export const EXAM_TEMPLATES: ExamTemplate[] = [
    // ========== ÉVALUATIONS DIAGNOSTIQUES ==========
    {
        id: 'diagnostic-test',
        examType: ExamType.DIAGNOSTIC_TEST,
        name: 'Test de positionnement',
        description: 'Évaluer le niveau initial des élèves avant de commencer un nouveau chapitre',
        category: 'DIAGNOSTIC',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.DIAGNOSTIC_EVAL,
            learningMode: LearningMode.AUTO_EVAL,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: false,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: true,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 20
        },
        recommendations: {
            minQuestions: 10,
            maxQuestions: 20,
            idealChapterCount: 1
        }
    },

    {
        id: 'pre-test',
        examType: ExamType.PRE_TEST,
        name: 'Pré-test',
        description: 'Test rapide avant un chapitre pour identifier les prérequis',
        category: 'DIAGNOSTIC',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.DIAGNOSTIC_EVAL,
            learningMode: LearningMode.AUTO_EVAL,
            difficultyLevel: DifficultyLevel.BEGINNER,
            graded: false,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: true,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 10
        },
        recommendations: {
            minQuestions: 5,
            maxQuestions: 10,
            idealChapterCount: 1
        }
    },

    // ========== ÉVALUATIONS FORMATIVES ==========
    {
        id: 'self-assessment',
        examType: ExamType.SELF_ASSESSMENT,
        name: 'Auto-évaluation',
        description: 'L\'élève évalue sa maîtrise de chaque concept sur une échelle à 7 niveaux',
        category: 'FORMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.SELF_ASSESSMENT,
            learningMode: LearningMode.AUTO_EVAL,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: false,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 999, // Illimité
            enableImmediateFeedback: true,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 15,
            selfAssessmentConfig: DEFAULT_SELF_ASSESSMENT_CONFIG
        },
        recommendations: {
            idealChapterCount: 1
        }
    },

    {
        id: 'formative-quiz',
        examType: ExamType.FORMATIVE_QUIZ,
        name: 'Quiz formatif',
        description: 'Quiz d\'entraînement avec feedback immédiat pour l\'apprentissage',
        category: 'FORMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.FORMATIVE_EVAL,
            learningMode: LearningMode.AUTO_EVAL,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 3,
            timeBetweenAttempts: 0,
            enableImmediateFeedback: true,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: true,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 15
        },
        recommendations: {
            minQuestions: 10,
            maxQuestions: 15,
            idealChapterCount: 1
        }
    },

    {
        id: 'practice-test',
        examType: ExamType.PRACTICE_TEST,
        name: 'Test d\'entraînement',
        description: 'Test pour s\'entraîner sans impact sur la note finale',
        category: 'FORMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.TRAIN,
            learningMode: LearningMode.AUTO_EVAL,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: false,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 999, // Illimité
            enableImmediateFeedback: true,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 20
        },
        recommendations: {
            minQuestions: 15,
            maxQuestions: 25,
            idealChapterCount: 1
        }
    },

    {
        id: 'homework',
        examType: ExamType.HOMEWORK,
        name: 'Devoir à la maison',
        description: 'Devoir à faire à domicile, sans surveillance stricte',
        category: 'FORMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.MIXED,
            pedagogicalObjective: PedagogicalObjective.FORMATIVE_EVAL,
            learningMode: LearningMode.AUTO_EVAL,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            weightInFinalGrade: 10,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 60
        },
        recommendations: {
            minQuestions: 5,
            maxQuestions: 10,
            idealChapterCount: 1,
            suggestedWeight: 10
        }
    },

    {
        id: 'revision-quiz',
        examType: ExamType.REVISION_QUIZ,
        name: 'Quiz de révision',
        description: 'Quiz rapide pour réviser avant un examen',
        category: 'FORMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.REVISE,
            learningMode: LearningMode.AUTO_EVAL,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: false,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 999, // Illimité
            enableImmediateFeedback: true,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 15
        },
        recommendations: {
            minQuestions: 10,
            maxQuestions: 20,
            idealChapterCount: 2
        }
    },

    // ========== ÉVALUATIONS SOMMATIVES ==========
    {
        id: 'quiz-announced',
        examType: ExamType.QUIZ_ANNOUNCED,
        name: 'Interrogation annoncée',
        description: 'Interrogation courte programmée à l\'avance',
        category: 'SUMMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.SUMMATIVE_EVAL,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            weightInFinalGrade: 5,
            showResultsImmediately: false,
            allowReview: false,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: false,
                maxTabSwitches: 3,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 15
        },
        recommendations: {
            minQuestions: 5,
            maxQuestions: 10,
            idealChapterCount: 1,
            suggestedWeight: 5
        }
    },

    {
        id: 'quiz-surprise',
        examType: ExamType.QUIZ_SURPRISE,
        name: 'Interrogation surprise',
        description: 'Interrogation courte non annoncée',
        category: 'SUMMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.SUMMATIVE_EVAL,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.BEGINNER,
            graded: true,
            weightInFinalGrade: 3,
            showResultsImmediately: false,
            allowReview: false,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: false,
                maxTabSwitches: 3,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 10
        },
        recommendations: {
            minQuestions: 5,
            maxQuestions: 8,
            idealChapterCount: 1,
            suggestedWeight: 3
        }
    },

    {
        id: 'continuous-assessment',
        examType: ExamType.CONTINUOUS_ASSESSMENT,
        name: 'Contrôle continu (CC)',
        description: 'Évaluation continue tout au long du semestre',
        category: 'SUMMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.MIXED,
            pedagogicalObjective: PedagogicalObjective.SUMMATIVE_EVAL,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            weightInFinalGrade: 30,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: false,
                maxTabSwitches: 3,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 60
        },
        recommendations: {
            minQuestions: 15,
            maxQuestions: 25,
            idealChapterCount: 3,
            suggestedWeight: 30
        }
    },

    {
        id: 'supervised-test',
        examType: ExamType.SUPERVISED_TEST,
        name: 'Devoir surveillé (DS)',
        description: 'Test surveillé en classe avec anti-triche activé',
        category: 'SUMMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.MIXED,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            weightInFinalGrade: 20,
            showResultsImmediately: false,
            allowReview: false,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: true,
                maxTabSwitches: 2,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 90
        },
        recommendations: {
            minQuestions: 15,
            maxQuestions: 30,
            idealChapterCount: 2,
            suggestedWeight: 20
        }
    },

    {
        id: 'midterm-exam',
        examType: ExamType.MIDTERM_EXAM,
        name: 'Examen de mi-session / Partiel',
        description: 'Examen intermédiaire couvrant la première moitié du cours',
        category: 'SUMMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.MIXED,
            pedagogicalObjective: PedagogicalObjective.SUMMATIVE_EVAL,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.ADVANCED,
            graded: true,
            weightInFinalGrade: 30,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: true,
                maxTabSwitches: 1,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 120
        },
        recommendations: {
            minQuestions: 20,
            maxQuestions: 40,
            idealChapterCount: 5,
            suggestedWeight: 30
        }
    },

    {
        id: 'final-exam',
        examType: ExamType.FINAL_EXAM,
        name: 'Examen final',
        description: 'Examen final couvrant tout le programme',
        category: 'SUMMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.MIXED,
            pedagogicalObjective: PedagogicalObjective.SUMMATIVE_EVAL,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.ADVANCED,
            graded: true,
            weightInFinalGrade: 50,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: true,
                maxTabSwitches: 0,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 180
        },
        recommendations: {
            minQuestions: 30,
            maxQuestions: 60,
            idealChapterCount: 10,
            suggestedWeight: 50
        }
    },

    {
        id: 'retake-exam',
        examType: ExamType.RETAKE_EXAM,
        name: 'Examen de rattrapage',
        description: 'Examen de rattrapage pour les élèves ayant échoué',
        category: 'SUMMATIVE',
        defaultConfig: {
            evaluationType: EvaluationType.MIXED,
            pedagogicalObjective: PedagogicalObjective.REMEDIATION,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            weightInFinalGrade: 50,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: true,
                maxTabSwitches: 1,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 120
        },
        recommendations: {
            minQuestions: 20,
            maxQuestions: 40,
            idealChapterCount: 10,
            suggestedWeight: 50
        }
    },

    // ========== ÉVALUATIONS SPÉCIALES ==========
    {
        id: 'mock-exam',
        examType: ExamType.MOCK_EXAM,
        name: 'Examen blanc',
        description: 'Simulation d\'examen dans les conditions réelles',
        category: 'SPECIAL',
        defaultConfig: {
            evaluationType: EvaluationType.EXAM_SIMULATION,
            pedagogicalObjective: PedagogicalObjective.PREP_EXAM,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.ADVANCED,
            graded: false,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: true,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: false,
                maxTabSwitches: 2,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 180
        },
        recommendations: {
            minQuestions: 30,
            maxQuestions: 60,
            idealChapterCount: 10
        }
    },

    // 🆕 Nouveaux Templates Universitaires (V4)
    {
        id: 'practical-work',
        examType: ExamType.PRACTICAL_WORK,
        name: 'Travaux Pratiques (TP)',
        description: 'Évaluation de séance de TP avec grille de critères',
        category: 'SPECIAL',
        defaultConfig: {
            evaluationType: EvaluationType.RUBRIC,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            weightInFinalGrade: 15,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 120
        },
        recommendations: {
            minQuestions: 3,
            maxQuestions: 10,
            idealChapterCount: 1,
            suggestedWeight: 15
        }
    },
    {
        id: 'lab-work',
        examType: ExamType.LAB_WORK,
        name: 'Travaux de Laboratoire',
        description: 'Évaluation expérimentale scientifique via grille',
        category: 'SPECIAL',
        defaultConfig: {
            evaluationType: EvaluationType.RUBRIC,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.ADVANCED,
            graded: true,
            weightInFinalGrade: 20,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 180
        },
        recommendations: {
            minQuestions: 5,
            maxQuestions: 15,
            suggestedWeight: 20
        }
    },
    {
        id: 'oral-defense',
        examType: ExamType.ORAL_DEFENSE,
        name: 'Soutenance Principale',
        description: 'Soutenance de mémoire ou projet de fin d\'études',
        category: 'SPECIAL',
        defaultConfig: {
            evaluationType: EvaluationType.RUBRIC,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.EXPERT,
            graded: true,
            weightInFinalGrade: 50,
            showResultsImmediately: true,
            allowReview: false,
            maxAttempts: 1,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 45
        },
        recommendations: {
            minQuestions: 4, // 4 grands critères d'évaluation généralement
            maxQuestions: 8,
            suggestedWeight: 50
        }
    },
    {
        id: 'portfolio',
        examType: ExamType.PORTFOLIO,
        name: 'Dossier / Portfolio',
        description: 'Évaluation différée de travaux artistiques ou techniques',
        category: 'SPECIAL',
        defaultConfig: {
            evaluationType: EvaluationType.RUBRIC,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.EXAM,
            difficultyLevel: DifficultyLevel.ADVANCED,
            graded: true,
            weightInFinalGrade: 25,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            antiCheat: {
                fullscreenRequired: false,
                disableCopyPaste: false,
                trackTabSwitches: false,
                webcamRequired: false,
                maxTabSwitches: 99,
                preventScreenshot: false,
                blockRightClick: false
            },
            closeMode: CloseMode.PERMISSIVE,
            suggestedDuration: 0 // Asynchrone
        },
        recommendations: {
            minQuestions: 5,
            maxQuestions: 12,
            suggestedWeight: 25
        }
    },

    // ========== COMPÉTITIONS ==========
    {
        id: 'class-challenge',
        examType: ExamType.CLASS_CHALLENGE,
        name: 'Challenge inter-classes',
        description: 'Challenge compétitif entre classes avec classement temps réel',
        category: 'COMPETITION',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.CLASS_CHALLENGE,
            difficultyLevel: DifficultyLevel.INTERMEDIATE,
            graded: true,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 1,
            shuffleQuestions: true,
            shuffleOptions: true,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: false,
                maxTabSwitches: 3,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 30
        },
        recommendations: {
            minQuestions: 20,
            maxQuestions: 30,
            idealChapterCount: 3
        }
    },

    {
        id: 'school-competition',
        examType: ExamType.SCHOOL_COMPETITION,
        name: 'Compétition inter-écoles',
        description: 'Compétition entre écoles avec classement global',
        category: 'COMPETITION',
        defaultConfig: {
            evaluationType: EvaluationType.QCM,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.COMPETITION,
            difficultyLevel: DifficultyLevel.ADVANCED,
            graded: true,
            showResultsImmediately: true,
            allowReview: true,
            maxAttempts: 1,
            shuffleQuestions: true,
            shuffleOptions: true,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: true,
                maxTabSwitches: 2,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 45
        },
        recommendations: {
            minQuestions: 25,
            maxQuestions: 40,
            idealChapterCount: 5
        }
    },

    {
        id: 'olympiad',
        examType: ExamType.OLYMPIAD,
        name: 'Olympiade',
        description: 'Compétition de haut niveau de type olympiade',
        category: 'COMPETITION',
        defaultConfig: {
            evaluationType: EvaluationType.CASE_STUDY,
            pedagogicalObjective: PedagogicalObjective.EVALUATE,
            learningMode: LearningMode.COMPETITION,
            difficultyLevel: DifficultyLevel.EXPERT,
            graded: true,
            showResultsImmediately: false,
            allowReview: true,
            maxAttempts: 1,
            shuffleQuestions: false,
            shuffleOptions: false,
            enableImmediateFeedback: false,
            antiCheat: {
                fullscreenRequired: true,
                disableCopyPaste: true,
                trackTabSwitches: true,
                webcamRequired: true,
                maxTabSwitches: 0,
                preventScreenshot: true,
                blockRightClick: true
            },
            closeMode: CloseMode.STRICT,
            suggestedDuration: 240
        },
        recommendations: {
            minQuestions: 10,
            maxQuestions: 20,
            idealChapterCount: 10
        }
    }
]

/**
 * Récupérer un template par ID
 */
export function getTemplateById(templateId: string): ExamTemplate | undefined {
    return EXAM_TEMPLATES.find(t => t.id === templateId)
}

/**
 * Récupérer un template par ExamType
 */
export function getTemplateByExamType(examType: ExamType): ExamTemplate | undefined {
    return EXAM_TEMPLATES.find(t => t.examType === examType)
}

/**
 * Récupérer tous les templates d'une catégorie
 */
export function getTemplatesByCategory(category: ExamTemplate['category']): ExamTemplate[] {
    return EXAM_TEMPLATES.filter(t => t.category === category)
}

/**
 * Récupérer tous les templates
 */
export function getAllTemplates(): ExamTemplate[] {
    return EXAM_TEMPLATES
}
