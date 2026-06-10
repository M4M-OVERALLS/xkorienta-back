/**
 * Factories pour créer des données de test
 */

import Class from "@/models/Class";
import Concept from "@/models/Concept";
import EducationLevel from "@/models/EducationLevel";
import Exam from "@/models/Exam";
import LearningUnit from "@/models/LearningUnit";
import School, { SchoolType } from "@/models/School";
import Subject from "@/models/Subject";
import Syllabus from "@/models/Syllabus";
import User from "@/models/User";
import {
  CloseMode,
  Cycle,
  DifficultyLevel,
  EvaluationType,
  ExamStatus,
  ExamType,
  LearningMode,
  PedagogicalObjective,
  SubSystem,
  SubjectType,
  UnitType,
} from "@/models/enums";

/**
 * Créer un utilisateur de test
 */
export async function createUser(overrides: any = {}) {
  const user = new User({
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    name: "Test User",
    firstName: "Test",
    lastName: "User",
    role: "TEACHER",
    password: "hashed_password",
    ...overrides,
  });
  await user.save();
  return user;
}

/**
 * Créer une école de test
 */
export async function createSchool(overrides: any = {}) {
  let owner = overrides.owner;
  if (!owner) {
    const ownerUser = await createUser({ role: "TEACHER" });
    owner = ownerUser._id;
  }

  const school = new School({
    name: `Test School ${Date.now()}`,
    type: SchoolType.SECONDARY,
    subSystem: SubSystem.FRANCOPHONE,
    cycles: [Cycle.SECONDAIRE_PREMIER_CYCLE, Cycle.SECONDAIRE_SECOND_CYCLE],
    location: {
      city: "Yaoundé",
      country: "Cameroun",
    },
    status: "VALIDATED",
    owner,
    ...overrides,
  });
  await school.save();
  return school;
}

/**
 * Créer un niveau d'éducation de test
 */
export async function createEducationLevel(overrides: any = {}) {
  const suffix = Date.now();
  const level = new EducationLevel({
    name: `6ème ${suffix}`,
    code: `6EME-${suffix}`,
    cycle: Cycle.SECONDAIRE_PREMIER_CYCLE,
    schoolType: SchoolType.SECONDARY,
    subSystem: SubSystem.FRANCOPHONE,
    order: 6,
    metadata: {
      displayName: { fr: `6ème ${suffix}`, en: `Grade 6 ${suffix}` },
    },
    ...overrides,
  });
  await level.save();
  return level;
}

/**
 * Créer une matière de test
 */
export async function createSubject(overrides: any = {}) {
  const suffix = Date.now();
  const subject = new Subject({
    name: `Mathématiques ${suffix}`,
    code: `MATH-${suffix}`,
    subSystem: SubSystem.FRANCOPHONE,
    subjectType: SubjectType.DISCIPLINE,
    metadata: {
      displayName: { fr: `Mathématiques ${suffix}`, en: `Mathematics ${suffix}` },
    },
    ...overrides,
  });
  await subject.save();
  return subject;
}

/**
 * Créer un syllabus de test
 */
export async function createSyllabus(
  subjectId: string,
  teacherId: string,
  overrides: any = {},
) {
  const syllabus = new Syllabus({
    subject: subjectId,
    teacher: teacherId,
    title: `Syllabus Mathématiques 6ème ${Date.now()}`,
    structure: {
      chapters: [],
    },
    ...overrides,
  });
  await syllabus.save();
  return syllabus;
}

/**
 * Créer un chapitre (LearningUnit) de test
 */
export async function createLearningUnit(
  subjectId: string,
  overrides: any = {},
) {
  const unit = new LearningUnit({
    subject: subjectId,
    title: `Chapitre ${Date.now()}`,
    type: UnitType.CHAPTER,
    order: 1,
    content: {
      objectives: [],
      prerequisites: [],
      duration: 10,
      difficulty: DifficultyLevel.INTERMEDIATE,
    },
    ...overrides,
  });
  await unit.save();
  return unit;
}

/**
 * Créer un concept de test
 */
export async function createConcept(
  syllabusId: string,
  learningUnitId: string,
  overrides: any = {},
) {
  const concept = new Concept({
    syllabus: syllabusId,
    learningUnit: learningUnitId || undefined,
    title: `Concept ${Date.now()}`,
    description: "Description du concept",
    order: 1,
    ...overrides,
  });
  await concept.save();
  return concept;
}

/**
 * Créer une classe de test
 */
export async function createClass(
  schoolId: string,
  levelId: string,
  mainTeacherId: string,
  overrides: any = {},
) {
  const classDoc = new Class({
    school: schoolId,
    level: levelId,
    mainTeacher: mainTeacherId,
    name: `6ème A ${Date.now()}`,
    academicYear: "2025-2026",
    students: [],
    teachers: [],
    ...overrides,
  });
  await classDoc.save();
  return classDoc;
}

/**
 * Créer un examen de test (V4)
 */
export async function createExamV4(createdById: string, overrides: any = {}) {
  const school = await createSchool({ owner: createdById });
  const level = await createEducationLevel();
  const subject = await createSubject();

  const exam = new Exam({
    title: `Test Exam ${Date.now()}`,
    createdById,
    schoolType: school.type,
    subSystem: SubSystem.FRANCOPHONE,
    targetLevels: [level._id],
    subject: subject._id,

    // V4 fields
    examType: ExamType.SELF_ASSESSMENT,
    graded: false,
    createdWithV4: true,

    // Objectifs pédagogiques
    pedagogicalObjective: PedagogicalObjective.SELF_ASSESSMENT,
    evaluationType: EvaluationType.QCM,
    learningMode: LearningMode.AUTO_EVAL,
    difficultyLevel: DifficultyLevel.INTERMEDIATE,

    // Timing
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    duration: 15,
    closeMode: CloseMode.PERMISSIVE,

    // Statut
    status: ExamStatus.DRAFT,
    isPublished: false,
    isActive: false,

    // Config
    config: {
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: true,
      allowReview: true,
      passingScore: 50,
      maxAttempts: 3,
      timeBetweenAttempts: 0,
      enableImmediateFeedback: true,
      antiCheat: {
        fullscreenRequired: false,
        disableCopyPaste: false,
        trackTabSwitches: false,
        webcamRequired: false,
        maxTabSwitches: 99,
        preventScreenshot: false,
        blockRightClick: false,
      },
    },

    // Stats
    stats: {
      totalAttempts: 0,
      totalCompletions: 0,
      averageScore: 0,
      averageTime: 0,
      passRate: 0,
    },

    tags: [],
    version: 1,

    ...overrides,
  });

  await exam.save();
  return exam;
}

/**
 * Créer un setup complet pour les tests
 */
export async function createFullSetup() {
  const user = await createUser();
  const school = await createSchool({ owner: user._id });
  const level = await createEducationLevel();
  const subject = await createSubject();
  const syllabus = await createSyllabus(
    subject._id.toString(),
    user._id.toString(),
    { school: school._id },
  );
  const chapter = await createLearningUnit(subject._id.toString());
  const concepts = await Promise.all([
    createConcept(syllabus._id.toString(), chapter._id.toString(), {
      title: "Concept 1",
      order: 1,
    }),
    createConcept(syllabus._id.toString(), chapter._id.toString(), {
      title: "Concept 2",
      order: 2,
    }),
    createConcept(syllabus._id.toString(), chapter._id.toString(), {
      title: "Concept 3",
      order: 3,
    }),
    createConcept(syllabus._id.toString(), chapter._id.toString(), {
      title: "Concept 4",
      order: 4,
    }),
  ]);
  const classDoc = await createClass(
    school._id.toString(),
    level._id.toString(),
    user._id.toString(),
  );

  return {
    user,
    school,
    level,
    subject,
    syllabus,
    chapter,
    concepts,
    class: classDoc,
  };
}
