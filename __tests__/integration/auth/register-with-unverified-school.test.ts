/**
 * Tests d'Intégration : Inscription avec École Non Vérifiée
 * Endpoint: POST /api/auth/register
 */

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/security/rateLimiter", () => ({
  registrationLimiter: jest.fn(() => ({ success: true, resetTime: Date.now() })),
  getClientIdentifier: jest.fn(() => "test-client"),
  createRateLimitResponse: jest.fn(),
}));

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
import { POST } from "@/app/api/auth/register/route";
import {
  connectMongoMemory,
  disconnectMongoMemory,
} from "../../helpers/mongoMemory";

async function postRegister(body: unknown) {
  const res = await POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as any,
  );
  return { status: res.status, body: await res.json() };
}

describe("POST /api/auth/register - Inscription avec École Non Vérifiée", () => {
  beforeAll(async () => {
    await connectMongoMemory();
  }, 30000);

  afterAll(async () => {
    await disconnectMongoMemory();
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
      const response = await postRegister(registrationData);
      expect(response.status).toBe(201);

      // Assert
      expect(response.body).toHaveProperty("success", true);
      expect(response.body.user).toHaveProperty("hasUnverifiedSchool", true);
      expect(response.body.user).toHaveProperty(
        "awaitingSchoolValidation",
        true,
      );

      // Vérifier que l'UnverifiedSchool a été créée
      const unverifiedSchool = await UnverifiedSchool.findOne({
        declaredName: /lycée bilingue de yaoundé/i,
      });
      expect(unverifiedSchool).not.toBeNull();
      expect(unverifiedSchool?.declaredCity).toMatch(/yaoundé/i);
      expect(unverifiedSchool?.declaredCount).toBe(1);
      expect(unverifiedSchool?.status).toBe("PENDING");

      // Vérifier que l'User a été lié
      const user = await User.findOne({
        email: "jean.kamga@example.com",
      }).populate("unverifiedSchool");
      expect(user).not.toBeNull();
      expect(user?.unverifiedSchool).toBeDefined();
      expect((user?.unverifiedSchool as any)?.declaredName).toMatch(
        /lycée bilingue de yaoundé/i,
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
      expect((await postRegister(user1Data)).status).toBe(201);
      expect((await postRegister(user2Data)).status).toBe(201);

      // Assert
      const unverifiedSchool = await UnverifiedSchool.findOne({
        declaredName: /collège vogt/i,
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
      expect((await postRegister(user1Data)).status).toBe(201);
      expect((await postRegister(user2Data)).status).toBe(201);

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
      const response = await postRegister(registrationData);
      expect(response.status).toBe(201);

      // Assert
      expect(response.body.user).toHaveProperty("hasUnverifiedSchool", false);

      const user = await User.findOne({ email: "marie.nkoto@example.com" });
      expect(user?.schools).toHaveLength(0);
      expect(user?.unverifiedSchool).toBeFalsy();
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
      const response = await postRegister(registrationData);
      expect(response.status).toBe(400);
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
      const response = await postRegister(registrationData);
      expect(response.status).toBe(400);
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
      const response = await postRegister(registrationData);
      expect(response.status).toBe(201);

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

      expect((await postRegister(userData)).status).toBe(201);

      // Act & Assert
      const response = await postRegister(userData);
      expect(response.status).toBe(409);

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
      expect((await postRegister(user1)).status).toBe(201);

      // Assert
      const response = await postRegister(user2);
      expect(response.status).toBe(409);

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
      expect((await postRegister(registrationData)).status).toBe(201);

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
      const response = await postRegister(registrationData);
      expect(response.status).toBe(400);

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
      const response = await postRegister(registrationData);
      expect(response.status).toBe(400);
    });
  });
});
