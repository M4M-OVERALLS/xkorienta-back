import { describe, it, expect, beforeEach } from '@jest/globals'
import {ParentAuthService} from "@/lib/services/ParentAuthService";
import {parentProfileRepository} from "@/lib/repositories/ParentProfileRepository";
import User from '@/models/User'
import ParentProfile from "@/models/ParentProfile";
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import mongoose from 'mongoose'
import request from "supertest";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("Validation", () => {
    it("should reject unknown email", async () => {
        await request(API_URL)
            .post("/api/parent/auth/login")
            .send({
                email: "unknown@test.com",
                password: "Password123!",
            })
            .expect(404);
    });
    it("should reject invalid password", async () => {
        const response = await request(API_URL)
            .post("/api/parent/auth/login")
            .send({
                email: "john@test.com",
                password: "WRONG_PASSWORD",
            })
            .expect(401);

        expect(response.body.message)
            .toContain("Invalid email or password");
    });
    it("should reject disabled account", async () => {
        await User.updateOne(
            { email: "john@test.com" },
            { isActive: false }
        );

        await request(API_URL)
            .post("/api/parent/auth/login")
            .send({
                email: "john@test.com",
                password: "Password123!",
            })
            .expect(403);
    });
    it("should reject disabled parent profile", async () => {
        await ParentProfile.updateOne(
            {},
            {
                accountDisabledAt: new Date(),
                accountDisabledReason: "Fraud detection",
            }
        );

        await request(API_URL)
            .post("/api/parent/auth/login")
            .send({
                email: "john@test.com",
                password: "Password123!",
            })
            .expect(403);
    });
    it("should reject empty body", async () => {
        await request(API_URL)
            .post("/api/parent/auth/login")
            .send({})
            .expect(400);
    });

    it("should reject invalid email", async () => {
        await request(API_URL)
            .post("/api/parent/auth/login")
            .send({
                email: "bad-email",
                password: "Password123!",
            })
            .expect(400);
    });
})



