/**
 * Tests d'Intégration : Sécurité A-10 — Endpoint /student/exams/[id]/take
 *
 * Vérifie que correctAnswer, modelAnswer, openQuestionConfig et isCorrect
 * ne sont JAMAIS renvoyés dans le payload de prise d'examen.
 *
 * Rapport d'intrusion : A-10 (CRITIQUE, CVSS 8.6)
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import Exam from "@/models/Exam";
import Question from "@/models/Question";
import Option from "@/models/Option";
import User from "@/models/User";
import { EvaluationType, ExamStatus, CloseMode } from "@/models/enums";
import request from "supertest";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

/**
 * Helper: Creates a full exam with questions of each type and their options.
 */
async function seedExamWithQuestions(teacherId: mongoose.Types.ObjectId) {
  const exam = await Exam.create({
    title: "Examen Sécurité A-10",
    createdById: teacherId,
    startTime: new Date(Date.now() - 3600_000),
    endTime: new Date(Date.now() + 3600_000),
    duration: 60,
    closeMode: CloseMode.STRICT,
    status: ExamStatus.PUBLISHED,
    isPublished: true,
    isActive: true,
    config: {
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: false,
      allowReview: false,
      passingScore: 50,
      maxAttempts: 3,
      antiCheat: { fullscreenRequired: false },
    },
  });

  // QCM question with correct option
  const qcmQuestion = await Question.create({
    examId: exam._id,
    text: "Quelle est la capitale du Cameroun ?",
    type: EvaluationType.QCM,
    points: 2,
  });

  await Option.insertMany([
    { questionId: qcmQuestion._id, text: "Yaoundé", isCorrect: true, order: 0 },
    { questionId: qcmQuestion._id, text: "Douala", isCorrect: false, order: 1 },
    { questionId: qcmQuestion._id, text: "Bafoussam", isCorrect: false, order: 2 },
  ]);

  // TRUE_FALSE question with correctAnswer
  const tfQuestion = await Question.create({
    examId: exam._id,
    text: "Le Cameroun est en Afrique de l'Ouest.",
    type: EvaluationType.TRUE_FALSE,
    points: 1,
    correctAnswer: false,
  });

  // OPEN_QUESTION with modelAnswer and openQuestionConfig
  const openQuestion = await Question.create({
    examId: exam._id,
    text: "Expliquez le principe de la photosynthèse.",
    type: EvaluationType.OPEN_QUESTION,
    points: 5,
    modelAnswer: "La photosynthèse est le processus par lequel les plantes convertissent la lumière en énergie chimique.",
    openQuestionConfig: {
      gradingMode: "keywords",
      keywords: [
        { word: "lumière", weight: 30, required: true },
        { word: "énergie", weight: 30, required: true },
        { word: "plantes", weight: 20, required: false },
      ],
      semanticThreshold: 0.7,
      minLength: 20,
    },
  });

  return { exam, qcmQuestion, tfQuestion, openQuestion };
}

describe("A-10 — /api/student/exams/[id]/take ne doit pas exposer les réponses", () => {
  let teacher: any;
  let student: any;
  let examId: string;

  beforeAll(async () => {
    await mongoose.connect(
      process.env.TEST_DATABASE_URL || "mongodb://localhost:27017/Xkorienta-test",
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      Exam.deleteMany({}),
      Question.deleteMany({}),
      Option.deleteMany({}),
      User.deleteMany({}),
    ]);

    teacher = await User.create({
      email: "teacher-a10@test.com",
      name: "Prof Sécurité",
      role: "TEACHER",
      password: "hashed",
    });

    student = await User.create({
      email: "student-a10@test.com",
      name: "Étudiant Test",
      role: "STUDENT",
      password: "hashed",
    });

    const seed = await seedExamWithQuestions(teacher._id);
    examId = seed.exam._id.toString();
  });

  /**
   * Recursive helper: scans an object (or array) for forbidden keys.
   * Returns a list of JSONPath-style locations where forbidden keys were found.
   */
  function findForbiddenKeys(
    obj: unknown,
    forbidden: string[],
    path = "$",
  ): string[] {
    const hits: string[] = [];
    if (obj === null || obj === undefined) return hits;

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        hits.push(...findForbiddenKeys(item, forbidden, `${path}[${i}]`));
      });
    } else if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (forbidden.includes(key)) {
          hits.push(`${path}.${key}`);
        }
        hits.push(...findForbiddenKeys(value, forbidden, `${path}.${key}`));
      }
    }
    return hits;
  }

  describe("Questions QCM", () => {
    it("should not include isCorrect on any option", async () => {
      // Arrange & Act
      const res = await request(API_URL)
        .get(`/api/student/exams/${examId}/take`)
        .expect(200);

      // Assert
      const questions = res.body.exam?.questions ?? [];
      for (const q of questions) {
        for (const opt of q.options ?? []) {
          expect(opt).not.toHaveProperty("isCorrect");
        }
      }
    });
  });

  describe("Questions TRUE_FALSE", () => {
    it("should not include correctAnswer on any question", async () => {
      // Arrange & Act
      const res = await request(API_URL)
        .get(`/api/student/exams/${examId}/take`)
        .expect(200);

      // Assert
      const questions = res.body.exam?.questions ?? [];
      for (const q of questions) {
        expect(q).not.toHaveProperty("correctAnswer");
      }
    });
  });

  describe("Questions OPEN_QUESTION", () => {
    it("should not include modelAnswer on any question", async () => {
      // Arrange & Act
      const res = await request(API_URL)
        .get(`/api/student/exams/${examId}/take`)
        .expect(200);

      // Assert
      const questions = res.body.exam?.questions ?? [];
      for (const q of questions) {
        expect(q).not.toHaveProperty("modelAnswer");
      }
    });

    it("should not include openQuestionConfig on any question", async () => {
      // Arrange & Act
      const res = await request(API_URL)
        .get(`/api/student/exams/${examId}/take`)
        .expect(200);

      // Assert
      const questions = res.body.exam?.questions ?? [];
      for (const q of questions) {
        expect(q).not.toHaveProperty("openQuestionConfig");
      }
    });
  });

  describe("Deep scan — aucune fuite de réponse dans le payload complet", () => {
    it("should have zero occurrences of correctAnswer, modelAnswer, openQuestionConfig, isCorrect in the entire response body", async () => {
      // Arrange & Act
      const res = await request(API_URL)
        .get(`/api/student/exams/${examId}/take`)
        .expect(200);

      // Assert — scan récursif du body complet
      const forbidden = ["correctAnswer", "modelAnswer", "openQuestionConfig", "isCorrect"];
      const leaks = findForbiddenKeys(res.body, forbidden);

      expect(leaks).toEqual([]);
    });
  });

  describe("Mongoose toJSON defense-in-depth", () => {
    it("Question.toJSON should strip correctAnswer, modelAnswer, openQuestionConfig", () => {
      // Arrange
      const q = new Question({
        examId: new mongoose.Types.ObjectId(),
        text: "Test question",
        type: EvaluationType.TRUE_FALSE,
        points: 1,
        correctAnswer: true,
        modelAnswer: "La réponse modèle",
        openQuestionConfig: { gradingMode: "keywords", keywords: [{ word: "test", weight: 50 }] },
      });

      // Act
      const json = q.toJSON();

      // Assert
      expect(json).not.toHaveProperty("correctAnswer");
      expect(json).not.toHaveProperty("modelAnswer");
      expect(json).not.toHaveProperty("openQuestionConfig");
    });

    it("Option.toJSON should strip isCorrect", () => {
      // Arrange
      const opt = new Option({
        questionId: new mongoose.Types.ObjectId(),
        text: "Option A",
        isCorrect: true,
      });

      // Act
      const json = opt.toJSON();

      // Assert
      expect(json).not.toHaveProperty("isCorrect");
    });
  });
});
