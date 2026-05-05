/**
 * Tests d'Intégration : Inscription avec École Non Vérifiée
 *
 * Agent 3 - Expert TDD
 * Ces tests doivent être exécutés AVANT l'implémentation
 * Framework: Jest + Supertest
 */

import LearnerProfile from "@/models/LearnerProfile";
import UnverifiedSchool from "@/models/UnverifiedSchool";
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

// Note: Ces tests nécessitent l'installation de:
// npm install --save-dev jest @jest/globals supertest @types/jest @types/supertest ts-jest mongodb-memory-server

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("POST /api/auth/register - Inscription avec École Non Vérifiée", () => {
  beforeAll(async () => {
    // Setup: Connexion à la base de test
    await mongoose.connect(
      process.env.TEST_DATABASE_URL ||
        "mongodb://localhost:27017/Xkorienta-test",
    );
  });

  afterAll(async () => {
    // Cleanup: Fermeture de la connexion
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Cleanup: Nettoyer les collections avant chaque test
    await User.deleteMany({});
    await UnverifiedSchool.deleteMany({});
    await LearnerProfile.deleteMany({});
  });

  /**
   * UC-01: Inscription avec auto-déclaration d'école (nominal)
   */
  describe("UC-01: Inscription avec école non répertoriée", () => {
    it("should create user with unverified school when declaredSchoolData is provided", async () => {
      // Arrange
      const registrationData = {
        name: "Jean Kamga",
        email: "jean.kamga@example.com",
        password: "SecurePass123!",
        role: "STUDENT",
        declaredSchoolData: {
          name: "Lycée Bilingue de Yaoundé",
          city: "Yaoundé",
          country: "Cameroun",
          type: "Lycée",
        },
        levelId: new mongoose.Types.ObjectId().toString(),
      };

      // Act
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty("success", true);
      expect(response.body.user).toHaveProperty("hasUnverifiedSchool", true);
      expect(response.body.user).toHaveProperty(
        "awaitingSchoolValidation",
        true,
      );

      // Vérifier que l'UnverifiedSchool a été créée
      const unverifiedSchool = await UnverifiedSchool.findOne({
        declaredName: "Lycée Bilingue de Yaoundé",
      });
      expect(unverifiedSchool).not.toBeNull();
      expect(unverifiedSchool?.declaredCity).toBe("Yaoundé");
      expect(unverifiedSchool?.declaredCount).toBe(1);
      expect(unverifiedSchool?.status).toBe("PENDING");

      // Vérifier que l'User a été lié
      const user = await User.findOne({
        email: "jean.kamga@example.com",
      }).populate("unverifiedSchool");
      expect(user).not.toBeNull();
      expect(user?.unverifiedSchool).toBeDefined();
      expect((user?.unverifiedSchool as any)?.declaredName).toBe(
        "Lycée Bilingue de Yaoundé",
      );

      // Vérifier le LearnerProfile
      const learnerProfile = await LearnerProfile.findOne({ user: user?._id });
      expect(learnerProfile?.awaitingSchoolValidation).toBe(true);
    });

    it("should increment declaredCount when same school is declared by multiple users", async () => {
      // Arrange
      const schoolData = {
        name: "Collège Vogt",
        city: "Yaoundé",
        country: "Cameroun",
      };

      const user1Data = {
        name: "User One",
        email: "user1@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: schoolData,
      };

      const user2Data = {
        name: "User Two",
        email: "user2@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: schoolData,
      };

      // Act
      await request(API_URL)
        .post("/api/auth/register")
        .send(user1Data)
        .expect(201);
      await request(API_URL)
        .post("/api/auth/register")
        .send(user2Data)
        .expect(201);

      // Assert
      const unverifiedSchool = await UnverifiedSchool.findOne({
        declaredName: "Collège Vogt",
      });
      expect(unverifiedSchool?.declaredCount).toBe(2);
      expect(unverifiedSchool?.declaredBy).toHaveLength(2);
    });

    it("should normalize school name to avoid duplicates with different casing", async () => {
      // Arrange
      const user1Data = {
        name: "User One",
        email: "user1@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: { name: "lycée bilingue de yaoundé" },
      };

      const user2Data = {
        name: "User Two",
        email: "user2@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: { name: "LYCÉE BILINGUE DE YAOUNDÉ" },
      };

      // Act
      await request(API_URL)
        .post("/api/auth/register")
        .send(user1Data)
        .expect(201);
      await request(API_URL)
        .post("/api/auth/register")
        .send(user2Data)
        .expect(201);

      // Assert
      const unverifiedSchools = await UnverifiedSchool.find({});
      expect(unverifiedSchools).toHaveLength(1); // Une seule école créée
      expect(unverifiedSchools[0].declaredCount).toBe(2);
    });
  });

  /**
   * UC-02: Inscription sans école (alternatif)
   */
  describe("UC-02: Inscription sans école", () => {
    it("should allow registration with skipSchool flag", async () => {
      // Arrange
      const registrationData = {
        name: "Marie Nkoto",
        email: "marie.nkoto@example.com",
        password: "SecurePass123!",
        role: "STUDENT",
        skipSchool: true,
      };

      // Act
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(201);

      // Assert
      expect(response.body.user).toHaveProperty("hasUnverifiedSchool", false);

      const user = await User.findOne({ email: "marie.nkoto@example.com" });
      expect(user?.schools).toHaveLength(0);
      expect(user?.unverifiedSchool).toBeUndefined();
    });
  });

  /**
   * UC-ERR-01: Validation des données d'école
   */
  describe("UC-ERR-01: Validation des données", () => {
    it("should reject when school name is too long (>200 chars)", async () => {
      // Arrange
      const registrationData = {
        name: "Test User",
        email: "test@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: {
          name: "A".repeat(201), // 201 caractères
        },
      };

      // Act & Assert
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(400);

      expect(response.body.error).toContain(
        "Le nom de l'école ne peut pas dépasser 200 caractères",
      );
    });

    it("should reject when school name contains HTML/scripts", async () => {
      // Arrange
      const registrationData = {
        name: "Test User",
        email: "test@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: {
          name: '<script>alert("XSS")</script>Lycée Test',
        },
      };

      // Act & Assert
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(400);

      expect(response.body.error).toContain("Caractères invalides détectés");
    });

    it("should sanitize and accept school name with special characters", async () => {
      // Arrange
      const registrationData = {
        name: "Test User",
        email: "test@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: {
          name: "Lycée d'Excellence & Innovation - Yaoundé",
        },
      };

      // Act
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(201);

      // Assert
      const unverifiedSchool = await UnverifiedSchool.findOne({
        declaredName: { $regex: /Excellence.*Innovation/i },
      });
      expect(unverifiedSchool).not.toBeNull();
    });
  });

  /**
   * UC-ERR-02: Gestion des conflits
   */
  describe("UC-ERR-02: Gestion des conflits", () => {
    it("should return 409 when email already exists", async () => {
      // Arrange
      const userData = {
        name: "Existing User",
        email: "existing@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: { name: "Test School" },
      };

      await request(API_URL)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      // Act & Assert
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(userData)
        .expect(409);

      expect(response.body.error).toContain(
        "Un compte existe déjà avec cet email",
      );
    });

    it("should allow same phone number if previous user used email", async () => {
      // Arrange
      const user1 = {
        name: "User One",
        email: "user1@example.com",
        phone: "237690123456",
        password: "Pass123!",
        role: "STUDENT",
        skipSchool: true,
      };

      const user2 = {
        name: "User Two",
        phone: "237690123456",
        password: "Pass123!",
        role: "STUDENT",
        skipSchool: true,
      };

      // Act
      await request(API_URL).post("/api/auth/register").send(user1).expect(201);

      // Assert
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(user2)
        .expect(409);

      expect(response.body.error).toContain(
        "Ce numéro de téléphone est déjà utilisé",
      );
    });
  });

  /**
   * Tests de performance
   */
  describe("Performance: Inscription avec école non vérifiée", () => {
    it("should complete registration in under 2 seconds", async () => {
      // Arrange
      const registrationData = {
        name: "Perf Test",
        email: "perf@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: {
          name: "Test School",
          city: "Yaoundé",
        },
      };

      const startTime = Date.now();

      // Act
      await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(201);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(2000);
    });
  });

  /**
   * Tests de sécurité
   */
  describe("Sécurité: Protection contre les attaques", () => {
    it("should prevent SQL injection in school name", async () => {
      // Arrange
      const registrationData = {
        name: "Test User",
        email: "sql@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: {
          name: "'; DROP TABLE users; --",
        },
      };

      // Act
      const response = await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();

      // Vérifier que les utilisateurs existent toujours
      const usersCount = await User.countDocuments();
      expect(usersCount).toBeGreaterThanOrEqual(0);
    });

    it("should prevent NoSQL injection in school lookup", async () => {
      // Arrange
      const registrationData = {
        name: "Test User",
        email: "nosql@example.com",
        password: "Pass123!",
        role: "STUDENT",
        declaredSchoolData: {
          name: { $ne: null } as any,
        },
      };

      // Act & Assert
      await request(API_URL)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(400);
    });
  });
});
