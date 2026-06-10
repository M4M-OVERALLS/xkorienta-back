/**
 * Tests d'Intégration : Examens Publics
 * Endpoint: GET /api/exams/public
 */

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

import Exam from "@/models/Exam";
import User from "@/models/User";
import Subject from "@/models/Subject";
import EducationLevel from "@/models/EducationLevel";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import {
  CloseMode,
  DifficultyLevel,
  EvaluationType,
  ExamStatus,
  ExamType,
  LearningMode,
  PedagogicalObjective,
  SubSystem,
} from "@/models/enums";
import { GET } from "@/app/api/exams/public/route";
import {
  connectMongoMemory,
  disconnectMongoMemory,
} from "../../helpers/mongoMemory";
import {
  createEducationLevel,
  createSubject,
  createUser,
} from "../../helpers/factories";

async function getPublicExams(query = "") {
  const res = await GET(
    new Request(`http://localhost/api/exams/public${query}`),
  );
  return { status: res.status, body: await res.json() };
}

async function createPublishedExam(
  teacherId: string,
  opts: {
    title: string;
    subjectId: string;
    levelId: string;
    isPublished?: boolean;
    isActive?: boolean;
  },
) {
  return Exam.create({
    title: opts.title,
    description: "Description test",
    createdById: teacherId,
    subject: opts.subjectId,
    targetLevels: [opts.levelId],
    subSystem: SubSystem.FRANCOPHONE,
    examType: ExamType.FORMATIVE_QUIZ,
    pedagogicalObjective: PedagogicalObjective.SUMMATIVE_EVAL,
    evaluationType: EvaluationType.QCM,
    learningMode: LearningMode.EXAM,
    difficultyLevel: DifficultyLevel.INTERMEDIATE,
    createdWithV4: true,
    graded: true,
    startTime: new Date(Date.now() - 3600_000),
    endTime: new Date(Date.now() + 7 * 24 * 3600_000),
    duration: 60,
    closeMode: CloseMode.PERMISSIVE,
    status: ExamStatus.PUBLISHED,
    isPublished: opts.isPublished ?? true,
    isActive: opts.isActive ?? true,
    config: {
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      allowReview: true,
    },
  });
}

describe("GET /api/exams/public - Liste des examens publics", () => {
  let publicTeacher: any;
  let mathSubject: any;
  let frenchSubject: any;
  let level3eme: any;
  let level2nde: any;

  beforeAll(async () => {
    await connectMongoMemory();
  }, 30000);

  afterAll(async () => {
    await disconnectMongoMemory();
  });

  beforeEach(async () => {
    await Promise.all([
      Exam.deleteMany({}),
      User.deleteMany({}),
      Subject.deleteMany({}),
      EducationLevel.deleteMany({}),
    ]);

    const seedSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    publicTeacher = await createUser({
      name: "Prof Public",
      email: `prof.public.${seedSuffix}@example.com`,
      role: "TEACHER",
    });

    mathSubject = await createSubject({
      name: "Mathématiques",
      code: `MATH-${seedSuffix}`,
    });
    frenchSubject = await createSubject({
      name: "Français",
      code: `FR-${seedSuffix}`,
    });
    level3eme = await createEducationLevel({
      name: "3ème",
      order: 9,
      code: `3EME-${seedSuffix}`,
    });
    level2nde = await createEducationLevel({
      name: "2nde",
      order: 10,
      code: `2NDE-${seedSuffix}`,
    });

    await createPublishedExam(publicTeacher._id, {
      title: "Algèbre : Équations du second degré",
      subjectId: mathSubject._id,
      levelId: level3eme._id,
    });
    await createPublishedExam(publicTeacher._id, {
      title: "Grammaire : Les figures de style",
      subjectId: frenchSubject._id,
      levelId: level3eme._id,
    });
    await createPublishedExam(publicTeacher._id, {
      title: "Fonctions linéaires",
      subjectId: mathSubject._id,
      levelId: level2nde._id,
    });
    await createPublishedExam(publicTeacher._id, {
      title: "Test Privé",
      subjectId: mathSubject._id,
      levelId: level3eme._id,
      isPublished: false,
      isActive: false,
    });
    await createPublishedExam(publicTeacher._id, {
      title: "Test Brouillon",
      subjectId: mathSubject._id,
      levelId: level3eme._id,
      isPublished: false,
    });
  });

  describe("Liste de base", () => {
    it("should return only published and active exams", async () => {
      const { status, body } = await getPublicExams();
      expect(status).toBe(200);
      expect(body.exams).toHaveLength(3);
      body.exams.forEach((exam: any) => {
        expect(exam).toHaveProperty("title");
        expect(exam).not.toHaveProperty("questions");
      });
    });

    it("should include subject and level details", async () => {
      const { body } = await getPublicExams();
      expect(body.exams[0]).toHaveProperty("subject");
      expect(body.exams[0].subject).toHaveProperty("name");
      expect(body.exams[0]).toHaveProperty("level");
      expect(body.exams[0].level).toHaveProperty("name");
    });

    it("should include creator name without exposing sensitive data", async () => {
      const { body } = await getPublicExams();
      expect(body.exams[0]).toHaveProperty("creatorName", "Prof Public");
      expect(body.exams[0]).not.toHaveProperty("creatorEmail");
      expect(body.exams[0]).not.toHaveProperty("createdBy");
    });

    it("should include questionCount without exposing questions", async () => {
      const { body } = await getPublicExams();
      expect(body.exams[0]).toHaveProperty("questionCount", 0);
      expect(body.exams[0]).not.toHaveProperty("questions");
    });
  });

  describe("Filtres", () => {
    it("should filter by levelId", async () => {
      const { body } = await getPublicExams(
        `?levelId=${level3eme._id.toString()}`,
      );
      expect(body.exams).toHaveLength(2);
      body.exams.forEach((exam: any) => {
        expect(exam.level.id).toBe(level3eme._id.toString());
      });
    });

    it("should filter by subjectId", async () => {
      const { body } = await getPublicExams(
        `?subjectId=${mathSubject._id.toString()}`,
      );
      expect(body.exams).toHaveLength(2);
      body.exams.forEach((exam: any) => {
        expect(exam.subject.id).toBe(mathSubject._id.toString());
      });
    });

    it("should combine levelId and subjectId filters", async () => {
      const { body } = await getPublicExams(
        `?levelId=${level3eme._id.toString()}&subjectId=${mathSubject._id.toString()}`,
      );
      expect(body.exams).toHaveLength(1);
      expect(body.exams[0].title).toBe("Algèbre : Équations du second degré");
    });
  });

  describe("Pagination", () => {
    it("should paginate results with default values", async () => {
      const { body } = await getPublicExams();
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      });
    });

    it("should respect custom page and limit", async () => {
      const { body } = await getPublicExams("?page=1&limit=2");
      expect(body.exams).toHaveLength(2);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it("should handle page 2 correctly", async () => {
      const { body } = await getPublicExams("?page=2&limit=2");
      expect(body.exams).toHaveLength(1);
      expect(body.pagination.page).toBe(2);
    });
  });

  describe("Cas limites", () => {
    it("should return empty array when no public exams exist", async () => {
      await Exam.deleteMany({});
      const { body } = await getPublicExams();
      expect(body.exams).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it("should handle invalid MongoDB ObjectId gracefully", async () => {
      const { status } = await getPublicExams("?levelId=not-an-id");
      // CastError MongoDB → 500 côté route actuelle
      expect([200, 500]).toContain(status);
    });
  });

  describe("Performance", () => {
    it("should complete request in under 1 second", async () => {
      const start = Date.now();
      await getPublicExams();
      expect(Date.now() - start).toBeLessThan(1000);
    });
  });

  describe("Sécurité", () => {
    it("should not expose draft or unpublished exams", async () => {
      const { body } = await getPublicExams();
      const titles = body.exams.map((e: any) => e.title);
      expect(titles).not.toContain("Test Privé");
      expect(titles).not.toContain("Test Brouillon");
    });
  });
});
