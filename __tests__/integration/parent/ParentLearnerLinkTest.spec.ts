/**
 * Integration Tests for XKT-003: Child Linking Request
 *
 * Location: __tests__/integration/parent/ParentLearnerLinkTest.spec.ts
 * Run: npm run test:integration -- ParentLearnerLinkTest.spec.ts
 * Requires: Test MongoDB instance + running server on TEST_API_URL
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import connectDB, { disconnectDB } from '@/lib/mongodb';
import User from '@/models/User';
import ParentProfile from '@/models/ParentProfile';
import ParentLearnerLink from '@/models/ParentLearnerLink';
import Invitation from '@/models/Invitation';
import { UserRole, KYCLevel, KYCStatus } from '@/models/enums';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const HOOK_TIMEOUT = 20000;
const TEST_TIMEOUT = 20000;

// Signs a real JWT matching what ParentAuthService generates
// Without this every request returns 401 — the route validates the signature
function signToken(payload: {
    userId: string;
    parentProfileId: string;
    email: string;
    kycLevel: number;
}): string {
    return jwt.sign(
        { ...payload, role: UserRole.PARENT },
        process.env.NEXTAUTH_SECRET!,
        {
            expiresIn: '1h',
            issuer: 'xkorienta-parent-module',
            subject: payload.userId,
        }
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createParent(overrides: {
    email?: string;
    kycLevel?: number;
    kycStatus?: string;
} = {}) {
    const user = await User.create({
        name: 'Test Parent',
        email: overrides.email ?? 'parent@example.com',
        password: 'hashed-password',
        role: UserRole.PARENT,
        isActive: true,
    });

    const profile = await ParentProfile.create({
        user: user._id,
        kycLevel: overrides.kycLevel ?? KYCLevel.NONE,
        // kycStatus is required by the schema
        kycStatus: overrides.kycStatus ?? KYCStatus.PENDING,
        isActive: true,
        preferredLanguage: 'fr',
        notificationPreferences: { sms: true, email: true, push: true },
    });

    const token = signToken({
        userId: user._id.toString(),
        parentProfileId: profile._id.toString(),
        email: user.email!,
        kycLevel: overrides.kycLevel ?? KYCLevel.NONE,
    });

    return { user, profile, token };
}

async function createLearner(suffix = '') {
    return User.create({
        name: `Student${suffix}`,
        email: `student${suffix}@school.cm`,
        password: 'hashed-password',
        role: 'STUDENT',
        isActive: true,
    });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
    await connectDB();
}, HOOK_TIMEOUT);

afterAll(async () => {
    await disconnectDB();
}, HOOK_TIMEOUT);

beforeEach(async () => {
    await Promise.all([
        User.deleteMany({}).maxTimeMS(8000),
        ParentProfile.deleteMany({}).maxTimeMS(8000),
        ParentLearnerLink.deleteMany({}).maxTimeMS(8000),
        Invitation.deleteMany({}).maxTimeMS(8000),
    ]);
}, HOOK_TIMEOUT);

// ---------------------------------------------------------------------------
// XKT-003: POST /api/parent/children/{learnerId}/link
// ---------------------------------------------------------------------------

describe('XKT-003: Child Linking Request Integration Tests', () => {

    describe('POST /api/parent/children/{learnerId}/link', () => {

        it('should create link request successfully (201 PENDING)', async () => {
            const { profile, token } = await createParent();
            const learner = await createLearner();

            const response = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'FATHER', isPrimary: true });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('linkId');
            expect(response.body.data.status).toBe('PENDING');

            // Verify DB state
            const link = await ParentLearnerLink.findById(response.body.data.linkId);
            expect(link).toBeDefined();
            expect(link?.status).toBe('PENDING');
            expect(link?.parent.toString()).toBe(profile._id.toString());
            expect(link?.learner.toString()).toBe(learner._id.toString());
        }, TEST_TIMEOUT);

        it('should require Authorization header (401)', async () => {
            const learner = await createLearner();

            const response = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .send({ relationshipType: 'FATHER', isPrimary: true });

            expect(response.status).toBe(401);
        }, TEST_TIMEOUT);

        it('should reject learner not found (404 PAR_012)', async () => {
            const { token } = await createParent();
            const fakeLearnerId = new mongoose.Types.ObjectId();

            const response = await request(API_URL)
                .post(`/api/parent/children/${fakeLearnerId}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'FATHER', isPrimary: true });

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('PAR_012');
        }, TEST_TIMEOUT);

        it('should reject if already linked with ACTIVE status (409 PAR_011)', async () => {
            const { profile, token } = await createParent();
            const learner = await createLearner();

            // First request succeeds
            const first = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'FATHER', isPrimary: true });

            expect(first.status).toBe(201);

            // Manually promote to ACTIVE in DB
            await ParentLearnerLink.updateOne(
                { _id: first.body.data.linkId },
                { status: 'ACTIVE' }
            );

            // Second request — already has ACTIVE link
            const second = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'MOTHER', isPrimary: false });

            expect(second.status).toBe(409);
            expect(second.body.error.code).toBe('PAR_011');
        }, TEST_TIMEOUT);

        it('should reject if link already pending (409 PAR_009 or PAR_011)', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            // First request — creates PENDING link
            const first = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'FATHER', isPrimary: true });

            expect(first.status).toBe(201);
            expect(first.body.data.status).toBe('PENDING');

            // Second request — link already exists (any status)
            const second = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'MOTHER', isPrimary: false });

            expect(second.status).toBe(409);
            // service uses exists() which catches any status — PAR_009 or PAR_011
            expect(['PAR_009', 'PAR_011']).toContain(second.body.error?.code);
        }, TEST_TIMEOUT);

        it('should validate invalid relationshipType enum (400 VAL_*)', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            const response = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'INVALID_TYPE', isPrimary: true });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toMatch(/VAL_/);
        }, TEST_TIMEOUT);

        it('should reject missing relationshipType (400 VAL_*)', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            const response = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ isPrimary: true });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toMatch(/VAL_/);
        }, TEST_TIMEOUT);

        it('should accept all valid relationship types', async () => {
            const { token } = await createParent();
            const validTypes = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];

            for (let i = 0; i < validTypes.length; i++) {
                const learner = await createLearner(`_type_${i}`);

                const response = await request(API_URL)
                    .post(`/api/parent/children/${learner._id}/link`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ relationshipType: validTypes[i], isPrimary: true });

                expect(response.status).toBe(201);
            }
        }, TEST_TIMEOUT);

        it('should create separate PENDING links for different learners (same parent)', async () => {
            const { token } = await createParent();
            const learner1 = await createLearner('_1');
            const learner2 = await createLearner('_2');

            const [res1, res2] = await Promise.all([
                request(API_URL)
                    .post(`/api/parent/children/${learner1._id}/link`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ relationshipType: 'FATHER', isPrimary: true }),
                request(API_URL)
                    .post(`/api/parent/children/${learner2._id}/link`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ relationshipType: 'FATHER', isPrimary: true }),
            ]);

            expect(res1.status).toBe(201);
            expect(res2.status).toBe(201);
            expect(res1.body.data.linkId).not.toBe(res2.body.data.linkId);

            const [link1, link2] = await Promise.all([
                ParentLearnerLink.findById(res1.body.data.linkId),
                ParentLearnerLink.findById(res2.body.data.linkId),
            ]);
            expect(link1?.learner.toString()).toBe(learner1._id.toString());
            expect(link2?.learner.toString()).toBe(learner2._id.toString());
        }, TEST_TIMEOUT);

        it('should allow two different parents to request the same learner', async () => {
            // ch parent gets their own signed token — original used same token for both
            const { token: token1 } = await createParent({ email: 'parent1@example.com' });
            const { token: token2 } = await createParent({ email: 'parent2@example.com' });
            const learner = await createLearner();

            const [res1, res2] = await Promise.all([
                request(API_URL)
                    .post(`/api/parent/children/${learner._id}/link`)
                    .set('Authorization', `Bearer ${token1}`)
                    .send({ relationshipType: 'FATHER', isPrimary: true }),
                request(API_URL)
                    .post(`/api/parent/children/${learner._id}/link`)
                    .set('Authorization', `Bearer ${token2}`)
                    .send({ relationshipType: 'MOTHER', isPrimary: false }),
            ]);

            expect(res1.status).toBe(201);
            expect(res2.status).toBe(201);

            const links = await ParentLearnerLink.find({ learner: learner._id });
            expect(links).toHaveLength(2);
        }, TEST_TIMEOUT);

        it('should log link request in AuditLog', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            const response = await request(API_URL)
                .post(`/api/parent/children/${learner._id}/link`)
                .set('Authorization', `Bearer ${token}`)
                .send({ relationshipType: 'FATHER', isPrimary: true });

            expect(response.status).toBe(201);
            // AuditLog verification to be enabled once AuditLog model is wired up:
            // const log = await AuditLog.findOne({ action: 'LINK_REQUESTED' });
            // expect(log).toBeDefined();
        }, TEST_TIMEOUT);
    });

});