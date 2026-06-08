import User from "@/models/User";
import ParentProfile from "@/models/ParentProfile";

import {
    afterAll,
    beforeAll,
    beforeEach
} from "@jest/globals";

import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcryptjs";

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

beforeAll(async () => {
    await mongoose.connect(process.env.TEST_DATABASE_URL! || "mongodb://localhost:27017/Xkorienta-test");
});

afterAll(async () => {
    await mongoose.connection.close();
});
beforeEach(async () => {
    await User.deleteMany({});
    await ParentProfile.deleteMany({});

    const password =
        await bcrypt.hash("Password123!", 12);

    const user = await User.create({
        name: "John",
        email: "john@test.com",
        password,
        role: "PARENT",
        isActive: true,
    });

    await ParentProfile.create({
        user: user._id,
        kycLevel: 0,
    });
});

describe("Successful login", () => {
    it("should return access token", async () => {
        const response = await request(API_URL)
            .post("/api/parent/auth/login")
            .send({
                email: "john@test.com",
                password: "Password123!",
            })
            .expect(200);

        expect(response.body.data)
            .toHaveProperty("accessToken");

        expect(response.body.data)
            .toHaveProperty("refreshToken");
    });
});