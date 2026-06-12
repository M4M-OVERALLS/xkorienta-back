export enum SubSystem {
  FRANCOPHONE = "FRANCOPHONE",
  ANGLOPHONE = "ANGLOPHONE",
  BILINGUAL = "BILINGUAL",
}

export enum CloseMode {
  STRICT = "STRICT", // Ferme automatiquement à l'heure exacte
  PERMISSIVE = "PERMISSIVE", // Autorise les soumissions tardives avec code
}

export enum certificationType {
  CERTIFICATE = "CERTIFICATE",
  DIPLOMA = "DIPLOMA",
  HONOR = "HONOR",
  SPECIALIZATION = "SPECIALIZATION",
  CERTIFICATION = "CERTIFICATION",
}

export enum DemandStatus {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum degreeAwardedStatus {
  PRESENTIEL = "PRESENTIEL",
  HYBRIDE = "HYBRIDE",
  DISTANCE = "DISTANCE",
}

export enum ModalityStatus {
  PRESENTIEL = "PRESENTIEL",
  HYBRIDE = "HYBRIDE",
  DISTANCE = "DISTANCE",
}

export enum LanguageStatus {
  FRANCAIS = "FRANCAIS",
  ANGLAIS = "ANGLAIS",
  CHINOIS = "CHINOIS",
  ALLEMAND = "ALLEMAND",
  ESPAGNOL = "ESPAGNOL",
}

export enum SpecialtyLevel {
  BTS = "BTS",
  HND = "HND",
  LICENCE = "Licence",
  MASTER = "Master",
  DOCTORAT = "Doctorat",
  CERTIFICATE = "Certificate",
}

export enum SpecialtyMode {
  ONSITE = "Onsite",
  HYBRID = "Hybrid",
  ONLINE = "Online",
}

export enum Cycle {
  // Préscolaire
  PRESCOLAIRE = "PRESCOLAIRE", // Petite section → Grande section / Nursery

  // Primaire
  PRIMAIRE = "PRIMAIRE", // SIL → CM2 / Class 1 → Class 6

  // Secondaire général
  SECONDAIRE_PREMIER_CYCLE = "SECONDAIRE_PREMIER_CYCLE", // 6ème → 3ème / Form 1 → Form 5
  SECONDAIRE_SECOND_CYCLE = "SECONDAIRE_SECOND_CYCLE", // 2nde → Tle / Lower-Upper Sixth

  // Secondaire technique & professionnel
  TECHNIQUE_PREMIER_CYCLE = "TECHNIQUE_PREMIER_CYCLE", // 1ère → 4ème année technique / TF 1-5
  TECHNIQUE_SECOND_CYCLE = "TECHNIQUE_SECOND_CYCLE", // 2nde technique → Terminale technique

  // Formation des enseignants
  NORMAL = "NORMAL", // ENIEG / ENIET / TTC

  // Supérieur
  BTS_HND = "BTS_HND", // BTS 1-2 / HND 1-2
  LICENCE = "LICENCE", // L1 → L3
  MASTER = "MASTER", // M1 → M2
  DOCTORAT = "DOCTORAT", // D1 → D3+

  // Non formel
  ALPHABETISATION = "ALPHABETISATION", // Alphabétisation
  EDUCATION_NON_FORMELLE = "EDUCATION_NON_FORMELLE", // Éducation non formelle

  // Alias générique conservé pour compatibilité montante
  SUPERIEUR = "SUPERIEUR", // Alias générique supérieur
}

export enum FieldCategory {
  COMPETENCE_GROUP = "COMPETENCE_GROUP", // Collège
  SERIE = "SERIE", // Lycée
  SPECIALITY = "SPECIALITY", // Supérieur / Technique
  FAMILY = "FAMILY", // Famille de spécialités (ex: STT, IND)
}

export enum SubjectType {
  DISCIPLINE = "DISCIPLINE", // Collège/Lycée/Primaire
  UE = "UE", // Enseignement Supérieur (Licence, Master, Doctorat)
  MODULE = "MODULE", // BTS/HND, formations techniques et normales
}

export enum UnitType {
  CHAPTER = "CHAPTER",
  MODULE = "MODULE",
  COURSE = "COURSE",
}

export enum DifficultyLevel {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  ADVANCED = "ADVANCED",
  EXPERT = "EXPERT",
}

export enum PedagogicalObjective {
  DIAGNOSTIC_EVAL = "DIAGNOSTIC_EVAL", // Évaluation diagnostique
  FORMATIVE_EVAL = "FORMATIVE_EVAL", // Évaluation formative
  SUMMATIVE_EVAL = "SUMMATIVE_EVAL", // Évaluation sommative
  SELF_ASSESSMENT = "SELF_ASSESSMENT", // Auto-évaluation
  COMPETENCY_VALIDATION = "COMPETENCY_VALIDATION", // Validation de compétence
  REMEDIATION = "REMEDIATION", // Remédiation
  EVALUATE = "EVALUATE", // Évaluer
  REVISE = "REVISE", // Réviser
  TRAIN = "TRAIN", // S'entraîner
  PREP_EXAM = "PREP_EXAM", // Préparer un examen
  CONTINUOUS_VALIDATION = "CONTINUOUS_VALIDATION", // Validation continue
}

export enum EvaluationType {
  QCM = "QCM", // Questions à choix multiples
  TRUE_FALSE = "TRUE_FALSE", // Vrai/Faux
  OPEN_QUESTION = "OPEN_QUESTION", // Question ouverte
  CASE_STUDY = "CASE_STUDY", // Étude de cas
  EXAM_SIMULATION = "EXAM_SIMULATION", // Simulation d'examen
  ADAPTIVE = "ADAPTIVE", // Évaluation adaptative
  MIXED = "MIXED", // Mixte
  // 🆕 V4 — Pour les TP, Soutenances, Portfolios (Tâche #U2)
  RUBRIC = "RUBRIC", // Grille de critères avec pondération (pas de QCM)
}

export enum ExamStatus {
  DRAFT = "DRAFT", // Brouillon
  PENDING_VALIDATION = "PENDING_VALIDATION", // En attente de validation
  VALIDATED = "VALIDATED", // Validé par l'inspecteur
  PUBLISHED = "PUBLISHED", // Publié et accessible
  ARCHIVED = "ARCHIVED", // Archivé
}

/**
 * Types d'examens - Taxonomie complète
 * Couvre tous les types d'évaluations du système éducatif
 */
export enum ExamType {
  // ========== ÉVALUATIONS DIAGNOSTIQUES ==========
  DIAGNOSTIC_TEST = "DIAGNOSTIC_TEST", // Test de positionnement
  PRE_TEST = "PRE_TEST", // Pré-test (avant chapitre)

  // ========== ÉVALUATIONS FORMATIVES ==========
  SELF_ASSESSMENT = "SELF_ASSESSMENT", // Auto-évaluation (7 niveaux/concept)
  FORMATIVE_QUIZ = "FORMATIVE_QUIZ", // Quiz formatif
  PRACTICE_TEST = "PRACTICE_TEST", // Test d'entraînement
  HOMEWORK = "HOMEWORK", // Devoir à la maison
  REVISION_QUIZ = "REVISION_QUIZ", // Quiz de révision

  // ========== ÉVALUATIONS SOMMATIVES ==========
  // Interrogations
  QUIZ_ANNOUNCED = "QUIZ_ANNOUNCED", // Interrogation annoncée
  QUIZ_SURPRISE = "QUIZ_SURPRISE", // Interrogation surprise

  // Contrôles
  CONTINUOUS_ASSESSMENT = "CONTINUOUS_ASSESSMENT", // Contrôle continu (CC)
  SUPERVISED_TEST = "SUPERVISED_TEST", // Devoir surveillé (DS)

  // Examens officiels
  MIDTERM_EXAM = "MIDTERM_EXAM", // Examen de mi-session / Partiel
  FINAL_EXAM = "FINAL_EXAM", // Examen final
  RETAKE_EXAM = "RETAKE_EXAM", // Examen de rattrapage

  // ========== ÉVALUATIONS SPÉCIALES ==========
  MOCK_EXAM = "MOCK_EXAM", // Examen blanc
  PRACTICAL_WORK = "PRACTICAL_WORK", // Travaux pratiques (TP)
  LAB_WORK = "LAB_WORK", // Travaux de laboratoire
  PROJECT_GROUP = "PROJECT_GROUP", // Projet de groupe
  PROJECT_INDIVIDUAL = "PROJECT_INDIVIDUAL", // Projet individuel
  ORAL_PRESENTATION = "ORAL_PRESENTATION", // Exposé oral
  ORAL_DEFENSE = "ORAL_DEFENSE", // Soutenance
  PORTFOLIO = "PORTFOLIO", // Dossier / Portfolio
  CASE_STUDY_EVAL = "CASE_STUDY_EVAL", // Étude de cas

  // ========== COMPÉTITIONS ==========
  CLASS_CHALLENGE = "CLASS_CHALLENGE", // Challenge inter-classes
  SCHOOL_COMPETITION = "SCHOOL_COMPETITION", // Compétition inter-écoles
  OLYMPIAD = "OLYMPIAD", // Olympiade

  // ========== ADAPTATIF ==========
  ADAPTIVE_ASSESSMENT = "ADAPTIVE_ASSESSMENT", // Évaluation adaptative
  PERSONALIZED_TEST = "PERSONALIZED_TEST", // Test personnalisé
}

/**
 * Niveaux d'auto-évaluation (échelle à 7 niveaux)
 */
export enum SelfAssessmentLevel {
  UNKNOWN = 0, // ❓ Je ne sais pas
  TOTALLY_UNABLE = 1, // 😵 Totalement incapable
  UNABLE_WITH_HELP = 2, // 😰 Incapable même avec aide
  UNABLE_ALONE = 3, // 🤔 Incapable sans aide
  ABLE_WITH_HELP = 4, // 🙂 Capable avec aide
  ABLE_ALONE = 5, // 😊 Capable sans aide
  PERFECTLY_ABLE = 6, // 🌟 Parfaitement capable
}

export enum CompetencyType {
  DIGITAL = "DIGITAL",
  ENTREPRENEURIAL = "ENTREPRENEURIAL",
  SOFT_SKILL = "SOFT_SKILL",
  PROBLEM_SOLVING = "PROBLEM_SOLVING",
  LOGIC_REASONING = "LOGIC_REASONING",
}

export enum UserRole {
  // Apprenants
  STUDENT = "STUDENT",

  // Pédagogiques
  TEACHER = "TEACHER",
  SCHOOL_ADMIN = "SCHOOL_ADMIN",
  PARENT = "PARENT",
  INSPECTOR = "INSPECTOR",
  SURVEILLANT = "SURVEILLANT",
  PREFET = "PREFET",
  PRINCIPAL = "PRINCIPAL",
  DG_ISIMMA = "DG_ISIMMA",
  RECTOR = "RECTOR",

  // Technique
  DG_M4M = "DG_M4M",
  TECH_SUPPORT = "TECH_SUPPORT",
}

export enum ClassValidationStatus {
  PENDING = "PENDING",
  VALIDATED = "VALIDATED",
  REJECTED = "REJECTED",
}

export enum SchoolStatus {
  PENDING = "PENDING", // Awaiting platform admin review
  VALIDATED = "VALIDATED", // Admin confirmed as a legitimate school
  REJECTED = "REJECTED", // Admin rejected (fraud, duplicate, error)
  SUSPENDED = "SUSPENDED", // Previously validated, now suspended (violation discovered)
}

export enum CognitiveProfile {
  VISUAL = "VISUAL",
  AUDITORY = "AUDITORY",
  LOGIC_MATH = "LOGIC_MATH",
  LITERARY = "LITERARY",
}

export enum LearnerType {
  EXAM_PREP = "EXAM_PREP",
  REMEDIAL = "REMEDIAL",
  ADVANCED = "ADVANCED",
  STRUGGLING = "STRUGGLING",
}

export enum SubscriptionStatus {
  FREEMIUM = "FREEMIUM",
  PREMIUM = "PREMIUM",
  INSTITUTION_PREMIUM = "INSTITUTION_PREMIUM",
  EDUCATOR_ACCESS = "EDUCATOR_ACCESS",
  DIRECTION_ACCESS = "DIRECTION_ACCESS",
}

export enum LearningMode {
  AUTO_EVAL = "AUTO_EVAL",
  COMPETITION = "COMPETITION",
  EXAM = "EXAM",
  CLASS_CHALLENGE = "CLASS_CHALLENGE",
}

export enum ContributionType {
  CREATOR = "CREATOR",
  VALIDATOR = "VALIDATOR",
  CORRECTOR = "CORRECTOR",
  MANAGER = "MANAGER",
  SUPERVISOR = "SUPERVISOR",
}

export enum AccessScope {
  GLOBAL = "GLOBAL",
  LOCAL = "LOCAL",
  SUBJECT = "SUBJECT",
  LEVEL = "LEVEL",
  FIELD = "FIELD",
}

export enum ReportingAccess {
  CLASS = "CLASS",
  FIELD = "FIELD",
  ESTABLISHMENT = "ESTABLISHMENT",
  GLOBAL = "GLOBAL",
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
  OWNER = "OWNER",
  COLLABORATOR = "COLLABORATOR",
  ASSISTANT = "ASSISTANT",
}

/**
 * Granular permissions for teachers in a class
 * These define what actions a COLLABORATOR or ASSISTANT can perform.
 */
export enum ClassTeacherPermission {
  // Exam Management
  CREATE_EXAM = "CREATE_EXAM", // Create exams for the class
  EDIT_EXAM = "EDIT_EXAM", // Edit existing exams
  DELETE_EXAM = "DELETE_EXAM", // Delete exams
  PUBLISH_EXAM = "PUBLISH_EXAM", // Publish exams to students

  // Student Management
  GRADE_STUDENTS = "GRADE_STUDENTS", // Grade student submissions
  VIEW_STUDENTS = "VIEW_STUDENTS", // View student list and info
  MANAGE_STUDENTS = "MANAGE_STUDENTS", // Add/remove students

  // Communication
  CREATE_FORUM = "CREATE_FORUM", // Create class forums
  SEND_MESSAGES = "SEND_MESSAGES", // Send messages to class

  // Administration
  INVITE_TEACHERS = "INVITE_TEACHERS", // Invite other teachers to the class
  VIEW_ANALYTICS = "VIEW_ANALYTICS", // View class analytics and reports
  EDIT_CLASS_INFO = "EDIT_CLASS_INFO", // Edit class name, description, etc.
}

/**
 * Status of a teacher invitation to join a class
 */
export enum ClassTeacherInvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

// ==========================================
// BIBLIOTHÈQUE
// ==========================================

export enum BookFormat {
  PDF = "PDF",
  EPUB = "EPUB",
}

export enum BookPurchaseStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

// ==========================================
// MÉDIATHÈQUE (VIDEO, PODCAST, AUDIO)
// ==========================================

/** Type de contenu média — BOOK inclus, un livre est un média comme les autres */
export enum MediaType {
  VIDEO = "VIDEO",
  PODCAST = "PODCAST",
  AUDIO = "AUDIO",
  BOOK = "BOOK",
}

/** Visibilité d'un média : global (plateforme) ou restreint à une école */
export enum MediaScope {
  GLOBAL = "GLOBAL",
  SCHOOL = "SCHOOL",
}

/** Cycle de vie d'un média soumis par un enseignant */
export enum MediaStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  ARCHIVED = "ARCHIVED",
}

/** @deprecated Utiliser MediaScope. BookScope est conservé pour compatibilité. */
export enum BookScope {
  GLOBAL = "GLOBAL",
  SCHOOL = "SCHOOL",
}

/** @deprecated Utiliser MediaStatus. BookStatus est conservé pour compatibilité. */
export enum BookStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  ARCHIVED = "ARCHIVED",
}

/** Statut d'un achat de média */
export enum MediaPurchaseStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

/** Type d'interaction utilisateur avec un média (tracking) */
export enum MediaInteractionType {
  PLAY = "PLAY",
  COMPLETE = "COMPLETE",
  PURCHASE = "PURCHASE",
  SKIP = "SKIP",
}

export enum StorageProvider {
  LOCAL = "local",
  S3 = "s3",
  CLOUDFLARE_R2 = "cloudflare_r2",
}

export enum PaymentProvider {
  NOTCHPAY = "notchpay",
  STRIPE = "stripe",
}

// ==========================================
// PAYMENT SYSTEM
// ==========================================

export enum TransactionType {
  BOOK_PURCHASE = "BOOK_PURCHASE",
  MEDIA_PURCHASE = "MEDIA_PURCHASE",
  SUBSCRIPTION = "SUBSCRIPTION",
  COURSE = "COURSE",
  TOP_UP = "TOP_UP",
  SCHOOL_INSCRIPTION = "SCHOOL_INSCRIPTION",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  EXPIRED = "EXPIRED",
}

export enum SubscriptionInterval {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum SubscriptionPlanStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  PAST_DUE = "PAST_DUE",
}

export enum Currency {
  XAF = "XAF",
  EUR = "EUR",
  USD = "USD",
}

// ==========================================
// INVOICES
// ==========================================

/**
 * Type de facture selon l'acteur destinataire.
 * PURCHASE_RECEIPT  → reçu pour l'acheteur (élève ou enseignant qui achète)
 * EARNINGS_STATEMENT → relevé de gains pour le vendeur (enseignant dont le livre est acheté)
 */
export enum InvoiceType {
  PURCHASE_RECEIPT = "PURCHASE_RECEIPT",
  EARNINGS_STATEMENT = "EARNINGS_STATEMENT",
  SCHOOL_INSCRIPTION = "SCHOOL_INSCRIPTION",
}

export enum InvoiceStatus {
  ISSUED = "ISSUED", // Générée
  SENT = "SENT", // Envoyée par email
  VOIDED = "VOIDED", // Annulée (ex: remboursement)
}

// ==========================================
// WALLET & PAYOUTS
// ==========================================

export enum PayoutStatus {
  PENDING = "PENDING", // Demande soumise
  PROCESSING = "PROCESSING", // En cours de traitement
  COMPLETED = "COMPLETED", // Virement effectué
  FAILED = "FAILED", // Échec du virement
}

export enum MobileMoneyProvider {
  ORANGE = "orange",
  MTN = "mtn",
  OTHER = "other",
}

// ==========================================
// INSCRIPTION MODULE
// ==========================================

export enum InscriptionFormStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  CLOSED = "CLOSED",
  ARCHIVED = "ARCHIVED",
}

export enum ApplicationStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  PAID = "PAID",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum FormFieldType {
  TEXT = "TEXT",
  SELECT = "SELECT",
  CHECKBOX_GROUP = "CHECKBOX_GROUP",
  FILE = "FILE",
}

/**
 * Contexte de création d'un examen
 * - SYLLABUS_BASED : L'examen est lié à un syllabus existant de l'enseignant
 * - PUBLIC : L'examen est créé indépendamment de tout programme (examen public/standalone)
 */
export enum ExamContext {
  SYLLABUS_BASED = 'SYLLABUS_BASED',
  PUBLIC = 'PUBLIC',
}
export enum AlertSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum AttemptStatus {
  STARTED = "STARTED",
  COMPLETED = "COMPLETED",
  EXPIRED = "EXPIRED",
  ABANDONED = "ABANDONED",
}

/**
 * Xkorienta Parent Module Enumerations
 * Extends existing UserRole enum and adds new enums for parent features
 */

// KYC Verification Levels
export enum KYCLevel {
  NONE = 0,
  LEVEL_1 = 1, // Identity verified
  LEVEL_2 = 2, // School relationship confirmed
}

// KYC Verification Status
export enum KYCStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  VERIFIED = 'VERIFIED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

// Parent-Learner Link Status
export enum LinkStatus {
  PENDING = 'PENDING', // Awaiting admin approval
  ACTIVE = 'ACTIVE', // Approved, parent can access
  REVOKED = 'REVOKED', // Link terminated
}

// Attendance Status (Option A: Exam-based)
export enum AttendanceStatus {
  PRESENT = 'PRESENT', // Submitted exam before deadline
  ABSENT = 'ABSENT', // No exam submission
  LATE = 'LATE', // Submitted after deadline
  EXCUSED = 'EXCUSED', // Admin marked as excused
}

// Early Warning Alert Type
export enum AlertType {
  ATTENDANCE = 'ATTENDANCE',
  PERFORMANCE = 'PERFORMANCE',
  DROPOUT_RISK = 'DROPOUT_RISK',
}

// SOS Alert Status
export enum SOSAlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  ESCALATION_REQUIRED = 'ESCALATION_REQUIRED',
}

// Audit Log Action Type
export enum AuditAction {
  KYC_L1_SUBMITTED = 'KYC_L1_SUBMITTED',
  KYC_L1_VERIFIED = 'KYC_L1_VERIFIED',
  KYC_L1_REJECTED = 'KYC_L1_REJECTED',
  KYC_L2_VERIFIED = 'KYC_L2_VERIFIED',
  LINK_CREATED = 'LINK_CREATED',
  LINK_APPROVED = 'LINK_APPROVED',
  LINK_REVOKED = 'LINK_REVOKED',
  SOS_TRIGGERED = 'SOS_TRIGGERED',
  SOS_ACKNOWLEDGED = 'SOS_ACKNOWLEDGED',
  DASHBOARD_ACCESSED = 'DASHBOARD_ACCESSED',
}

// Risk Score Categories (for early warning system)
export enum RiskLevel {
  ON_TRACK = 'ON_TRACK', // No risk
  AT_RISK = 'AT_RISK', // Medium risk
  CRITICAL = 'CRITICAL', // High risk
}

// Notification Type (extend existing)
export const PARENT_NOTIFICATION_TYPES = {
  KYC_L1_VERIFIED: 'kyc_l1_verified',
  KYC_L1_REJECTED: 'kyc_l1_rejected',
  KYC_L2_VERIFIED: 'kyc_l2_verified',
  LINK_APPROVED: 'link_approved',
  EARLY_WARNING: 'early_warning',
  SOS_ACKNOWLEDGED: 'sos_acknowledged',
  EXAM_RESULT: 'exam_result',
  ATTENDANCE_ALERT: 'attendance_alert',
  DROPOUT_WARNING: 'dropout_warning',
} as const;

export type ParentNotificationType = typeof PARENT_NOTIFICATION_TYPES[keyof typeof PARENT_NOTIFICATION_TYPES];

export enum ParentRelationshipType {
  FATHER = "FATHER",
  MOTHER = "MOTHER",
  GUARDIAN = "GUARDIAN",
  OTHER = "OTHER",
}
