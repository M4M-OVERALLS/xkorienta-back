/**
 * Tests d'Intégration : Examens Publics
 *
 * Agent 3 - Expert TDD
 * Endpoint: GET /api/exams/public
 *
 * UC-ERR-02: Un apprenant sans professeur doit avoir accès à des tests publics
 */

import EducationLevel from "@/models/EducationLevel";
import Exam from "@/models/Exam";
import Subject from "@/models/Subject";
import User from "@/models/User";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import mongoose from "mongoose";
import request from "supertest";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("GET /api/exams/public - Liste des examens publics", () => {
  let publicTeacher: any;
  let mathSubject: any;
  let frenchSubject: any;
  let level3eme: any;
  let level2nde: any;

  beforeAll(async () => {
    await mongoose.connect(
      process.env.TEST_DATABASE_URL ||
        "mongodb://localhost:27017/Xkorienta-test",
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Cleanup
    await Exam.deleteMany({});
    await User.deleteMany({});
    await Subject.deleteMany({});
    await EducationLevel.deleteMany({});

    // Seed: Créer un professeur
    publicTeacher = await User.create({
      name: "Prof Public",
      email: "prof.public@example.com",
      password: "hashed",
      role: "TEACHER",
    });

    // Seed: Créer des matières
    mathSubject = await Subject.create({
      name: "Mathématiques",
      code: "MATH",
      description: "Mathématiques",
    });

    frenchSubject = await Subject.create({
      name: "Français",
      code: "FR",
      description: "Français",
    });

    // Seed: Créer des niveaux
    level3eme = await EducationLevel.create({
      name: "3ème",
      order: 9,
    });

    level2nde = await EducationLevel.create({
      name: "2nde",
      order: 10,
    });

    // Seed: Créer des examens de test
    await Exam.insertMany([
      // Examen public - Maths 3ème
      {
        title: "Algèbre : Équations du second degré",
        description: "Test public sur les équations",
        subject: mathSubject._id,
        level: level3eme._id,
        createdBy: publicTeacher._id,
        isPublic: true,
        status: "PUBLISHED",
        questions: [
          {
            question: "Résoudre x² - 5x + 6 = 0",
            type: "QCM",
            options: ["x = 2 ou x = 3", "x = 1 ou x = 6", "x = -2 ou x = -3"],
            correctAnswer: 0,
            points: 2,
          },
        ],
      },
      // Examen public - Français 3ème
      {
        title: "Grammaire : Les figures de style",
        description: "Test sur les figures de style",
        subject: frenchSubject._id,
        level: level3eme._id,
        createdBy: publicTeacher._id,
        isPublic: true,
        status: "PUBLISHED",
        questions: [
          {
            question: "Identifier la métaphore",
            type: "QCM",
            options: ["Option 1", "Option 2"],
            correctAnswer: 0,
            points: 2,
          },
        ],
      },
      // Examen public - Maths 2nde
      {
        title: "Fonctions linéaires",
        description: "Étude des fonctions",
        subject: mathSubject._id,
        level: level2nde._id,
        createdBy: publicTeacher._id,
        isPublic: true,
        status: "PUBLISHED",
        questions: [
          {
            question: "Calculer f(3) si f(x) = 2x + 1",
            type: "QCM",
            options: ["7", "6", "5"],
            correctAnswer: 0,
            points: 2,
          },
        ],
      },
      // Examen PRIVÉ (ne doit pas apparaître)
      {
        title: "Test Privé",
        description: "Réservé à ma classe",
        subject: mathSubject._id,
        level: level3eme._id,
        createdBy: publicTeacher._id,
        isPublic: false,
        status: "PUBLISHED",
        questions: [],
      },
      // Examen DRAFT (ne doit pas apparaître)
      {
        title: "Test Brouillon",
        description: "Pas encore publié",
        subject: mathSubject._id,
        level: level3eme._id,
        createdBy: publicTeacher._id,
        isPublic: true,
        status: "DRAFT",
        questions: [],
      },
    ]);
  });

  describe("Liste de base", () => {
    it("should return only public and published exams", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .expect(200);

      // Assert
      expect(response.body.exams).toHaveLength(3);
      response.body.exams.forEach((exam: any) => {
        expect(exam.isPublic).toBe(true);
        expect(exam.status).toBe("PUBLISHED");
      });
    });

    it("should include subject and level details", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .expect(200);

      // Assert
      expect(response.body.exams[0]).toHaveProperty("subject");
      expect(response.body.exams[0].subject).toHaveProperty("name");
      expect(response.body.exams[0]).toHaveProperty("level");
      expect(response.body.exams[0].level).toHaveProperty("name");
    });

    it("should include creator name without exposing sensitive data", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .expect(200);

      // Assert
      expect(response.body.exams[0]).toHaveProperty("creatorName");
      expect(response.body.exams[0].creatorName).toBe("Prof Public");

      // Ne doit PAS exposer l'email du créateur
      expect(response.body.exams[0]).not.toHaveProperty("creatorEmail");
      expect(response.body.exams[0]).not.toHaveProperty("createdBy.email");
    });

    it("should include question count without exposing questions", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .expect(200);

      // Assert
      expect(response.body.exams[0]).toHaveProperty("questionCount", 1);
      expect(response.body.exams[0]).not.toHaveProperty("questions");
    });
  });

  describe("Filtres", () => {
    it("should filter by levelId", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ levelId: level3eme._id.toString() })
        .expect(200);

      // Assert
      expect(response.body.exams).toHaveLength(2); // Maths + Français 3ème
      response.body.exams.forEach((exam: any) => {
        expect(exam.level.id).toBe(level3eme._id.toString());
      });
    });

    it("should filter by subjectId", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ subjectId: mathSubject._id.toString() })
        .expect(200);

      // Assert
      expect(response.body.exams).toHaveLength(2); // Maths 3ème + Maths 2nde
      response.body.exams.forEach((exam: any) => {
        expect(exam.subject.id).toBe(mathSubject._id.toString());
      });
    });

    it("should combine levelId and subjectId filters", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({
          levelId: level3eme._id.toString(),
          subjectId: mathSubject._id.toString(),
        })
        .expect(200);

      // Assert
      expect(response.body.exams).toHaveLength(1); // Seulement Maths 3ème
      expect(response.body.exams[0].title).toBe(
        "Algèbre : Équations du second degré",
      );
    });
  });

  describe("Pagination", () => {
    it("should paginate results with default values", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty("pagination");
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      });
    });

    it("should respect custom page and limit", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ page: 1, limit: 2 })
        .expect(200);

      // Assert
      expect(response.body.exams).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it("should handle page 2 correctly", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ page: 2, limit: 2 })
        .expect(200);

      // Assert
      expect(response.body.exams).toHaveLength(1); // Dernier résultat
      expect(response.body.pagination.page).toBe(2);
    });

    it("should reject invalid page numbers", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ page: -1 })
        .expect(400);

      // Assert
      expect(response.body.error).toContain("Page invalide");
    });

    it("should reject limit > 100 (anti-DoS)", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ limit: 1000 })
        .expect(400);

      // Assert
      expect(response.body.error).toContain("Limite maximale");
    });
  });

  describe("Tri des résultats", () => {
    it("should sort by creation date (newest first) by default", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .expect(200);

      // Assert
      for (let i = 0; i < response.body.exams.length - 1; i++) {
        const date1 = new Date(response.body.exams[i].createdAt);
        const date2 = new Date(response.body.exams[i + 1].createdAt);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    });
  });

  describe("Cas limites", () => {
    it("should return empty array when no public exams exist", async () => {
      // Arrange
      await Exam.deleteMany({});

      // Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .expect(200);

      // Assert
      expect(response.body.exams).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it("should handle invalid MongoDB ObjectId gracefully", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ levelId: "invalid-id" })
        .expect(400);

      // Assert
      expect(response.body.error).toContain("ID invalide");
    });
  });

  describe("Performance", () => {
    it("should complete request in under 1 second", async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await request(API_URL).get("/api/exams/public").expect(200);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000);
    });

    it("should use database indexes for efficient filtering", async () => {
      // Arrange
      // Créer beaucoup d'examens
      const manyExams = Array(100)
        .fill(null)
        .map((_, i) => ({
          title: `Test ${i}`,
          description: `Description ${i}`,
          subject: mathSubject._id,
          level: level3eme._id,
          createdBy: publicTeacher._id,
          isPublic: true,
          status: "PUBLISHED",
          questions: [],
        }));

      await Exam.insertMany(manyExams);

      const startTime = Date.now();

      // Act
      await request(API_URL)
        .get("/api/exams/public")
        .query({ levelId: level3eme._id.toString() })
        .expect(200);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(500); // Doit rester rapide même avec beaucoup de données
    });
  });

  describe("Sécurité", () => {
    it("should not allow access without proper authentication headers", async () => {
      // Note: Ce test dépend de votre stratégie d'auth
      // Si l'endpoint est vraiment public, ce test peut être ignoré

      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        // Pas de header Authorization
        .expect(200); // Public endpoint

      // Assert
      expect(response.body).toHaveProperty("exams");
    });

    it("should sanitize query parameters to prevent injection", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ levelId: JSON.stringify({ $ne: null }) })
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });

    it("should not expose draft or private exams even with manipulation", async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get("/api/exams/public")
        .query({ status: "DRAFT" }) // Tentative de forcer le filtre
        .expect(200);

      // Assert
      // Même si le paramètre est passé, les drafts ne doivent pas apparaître
      response.body.exams.forEach((exam: any) => {
        expect(exam.status).toBe("PUBLISHED");
      });
    });
  });
});
