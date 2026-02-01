export enum SubSystem {
    FRANCOPHONE = 'FRANCOPHONE',
    ANGLOPHONE = 'ANGLOPHONE',
    BILINGUAL = 'BILINGUAL'
}

export enum CloseMode {
    STRICT = 'STRICT',      // Ferme automatiquement à l'heure exacte
    PERMISSIVE = 'PERMISSIVE' // Autorise les soumissions tardives avec code
}

export enum certificationType {
    CERTIFICATE = 'CERTIFICATE',
    DIPLOMA = 'DIPLOMA',
    HONOR = 'HONOR',
    SPECIALIZATION = 'SPECIALIZATION',
    CERTIFICATION = 'CERTIFICATION'
}

export enum DemandStatus {
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

export enum degreeAwardedStatus {
    PRESENTIEL = 'PRESENTIEL',
    HYBRIDE = 'HYBRIDE',
    DISTANCE = 'DISTANCE'
}

export enum ModalityStatus {
    PRESENTIEL = 'PRESENTIEL',
    HYBRIDE = 'HYBRIDE',
    DISTANCE = 'DISTANCE'
}

export enum LanguageStatus {
    FRANCAIS = 'FRANCAIS',
    ANGLAIS = 'ANGLAIS',
    CHINOIS = 'CHINOIS',
    ALLEMAND = 'ALLEMAND',
    ESPAGNOL = 'ESPAGNOL'
}

export enum SpecialtyLevel {
    BTS = 'BTS',
    HND = 'HND',
    LICENCE = 'Licence',
    MASTER = 'Master',
    DOCTORAT = 'Doctorat',
    CERTIFICATE = 'Certificate'
}

export enum SpecialtyMode {
    ONSITE = 'Onsite',
    HYBRID = 'Hybrid',
    ONLINE = 'Online'
}

export enum Cycle {
    COLLEGE = 'COLLEGE',      // 6ème → 3ème
    LYCEE = 'LYCEE',          // 2nde → Tle
    LICENCE = 'LICENCE',      // L1 → L3
    MASTER = 'MASTER'         // M1 → M2
}

export enum FieldCategory {
    COMPETENCE_GROUP = 'COMPETENCE_GROUP',  // Collège
    SERIE = 'SERIE',                        // Lycée
    SPECIALITY = 'SPECIALITY'               // Supérieur
}

export enum SubjectType {
    DISCIPLINE = 'DISCIPLINE',  // Collège/Lycée
    UE = 'UE'                   // Enseignement Supérieur
}

export enum UnitType {
    CHAPTER = 'CHAPTER',
    MODULE = 'MODULE',
    COURSE = 'COURSE'
}

export enum DifficultyLevel {
    BEGINNER = 'BEGINNER',
    INTERMEDIATE = 'INTERMEDIATE',
    ADVANCED = 'ADVANCED',
    EXPERT = 'EXPERT'
}

export enum PedagogicalObjective {
    DIAGNOSTIC_EVAL = 'DIAGNOSTIC_EVAL',           // Évaluation diagnostique
    FORMATIVE_EVAL = 'FORMATIVE_EVAL',             // Évaluation formative
    SUMMATIVE_EVAL = 'SUMMATIVE_EVAL',             // Évaluation sommative
    SELF_ASSESSMENT = 'SELF_ASSESSMENT',           // Auto-évaluation
    COMPETENCY_VALIDATION = 'COMPETENCY_VALIDATION', // Validation de compétence
    REMEDIATION = 'REMEDIATION',                   // Remédiation
    EVALUATE = 'EVALUATE',                         // Évaluer
    REVISE = 'REVISE',                             // Réviser
    TRAIN = 'TRAIN',                               // S'entraîner
    PREP_EXAM = 'PREP_EXAM',                       // Préparer un examen
    CONTINUOUS_VALIDATION = 'CONTINUOUS_VALIDATION' // Validation continue
}

export enum EvaluationType {
    QCM = 'QCM',                    // Questions à choix multiples
    TRUE_FALSE = 'TRUE_FALSE',      // Vrai/Faux
    OPEN_QUESTION = 'OPEN_QUESTION', // Question ouverte
    CASE_STUDY = 'CASE_STUDY',      // Étude de cas
    EXAM_SIMULATION = 'EXAM_SIMULATION', // Simulation d'examen
    ADAPTIVE = 'ADAPTIVE',          // Évaluation adaptative
    MIXED = 'MIXED'                 // Mixte
}

export enum ExamStatus {
    DRAFT = 'DRAFT',                         // Brouillon
    PENDING_VALIDATION = 'PENDING_VALIDATION', // En attente de validation
    VALIDATED = 'VALIDATED',                 // Validé par l'inspecteur
    PUBLISHED = 'PUBLISHED',                 // Publié et accessible
    ARCHIVED = 'ARCHIVED'                    // Archivé
}

export enum CompetencyType {
    DIGITAL = 'DIGITAL',
    ENTREPRENEURIAL = 'ENTREPRENEURIAL',
    SOFT_SKILL = 'SOFT_SKILL',
    PROBLEM_SOLVING = 'PROBLEM_SOLVING',
    LOGIC_REASONING = 'LOGIC_REASONING'
}

export enum UserRole {
    // Apprenants
    STUDENT = 'STUDENT',

    // Pédagogiques
    TEACHER = 'TEACHER',
    SCHOOL_ADMIN = 'SCHOOL_ADMIN',
    INSPECTOR = 'INSPECTOR',
    SURVEILLANT = 'SURVEILLANT',
    PREFET = 'PREFET',
    PRINCIPAL = 'PRINCIPAL',
    DG_ISIMMA = 'DG_ISIMMA',
    RECTOR = 'RECTOR',

    // Technique
    DG_M4M = 'DG_M4M',
    TECH_SUPPORT = 'TECH_SUPPORT'
}

export enum ClassValidationStatus {
    PENDING = 'PENDING',
    VALIDATED = 'VALIDATED',
    REJECTED = 'REJECTED'
}

export enum SchoolStatus {
    PENDING = 'PENDING',
    VALIDATED = 'VALIDATED',
    REJECTED = 'REJECTED'
}

export enum CognitiveProfile {
    VISUAL = 'VISUAL',
    AUDITORY = 'AUDITORY',
    LOGIC_MATH = 'LOGIC_MATH',
    LITERARY = 'LITERARY'
}

export enum LearnerType {
    EXAM_PREP = 'EXAM_PREP',
    REMEDIAL = 'REMEDIAL',
    ADVANCED = 'ADVANCED',
    STRUGGLING = 'STRUGGLING'
}

export enum SubscriptionStatus {
    FREEMIUM = 'FREEMIUM',
    PREMIUM = 'PREMIUM',
    INSTITUTION_PREMIUM = 'INSTITUTION_PREMIUM',
    EDUCATOR_ACCESS = 'EDUCATOR_ACCESS',
    DIRECTION_ACCESS = 'DIRECTION_ACCESS'
}

export enum LearningMode {
    AUTO_EVAL = 'AUTO_EVAL',
    COMPETITION = 'COMPETITION',
    EXAM = 'EXAM',
    CLASS_CHALLENGE = 'CLASS_CHALLENGE'
}

export enum ContributionType {
    CREATOR = 'CREATOR',
    VALIDATOR = 'VALIDATOR',
    CORRECTOR = 'CORRECTOR',
    MANAGER = 'MANAGER',
    SUPERVISOR = 'SUPERVISOR'
}

export enum AccessScope {
    GLOBAL = 'GLOBAL',
    LOCAL = 'LOCAL',
    SUBJECT = 'SUBJECT',
    LEVEL = 'LEVEL',
    FIELD = 'FIELD'
}

export enum ReportingAccess {
    CLASS = 'CLASS',
    FIELD = 'FIELD',
    ESTABLISHMENT = 'ESTABLISHMENT',
    GLOBAL = 'GLOBAL'
}

/**
 * Class Teacher Collaboration System
 * 
 * Allows multiple teachers to collaborate on a class, each with their own
 * subject specialty and configurable permissions.
 */

/**
 * Role of a teacher within a class
 * - OWNER: The main teacher who created the class. Has all permissions.
 * - COLLABORATOR: Can do most things except delete the class or remove the owner.
 * - ASSISTANT: Limited permissions, defined by the ClassTeacherPermission array.
 */
export enum ClassTeacherRole {
    OWNER = 'OWNER',
    COLLABORATOR = 'COLLABORATOR',
    ASSISTANT = 'ASSISTANT'
}

/**
 * Granular permissions for teachers in a class
 * These define what actions a COLLABORATOR or ASSISTANT can perform.
 */
export enum ClassTeacherPermission {
    // Exam Management
    CREATE_EXAM = 'CREATE_EXAM',           // Create exams for the class
    EDIT_EXAM = 'EDIT_EXAM',               // Edit existing exams
    DELETE_EXAM = 'DELETE_EXAM',           // Delete exams
    PUBLISH_EXAM = 'PUBLISH_EXAM',         // Publish exams to students

    // Student Management
    GRADE_STUDENTS = 'GRADE_STUDENTS',     // Grade student submissions
    VIEW_STUDENTS = 'VIEW_STUDENTS',       // View student list and info
    MANAGE_STUDENTS = 'MANAGE_STUDENTS',   // Add/remove students

    // Communication
    CREATE_FORUM = 'CREATE_FORUM',         // Create class forums
    SEND_MESSAGES = 'SEND_MESSAGES',       // Send messages to class

    // Administration
    INVITE_TEACHERS = 'INVITE_TEACHERS',   // Invite other teachers to the class
    VIEW_ANALYTICS = 'VIEW_ANALYTICS',     // View class analytics and reports
    EDIT_CLASS_INFO = 'EDIT_CLASS_INFO'    // Edit class name, description, etc.
}

/**
 * Status of a teacher invitation to join a class
 */
export enum ClassTeacherInvitationStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    EXPIRED = 'EXPIRED'
}

