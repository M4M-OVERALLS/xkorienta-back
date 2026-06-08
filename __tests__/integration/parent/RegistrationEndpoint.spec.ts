import User from "@/models/User";
import Invitation from "@/models/Invitation";
import ParentProfile from "@/models/ParentProfile";

import {
    beforeAll,
    afterAll,
    beforeEach,
    describe,
    expect,
    it,
} from "@jest/globals";

import mongoose from "mongoose";
import request from "supertest";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

describe("POST /api/parent/auth/register", () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.TEST_DATABASE_URL! || "mongodb://localhost:27017/Xkorienta-test");
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Invitation.deleteMany({});
        await ParentProfile.deleteMany({});

        await Invitation.create({
            token: "VALID_TOKEN",
            status: "PENDING",
            expiresAt: new Date(Date.now() + 86400000),
        });
    });

    describe("Successful registration", () => {
        it("should create user and parent profile", async () => {
            const response = await request(API_URL)
                .post("/api/parent/auth/register")
                .send({
                    invitationToken: "VALID_TOKEN",
                    name: "John Doe",
                    email: "john@test.com",
                    password: "Password123!",
                    language: "en",
                })
                .expect(201);

            expect(response.body.data.email)
                .toBe("john@test.com");

            const user = await User.findOne({
                email: "john@test.com",
            });

            expect(user).not.toBeNull();

            const invitation =
                await Invitation.findOne({
                    token: "VALID_TOKEN",
                });

            expect(invitation?.status)
                .toBe("ACCEPTED");
        });
    });
});