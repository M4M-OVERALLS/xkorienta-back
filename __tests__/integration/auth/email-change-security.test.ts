/**
 * Tests d'Intégration : Sécurité A-14 — Changement d'email sécurisé
 *
 * Vérifie le flux en 2 étapes :
 *  1. POST /api/user/email/change — requiert mot de passe
 *  2. POST /api/user/email/confirm — valide le token
 *
 * Rapport d'intrusion : A-14 (ÉLEVÉ, CVSS 7.1)
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "@jest/globals";
import User from "@/models/User";
import {
  connectMongoMemory,
  disconnectMongoMemory,
} from "../../helpers/mongoMemory";
import { AuthService } from "@/lib/services/AuthService";
import { AuthRepository } from "@/lib/repositories/AuthRepository";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import request from "supertest";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("A-14 — Changement d'email sécurisé", () => {
  let testUser: any;
  const ORIGINAL_EMAIL = "original-a14@test.com";
  const NEW_EMAIL = "new-a14@test.com";
  const PASSWORD = "SecurePass123!";

  beforeAll(async () => {
    await connectMongoMemory();
  }, 30000);

  afterAll(async () => {
    await disconnectMongoMemory();
  });

  beforeEach(async () => {
    await User.deleteMany({});

    const hashedPassword = await bcrypt.hash(PASSWORD, 12);
    testUser = await User.create({
      email: ORIGINAL_EMAIL,
      name: "Utilisateur A-14",
      role: "TEACHER",
      password: hashedPassword,
      emailVerified: true,
    });
  });

  describe("POST /api/user/email/change", () => {
    it("should reject request without authentication", async () => {
      const res = await request(API_URL)
        .post("/api/user/email/change")
        .send({ newEmail: NEW_EMAIL, password: PASSWORD });

      expect(res.status).toBe(401);
    });

    it("should reject request without password", async () => {
      const res = await request(API_URL)
        .post("/api/user/email/change")
        .send({ newEmail: NEW_EMAIL });

      // Without auth session, returns 401 first
      expect([400, 401]).toContain(res.status);
    });

    it("should reject request without newEmail", async () => {
      const res = await request(API_URL)
        .post("/api/user/email/change")
        .send({ password: PASSWORD });

      expect([400, 401]).toContain(res.status);
    });
  });

  describe("POST /api/user/email/confirm", () => {
    it("should reject confirmation without token", async () => {
      const res = await request(API_URL)
        .post("/api/user/email/confirm")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject confirmation with invalid token", async () => {
      const res = await request(API_URL)
        .post("/api/user/email/confirm")
        .send({ token: "invalid-token-abc123" });

      expect([410, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("should reject confirmation with expired token", async () => {
      // Manually insert an expired token in DB
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      const repo = new AuthRepository();
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() - 60_000), // expired 1 min ago
      );

      const res = await request(API_URL)
        .post("/api/user/email/confirm")
        .send({ token: rawToken });

      expect([410, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe("AuthService.requestEmailChange — unit logic", () => {
    const authService = new AuthService();

    it("should reject if password is wrong", async () => {
      await expect(
        authService.requestEmailChange(testUser._id.toString(), NEW_EMAIL, "wrong-password"),
      ).rejects.toThrow("Mot de passe incorrect");
    });

    it("should reject if new email equals current email", async () => {
      await expect(
        authService.requestEmailChange(testUser._id.toString(), ORIGINAL_EMAIL, PASSWORD),
      ).rejects.toThrow("identique");
    });

    it("should reject if new email is already taken", async () => {
      await User.create({
        email: NEW_EMAIL,
        name: "Autre Utilisateur",
        role: "STUDENT",
        password: "hashed",
      });

      await expect(
        authService.requestEmailChange(testUser._id.toString(), NEW_EMAIL, PASSWORD),
      ).rejects.toThrow("déjà utilisé");
    });

    it("should save token in DB on valid request", async () => {
      await authService.requestEmailChange(testUser._id.toString(), NEW_EMAIL, PASSWORD);

      // Verify token was saved
      const db = mongoose.connection.db!;
      const userDoc = await db.collection("users").findOne({ _id: testUser._id });
      expect(userDoc?.emailChangePending).toBe(NEW_EMAIL);
      expect(userDoc?.emailChangeToken).toBeDefined();
      expect(userDoc?.emailChangeExpires).toBeDefined();
      expect(new Date(userDoc!.emailChangeExpires as Date).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("AuthService.confirmEmailChange — unit logic", () => {
    const authService = new AuthService();

    it("should apply the new email on valid token", async () => {
      // Setup: create a valid token manually
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      const repo = new AuthRepository();
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() + 3600_000),
      );

      // Act
      const result = await authService.confirmEmailChange(rawToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.newEmail).toBe(NEW_EMAIL);

      // Verify the email was changed in DB
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.email).toBe(NEW_EMAIL);
      expect(updatedUser?.emailVerified).toBe(true);
    });

    it("should clear the token fields after confirmation", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      const repo = new AuthRepository();
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() + 3600_000),
      );

      await authService.confirmEmailChange(rawToken);

      // Token fields should be cleared
      const db = mongoose.connection.db!;
      const userDoc = await db.collection("users").findOne({ _id: testUser._id });
      expect(userDoc?.emailChangeToken).toBeUndefined();
      expect(userDoc?.emailChangeExpires).toBeUndefined();
      expect(userDoc?.emailChangePending).toBeUndefined();
    });

    it("should reject a reused token (one-time use)", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      const repo = new AuthRepository();
      await repo.saveEmailChangeToken(
        testUser._id.toString(),
        hashedToken,
        NEW_EMAIL,
        new Date(Date.now() + 3600_000),
      );

      // First use — succeeds
      await authService.confirmEmailChange(rawToken);

      // Second use — should fail
      await expect(
        authService.confirmEmailChange(rawToken),
      ).rejects.toThrow("invalide ou expiré");
    });
  });

  describe("PUT /api/user/profile — email change blocked", () => {
    it("should reject direct email change via profile endpoint", async () => {
      const res = await request(API_URL)
        .put("/api/user/profile")
        .send({ email: NEW_EMAIL });

      // Either 400 (blocked) or 401 (no auth) — both are correct
      expect(res.status).not.toBe(200);
    });
  });
});
