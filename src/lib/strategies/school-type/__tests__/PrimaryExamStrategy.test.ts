import { PrimaryExamStrategy } from '../PrimaryExamStrategy'
import { SchoolType } from '@/models/School'
import { EvaluationType } from '@/models/enums'

describe('PrimaryExamStrategy', () => {
    let strategy: PrimaryExamStrategy

    beforeEach(() => {
        strategy = new PrimaryExamStrategy()
    })

    describe('Basic Properties', () => {
        it('should have correct school type', () => {
            expect(strategy.schoolType).toBe(SchoolType.PRIMARY)
        })

        it('should have correct level name', () => {
            expect(strategy.levelName).toBe('École Primaire')
        })
    })

    describe('getDefaultConfig', () => {
        it('should return correct default configuration', () => {
            const config = strategy.getDefaultConfig()

            expect(config.defaultDuration).toBe(30)
            expect(config.minDuration).toBe(15)
            expect(config.maxDuration).toBe(60)
            expect(config.passingScore).toBe(50)
            expect(config.recommendedQuestionCount).toBe(12)
            expect(config.minQuestions).toBe(5)
            expect(config.maxQuestions).toBe(25)
            expect(config.shuffleByDefault).toBe(true)
            expect(config.showResultsImmediately).toBe(true)
            expect(config.allowReview).toBe(true)
        })

        it('should allow only QCM, OPEN_QUESTION, and EXAM_SIMULATION', () => {
            const config = strategy.getDefaultConfig()

            expect(config.allowedEvaluationTypes).toContain(EvaluationType.QCM)
            expect(config.allowedEvaluationTypes).toContain(EvaluationType.OPEN_QUESTION)
            expect(config.allowedEvaluationTypes).toContain(EvaluationType.EXAM_SIMULATION)
            expect(config.allowedEvaluationTypes).not.toContain(EvaluationType.ADAPTIVE)
        })
    })

    describe('getValidationConstraints', () => {
        it('should return correct constraints', () => {
            const constraints = strategy.getValidationConstraints()

            expect(constraints.minAnswersPerQCM).toBe(2)
            expect(constraints.maxAnswersPerQCM).toBe(4)
            expect(constraints.minOpenQuestionLength).toBe(10)
            expect(constraints.maxOpenQuestionLength).toBe(500)
            expect(constraints.allowAdaptiveExams).toBe(false)
            expect(constraints.maxSingleSubjectPercentage).toBe(100)
        })
    })

    describe('getTerminology', () => {
        it('should return correct terminology for primary school', () => {
            const terminology = strategy.getTerminology()

            expect(terminology.examLabel).toBe('Contrôle')
            expect(terminology.studentLabel).toBe('Élève')
            expect(terminology.teacherLabel).toBe('Maître / Maîtresse')
            expect(terminology.gradingScale).toBe('sur 10')
        })
    })

    describe('getFeatureAvailability', () => {
        it('should disable advanced features for primary', () => {
            const features = strategy.getFeatureAvailability()

            expect(features.certification).toBe(false)
            expect(features.plagiarismDetection).toBe(false)
            expect(features.proctoredSessions).toBe(false)
            expect(features.advancedStats).toBe(false)
            expect(features.resultsExport).toBe(false)
        })

        it('should enable basic features', () => {
            const features = strategy.getFeatureAvailability()

            expect(features.qrCodeAccess).toBe(true)
            expect(features.preExamReview).toBe(true)
            expect(features.conceptAnalysis).toBe(true)
            expect(features.classComparison).toBe(true)
        })
    })

    describe('validateExam', () => {
        it('should accept valid exam configuration', () => {
            const result = strategy.validateExam({
                duration: 30,
                questionCount: 12,
                evaluationType: EvaluationType.QCM,
                passingScore: 50,
                targetLevelIds: ['cp1', 'ce1']
            })

            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should reject adaptive exams', () => {
            const result = strategy.validateExam({
                duration: 30,
                questionCount: 12,
                evaluationType: EvaluationType.ADAPTIVE,
                passingScore: 50,
                targetLevelIds: ['cp1']
            })

            expect(result.isValid).toBe(false)
            expect(result.errors).toContain('Les examens adaptatifs ne sont pas disponibles pour le primaire. Utilisez un QCM ou une évaluation classique.')
        })

        it('should reject duration < 15 minutes', () => {
            const result = strategy.validateExam({
                duration: 10,
                questionCount: 12,
                evaluationType: EvaluationType.QCM,
                passingScore: 50,
                targetLevelIds: ['cp1']
            })

            expect(result.isValid).toBe(false)
            expect(result.errors.some(e => e.includes('durée minimale'))).toBe(true)
        })

        it('should warn for duration > 60 minutes', () => {
            const result = strategy.validateExam({
                duration: 90,
                questionCount: 12,
                evaluationType: EvaluationType.QCM,
                passingScore: 50,
                targetLevelIds: ['cp1']
            })

            expect(result.isValid).toBe(true)
            expect(result.warnings.some(w => w.includes('durée de 90 minutes'))).toBe(true)
        })

        it('should reject questionCount < 5', () => {
            const result = strategy.validateExam({
                duration: 30,
                questionCount: 3,
                evaluationType: EvaluationType.QCM,
                passingScore: 50,
                targetLevelIds: ['cp1']
            })

            expect(result.isValid).toBe(false)
            expect(result.errors.some(e => e.includes('au moins 5 questions'))).toBe(true)
        })

        it('should warn for questionCount > 25', () => {
            const result = strategy.validateExam({
                duration: 30,
                questionCount: 35,
                evaluationType: EvaluationType.QCM,
                passingScore: 50,
                targetLevelIds: ['cp1']
            })

            expect(result.isValid).toBe(true)
            expect(result.warnings.some(w => w.includes('35 questions'))).toBe(true)
        })

        it('should reject empty targetLevelIds', () => {
            const result = strategy.validateExam({
                duration: 30,
                questionCount: 12,
                evaluationType: EvaluationType.QCM,
                passingScore: 50,
                targetLevelIds: []
            })

            expect(result.isValid).toBe(false)
            expect(result.errors.some(e => e.includes('au moins un niveau'))).toBe(true)
        })
    })

    describe('calculateRecommendedDifficulty', () => {
        it('should return base difficulty of 40', () => {
            const difficulty = strategy.calculateRecommendedDifficulty([], 0)

            expect(difficulty).toBe(40)
        })

        it('should increase difficulty with concept count', () => {
            const difficulty1 = strategy.calculateRecommendedDifficulty([], 5)
            const difficulty2 = strategy.calculateRecommendedDifficulty([], 10)

            expect(difficulty1).toBeGreaterThan(40)
            expect(difficulty2).toBeGreaterThan(difficulty1)
        })

        it('should cap difficulty at 70 for primary', () => {
            const difficulty = strategy.calculateRecommendedDifficulty(['cp1', 'ce1', 'ce2'], 20)

            expect(difficulty).toBeLessThanOrEqual(70)
        })

        it('should increase difficulty for multi-level exams', () => {
            const difficultyOne = strategy.calculateRecommendedDifficulty(['cp1'], 5)
            const difficultyMulti = strategy.calculateRecommendedDifficulty(['cp1', 'ce1', 'ce2'], 5)

            expect(difficultyMulti).toBeGreaterThan(difficultyOne)
        })
    })

    describe('getConfigSuggestions', () => {
        it('should suggest correct config for QCM', () => {
            const suggestions = strategy.getConfigSuggestions(EvaluationType.QCM)

            expect(suggestions.duration).toBe(25)
            expect(suggestions.questionCount).toBe(15)
            expect(suggestions.passingScore).toBe(50)
            expect(suggestions.rationale).toContain('QCM')
        })

        it('should suggest correct config for OPEN_QUESTION', () => {
            const suggestions = strategy.getConfigSuggestions(EvaluationType.OPEN_QUESTION)

            expect(suggestions.duration).toBe(40)
            expect(suggestions.questionCount).toBe(8)
            expect(suggestions.rationale).toContain('Questions ouvertes')
        })

        it('should suggest correct config for EXAM_SIMULATION', () => {
            const suggestions = strategy.getConfigSuggestions(EvaluationType.EXAM_SIMULATION)

            expect(suggestions.duration).toBe(50)
            expect(suggestions.questionCount).toBe(20)
            expect(suggestions.passingScore).toBe(55)
        })
    })
})
