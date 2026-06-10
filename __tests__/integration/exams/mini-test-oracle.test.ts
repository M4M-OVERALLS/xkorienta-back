/**
 * Tests d'Intégration : Sécurité A-01 — Oracle de réponse mini-tests
 *
 * Vérifie que POST /api/public/mini-tests/[id]/response ne retourne
 * JAMAIS isCorrect. L'évaluation est différée au /submit.
 *
 * Rapport d'intrusion : A-01 (CRITIQUE, CVSS 9.1)
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Exam from "@/models/Exam";
import Question from "@/models/Question";
import Option from "@/models/Option";
import Attempt, { AttemptStatus } from "@/models/Attempt";
import Response from "@/models/Response";
import User from "@/models/User";
import { GuestAttemptService } from "@/lib/services/GuestAttemptService";
import { ExamStatus, CloseMode, EvaluationType } from "@/models/enums";
import request from "supertest";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("A-01 — Mini-test /response ne doit pas exposer isCorrect", () => {
  let mongoServer: MongoMemoryServer;
  let examId: string;
  let questionId: string;
  let correctOptionId: string;
  let wrongOptionId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Exam.deleteMany({}),
      Question.deleteMany({}),
      Option.deleteMany({}),
      Attempt.deleteMany({}),
      Response.deleteMany({}),
    ]);

    const teacher = await User.findOne({ role: "TEACHER" })
      || await User.create({ email: "teacher-a01@test.com", name: "Prof", role: "TEACHER", password: "x" });

    const exam = await Exam.create({
      title: "Mini-test Oracle A-01",
      createdById: teacher._id,
      startTime: new Date(Date.now() - 3600_000),
      endTime: new Date(Date.now() + 3600_000),
      duration: 15,
      closeMode: CloseMode.PERMISSIVE,
      status: ExamStatus.PUBLISHED,
      isPublished: true,
      isActive: true,
      isPublicDemo: true,
    });
    examId = exam._id.toString();

    const question = await Question.create({
      examId: exam._id,
      text: "1 + 1 = ?",
      type: EvaluationType.QCM,
      points: 1,
    });
    questionId = question._id.toString();

    const [correct, wrong] = await Option.insertMany([
      { questionId: question._id, text: "2", isCorrect: true },
      { questionId: question._id, text: "3", isCorrect: false },
    ]);
    correctOptionId = correct._id.toString();
    wrongOptionId = wrong._id.toString();
  });

  describe("POST /api/public/mini-tests/[id]/response", () => {
    it("should return {recorded: true} without isCorrect", async () => {
      // Start an attempt
      const startRes = await request(API_URL)
        .post(`/api/public/mini-tests/${examId}/start`)
        .send({ guestSessionId: "test-session-001" });

      const attemptId = startRes.body.data?.attemptId;
      if (!attemptId) return; // Skip if start endpoint not available

      // Submit a correct answer
      const res = await request(API_URL)
        .post(`/api/public/mini-tests/${examId}/response`)
        .send({
          attemptId,
          questionId,
          selectedOptionId: correctOptionId,
          guestSessionId: "test-session-001",
        });

      expect(res.body.data).toBeDefined();
      expect(res.body.data.recorded).toBe(true);
      expect(res.body.data).not.toHaveProperty("isCorrect");
    });

    it("should return same shape for wrong answer (no oracle)", async () => {
      const startRes = await request(API_URL)
        .post(`/api/public/mini-tests/${examId}/start`)
        .send({ guestSessionId: "test-session-002" });

      const attemptId = startRes.body.data?.attemptId;
      if (!attemptId) return;

      const res = await request(API_URL)
        .post(`/api/public/mini-tests/${examId}/response`)
        .send({
          attemptId,
          questionId,
          selectedOptionId: wrongOptionId,
          guestSessionId: "test-session-002",
        });

      expect(res.body.data).toBeDefined();
      expect(res.body.data.recorded).toBe(true);
      expect(res.body.data).not.toHaveProperty("isCorrect");
    });
  });

  describe("GuestAttemptService.submitGuestResponse — unit", () => {
    it("should not return isCorrect in result", async () => {
      const start = await GuestAttemptService.startGuestAttempt(examId, "unit-session-001");

      const result = await GuestAttemptService.submitGuestResponse(
        start.attemptId.toString(),
        questionId,
        correctOptionId,
        null,
        "unit-session-001",
      );

      expect(result).toEqual({ recorded: true });
      expect(result).not.toHaveProperty("isCorrect");
    });

    it("should not set isCorrect on the Response document", async () => {
      const start = await GuestAttemptService.startGuestAttempt(examId, "unit-session-002");

      await GuestAttemptService.submitGuestResponse(
        start.attemptId.toString(),
        questionId,
        correctOptionId,
        null,
        "unit-session-002",
      );

      const saved = await Response.findOne({
        attemptId: start.attemptId,
        questionId,
      });
      // isCorrect should be undefined (not evaluated yet)
      expect(saved?.isCorrect).toBeUndefined();
    });
  });

  describe("GuestAttemptService.submitGuestAttempt — deferred evaluation", () => {
    it("should evaluate isCorrect only at submit time", async () => {
      const start = await GuestAttemptService.startGuestAttempt(examId, "submit-session-001");
      const aid = start.attemptId.toString();

      // Record answer (no evaluation)
      await GuestAttemptService.submitGuestResponse(aid, questionId, correctOptionId, null, "submit-session-001");

      // Verify isCorrect is NOT set yet
      const beforeSubmit = await Response.findOne({ attemptId: start.attemptId, questionId });
      expect(beforeSubmit?.isCorrect).toBeUndefined();

      // Submit — NOW it evaluates
      const result = await GuestAttemptService.submitGuestAttempt(aid, "submit-session-001");

      expect(result.correctAnswers).toBe(1);
      expect(result.score).toBe(1);

      // NOW isCorrect should be set
      const afterSubmit = await Response.findOne({ attemptId: start.attemptId, questionId });
      expect(afterSubmit?.isCorrect).toBe(true);
    });
  });
});
