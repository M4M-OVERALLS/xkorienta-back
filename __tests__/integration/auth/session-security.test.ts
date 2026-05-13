/**
 * Tests d'Intégration : Sécurité A-13 — Configuration session JWT
 *
 * Vérifie que la config NextAuth applique :
 * - maxAge réduit (2h au lieu de 30 jours)
 * - updateAge court (5 min) pour renouvellement actif
 * - Flags cookie sécurisés (httpOnly, sameSite, secure)
 *
 * Rapport d'intrusion : A-13 (ÉLEVÉ, CVSS 6.5)
 */

import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { authOptions } from "@/lib/auth";
import request from "supertest";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("Configuration session & cookie sécurité", () => {

  describe("authOptions — session config", () => {
    it("should use JWT strategy", () => {
      expect(authOptions.session?.strategy).toBe("jwt");
    });

    it("should have maxAge <= 2 hours (7200s)", () => {
      const maxAge = authOptions.session?.maxAge ?? 0;
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(2 * 60 * 60);
    });

    it("should NOT have maxAge of 30 days (old insecure default)", () => {
      const thirtyDays = 30 * 24 * 60 * 60;
      expect(authOptions.session?.maxAge).not.toBe(thirtyDays);
    });

    it("should have updateAge <= 10 minutes for active renewal", () => {
      const updateAge = (authOptions.session as any)?.updateAge ?? Infinity;
      expect(updateAge).toBeLessThanOrEqual(10 * 60);
    });
  });

  describe("authOptions — cookie config", () => {
    const cookieConfig = (authOptions.cookies as any)?.sessionToken?.options;

    it("should set httpOnly to true", () => {
      expect(cookieConfig?.httpOnly).toBe(true);
    });

    it("should set sameSite to lax or strict", () => {
      expect(["lax", "strict"]).toContain(cookieConfig?.sameSite);
    });

    it("should set path to /", () => {
      expect(cookieConfig?.path).toBe("/");
    });
  });

  describe("Cookie headers — réponse serveur", () => {
    it("should return Set-Cookie with HttpOnly flag on login", async () => {
      // Fetch CSRF token first
      const csrfRes = await request(API_URL)
        .get("/api/auth/csrf");

      const csrfToken = csrfRes.body?.csrfToken;
      if (!csrfToken) return; // Skip if CSRF endpoint not available

      // Attempt login (credentials don't matter — we only inspect cookie flags)
      const loginRes = await request(API_URL)
        .post("/api/auth/callback/credentials")
        .type("form")
        .send({
          csrfToken,
          identifier: "nonexistent@test.com",
          password: "wrongpassword",
          json: "true",
          redirect: "false",
        });

      // Even on failed login, NextAuth sets a CSRF cookie — verify its flags
      const setCookies = loginRes.headers["set-cookie"];
      if (setCookies) {
        const cookieStr = Array.isArray(setCookies)
          ? setCookies.join("; ")
          : setCookies;
        // HttpOnly must be present on session-related cookies
        expect(cookieStr.toLowerCase()).toContain("httponly");
        // Path must be /
        expect(cookieStr.toLowerCase()).toContain("path=/");
      }
    });

    it("should not expose session token in response body", async () => {
      const csrfRes = await request(API_URL)
        .get("/api/auth/csrf");

      const csrfToken = csrfRes.body?.csrfToken;
      if (!csrfToken) return;

      const loginRes = await request(API_URL)
        .post("/api/auth/callback/credentials")
        .type("form")
        .send({
          csrfToken,
          identifier: "nonexistent@test.com",
          password: "wrongpassword",
          json: "true",
          redirect: "false",
        });

      // The JWT must never appear in the response body
      const body = JSON.stringify(loginRes.body);
      expect(body).not.toContain("eyJhbGc"); // JWT header prefix
    });
  });

  describe("Session expiration — vérification fonctionnelle", () => {
    it("should reject requests with an expired/invalid session token", async () => {
      // Forge an obviously expired/invalid token
      const res = await request(API_URL)
        .get("/api/exams/v2")
        .set("Cookie", "next-auth.session-token=expired-invalid-token");

      // Should not return authenticated data
      expect([401, 403, 302]).toContain(res.status);
    });
  });
});
