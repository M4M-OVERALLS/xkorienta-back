/**
 * Integration Test - Authentication Flow (XKT-001, 002)
 */

jest.mock('@/lib/mongodb', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}));

import mongoose from 'mongoose';
import User from '@/models/User';
import ParentProfile from '@/models/ParentProfile';
import Invitation from '@/models/Invitation';
import { randomBytes } from 'crypto';
import { POST as parentRegisterRoute } from '@/app/api/parent/auth/register/route';
import { POST as parentLoginRoute } from '@/app/api/parent/auth/login/route';
import {
    connectMongoMemory,
    disconnectMongoMemory,
} from '../../helpers/mongoMemory';
import {afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

const HOOK_TIMEOUT = 20000;
const TEST_TIMEOUT = 20000;

// Reusable dummy admin ID — satisfies the required createdBy field
const TEST_ADMIN_ID = new mongoose.Types.ObjectId();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a valid PENDING invitation in the DB.
 * Supplies all required schema fields: token, type, createdBy.
 * @param expiresInMs - positive = future, negative = already expired
 */
async function createInvitation(expiresInMs = 24 * 60 * 60 * 1000): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await Invitation.create({
        token,
        type: 'LINK',
        createdBy: TEST_ADMIN_ID,
        role: 'PARENT',
        status: 'PENDING',
        maxUses: 1,
        expiresAt: new Date(Date.now() + expiresInMs),
    });
    return token;
}

async function callParentRegister(body: Record<string, unknown>) {
    const res = await parentRegisterRoute(
        new Request('http://localhost/api/parent/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }) as any,
    );
    return { status: res.status, body: await res.json() };
}

async function callParentLogin(body: Record<string, unknown>) {
    const res = await parentLoginRoute(
        new Request('http://localhost/api/parent/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }) as any,
    );
    return { status: res.status, body: await res.json() };
}

/**
 * Register a parent using a freshly created invitation.
 * Accepts field overrides for negative-case tests.
 */
async function registerParent(overrides: Record<string, unknown> = {}) {
    const invitationToken = await createInvitation();
    return callParentRegister({
        invitationToken,
        name: 'Test Parent',
        email: 'test@example.com',
        password: 'TestPass123!',
        language: 'fr',
        ...overrides,
    });
}

beforeAll(async () => {
    await connectMongoMemory();
}, HOOK_TIMEOUT);

afterAll(async () => {
    await disconnectMongoMemory();
}, HOOK_TIMEOUT);

beforeEach(async () => {
    await Promise.all([
        User.deleteMany({}).maxTimeMS(8000),
        ParentProfile.deleteMany({}).maxTimeMS(8000),
        Invitation.deleteMany({}).maxTimeMS(8000),
    ]);
}, HOOK_TIMEOUT);

// ---------------------------------------------------------------------------
// XKT-001: Parent Registration
// ---------------------------------------------------------------------------

describe('Authentication Flow Integration Tests (XKT-001, 002)', () => {

    describe('XKT-001: Parent Registration', () => {

        it('should register parent successfully with valid invitation', async () => {
            const invitationToken = await createInvitation();

            const response = await callParentRegister({
                invitationToken,
                name: 'Jean-Paul Moussa',
                email: 'jean.moussa@email.cm',
                phone: '+237691234567',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('userId');
            expect(response.body.data).toHaveProperty('parentProfileId');
            expect(response.body.data.email).toBe('jean.moussa@email.cm');

            // Verify DB: user created with correct role
            const createdUser = await User.findOne({ email: 'jean.moussa@email.cm' });
            expect(createdUser).toBeDefined();
            expect(createdUser?.role).toBe('PARENT');

            // Verify DB: parent profile created with correct initial KYC state
            const createdProfile = await ParentProfile.findOne({ user: createdUser?._id });
            expect(createdProfile).toBeDefined();
            expect(createdProfile?.kycLevel).toBe(0);
            expect(createdProfile?.kycStatus).toBe('PENDING');
        }, TEST_TIMEOUT);

        it('should reject invalid invitation token (PAR_005)', async () => {
            const response = await callParentRegister({
                invitationToken: 'invalid-token-that-does-not-exist',
                name: 'Jean-Paul Moussa',
                email: 'jean.moussa@email.cm',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('PAR_005');
        }, TEST_TIMEOUT);

        it('should reject expired invitation token (PAR_005)', async () => {
            // negative expiresInMs → expiresAt is 24h in the past
            const expiredToken = await createInvitation(-24 * 60 * 60 * 1000);

            const response = await callParentRegister({
                invitationToken: expiredToken,
                name: 'Jean-Paul Moussa',
                email: 'jean.moussa@email.cm',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('PAR_005');
        }, TEST_TIMEOUT);

        it('should reject duplicate email (PAR_004)', async () => {
            // First registration — must succeed
            const res1 = await registerParent({
                name: 'Jean-Paul Moussa',
                email: 'jean.moussa@email.cm',
                password: 'SecurePass123!',
            });
            expect(res1.status).toBe(201);

            // Second registration with same email + fresh invitation token
            const invitationToken2 = await createInvitation();
            const res2 = await callParentRegister({
                invitationToken: invitationToken2,
                name: 'Another Parent',
                email: 'jean.moussa@email.cm',
                password: 'DifferentPass123!',
                language: 'fr',
            });

            expect(res2.status).toBe(409);
            expect(res2.body.error.code).toBe('PAR_004');
        }, TEST_TIMEOUT);

        it('should validate email format (VAL_001)', async () => {
            const invitationToken = await createInvitation();

            const response = await callParentRegister({
                invitationToken,
                name: 'Jean-Paul Moussa',
                email: 'invalid-email-format',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(response.status).toBe(400);
            // Controller uses VAL_001 for all Zod validation failures
            expect(response.body.error.code).toBe('VAL_001');
        }, TEST_TIMEOUT);

        it('should validate password minimum length (VAL_001)', async () => {
            const invitationToken = await createInvitation();

            const response = await callParentRegister({
                invitationToken,
                name: 'Jean-Paul Moussa',
                email: 'jean.moussa@email.cm',
                password: 'short',
                language: 'fr',
            });

            expect(response.status).toBe(400);
            // Controller uses VAL_001 for all Zod validation failures
            expect(response.body.error.code).toBe('VAL_001');
        }, TEST_TIMEOUT);

        it('should mark invitation as ACCEPTED after registration', async () => {
            const token = randomBytes(32).toString('hex');
            const invitation = await Invitation.create({
                token,
                type: 'LINK',
                createdBy: TEST_ADMIN_ID,
                role: 'PARENT',
                status: 'PENDING',
                maxUses: 1,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });

            const response = await callParentRegister({
                invitationToken: token,
                name: 'Jean-Paul Moussa',
                email: 'jean.moussa@email.cm',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(response.status).toBe(201);

            const updated = await Invitation.findById(invitation._id);
            expect(updated?.status).toBe('ACCEPTED');
        }, TEST_TIMEOUT);
    });

    // ---------------------------------------------------------------------------
    // XKT-002: Parent Login
    // ---------------------------------------------------------------------------

    describe('XKT-002: Parent Login', () => {

        // Register a parent before each login test
        beforeEach(async () => {
            const res = await registerParent({
                email: 'test@example.com',
                name: 'Test Parent',
                password: 'TestPass123!',
            });
            if (res.status !== 201) {
                throw new Error(
                    `Login test setup failed — registration returned ${res.status}: ${JSON.stringify(res.body)}`
                );
            }
        }, HOOK_TIMEOUT);

        it('should login successfully with valid credentials', async () => {
            const response = await callParentLogin({
                email: 'test@example.com',
                password: 'TestPass123!',
            });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
            expect(response.body.data.email).toBe('test@example.com');
            expect(response.body.data.kycLevel).toBe(0);
        }, TEST_TIMEOUT);

        it('should reject invalid password (PAR_002)', async () => {
            const response = await callParentLogin({
                email: 'test@example.com',
                password: 'WrongPassword123!',
            });

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('PAR_002');
        }, TEST_TIMEOUT);

        it('should reject non-existent user (PAR_001)', async () => {
            const response = await callParentLogin({
                email: 'nonexistent@example.com',
                password: 'TestPass123!',
            });

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('PAR_001');
        }, TEST_TIMEOUT);

        it('should return JWT with correct payload structure', async () => {
            const response = await callParentLogin({
                email: 'test@example.com',
                password: 'TestPass123!',
            });

            expect(response.status).toBe(200);
            const token = response.body.data.accessToken;

            // Decode without verifying signature — just check payload shape
            const decoded = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString()
            );

            expect(decoded).toHaveProperty('userId');
            expect(decoded).toHaveProperty('parentProfileId');
            expect(decoded.email).toBe('test@example.com');
            expect(decoded.role).toBe('PARENT');
            expect(decoded.kycLevel).toBe(0);
        }, TEST_TIMEOUT);
    });

    // ---------------------------------------------------------------------------
    // Complete Registration → Login Flow
    // ---------------------------------------------------------------------------

    describe('Complete Registration → Login Flow', () => {

        it('should complete full auth cycle: invite → register → login', async () => {
            // Step 1: Create invitation
            const invitationToken = await createInvitation();

            // Step 2: Register
            const registerResponse = await callParentRegister({
                invitationToken,
                name: 'Jean-Paul Moussa',
                email: 'jean.moussa@email.cm',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(registerResponse.status).toBe(201);
            const { parentProfileId } = registerResponse.body.data;

            // Step 3: Login
            const loginResponse = await callParentLogin({
                email: 'jean.moussa@email.cm',
                password: 'SecurePass123!',
            });

            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body.data.parentProfileId).toBe(parentProfileId);
            expect(loginResponse.body.data.accessToken).toBeDefined();

            // Step 4: Verify initial profile state in DB
            const profile = await ParentProfile.findById(parentProfileId);
            expect(profile?.kycLevel).toBe(0);
            // isActive is true — ParentProfileRepository.create() sets isActive: true
            expect(profile?.isActive).toBe(true);
        }, TEST_TIMEOUT);
    });
});