import Invitation from "@/models/Invitation";

import {
    describe,
    expect,
    it,
} from "@jest/globals";

import request from "supertest";
import User from "@/models/User";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("Invitation validation", () => {
    it("should reject invalid token", async () => {
        const response = await request(API_URL)
            .post("/api/parent/auth/register")
            .send({
                invitationToken: "BAD_TOKEN",
                name: "John",
                email: "john@test.com",
                password: "Password123!",
                language: "en",
            })
            .expect(400);

        expect(response.body.code)
            .toBe("INV_001");
    });

    it("should reject expired invitation", async () => {
        await Invitation.deleteMany({});

        await Invitation.create({
            token: "EXPIRED",
            status: "PENDING",
            expiresAt: new Date(Date.now() - 1000),
        });

        await request(API_URL)
            .post("/api/parent/auth/register")
            .send({
                invitationToken: "EXPIRED",
                name: "John",
                email: "john@test.com",
                password: "Password123!",
                language: "en",
            })
            .expect(400);
    });
});

describe("Existing Email", () => {
it("should reject already registered email", async () => {
    await User.create({
        email: "john@test.com",
        password: "xxx",
        role: "PARENT",
    });

    const response = await request(API_URL)
        .post("/api/parent/auth/register")
        .send({
            invitationToken: "VALID_TOKEN",
            name: "John",
            email: "john@test.com",
            password: "Password123!",
            language: "en",
        })
        .expect(409);

    expect(response.body.message)
        .toContain("already registered");
    });
});

describe("Validation", () => {
    it("should reject missing email", async () => {
        await request(API_URL)
            .post("/api/parent/auth/register")
            .send({
                invitationToken: "VALID_TOKEN",
                password: "Password123!",
            })
            .expect(400);
    });

    it("should reject invalid email", async () => {
        await request(API_URL)
            .post("/api/parent/auth/register")
            .send({
                invitationToken: "VALID_TOKEN",
                email: "invalid-email",
                password: "Password123!",
            })
            .expect(400);
    });

    it("should reject weak password", async () => {
        await request(API_URL)
            .post("/api/parent/auth/register")
            .send({
                invitationToken: "VALID_TOKEN",
                email: "john@test.com",
                password: "123",
            })
            .expect(400);
    });
});