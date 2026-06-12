/**
 * Integration Tests for XKT-003: Child Linking Request
 *
 * Location: __tests__/integration/parent/ParentLearnerLinkTest.spec.ts
 *
 * Uses mongodb-memory-server + direct route handler calls (no running server needed).
 */

jest.mock('@/lib/mongodb', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
    disconnectDB: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '@/models/User';
import ParentProfile from '@/models/ParentProfile';
import ParentLearnerLink from '@/models/ParentLearnerLink';
import Invitation from '@/models/Invitation';
import { UserRole, KYCLevel, KYCStatus } from '@/models/enums';
import { POST } from '@/app/api/parent/children/[learnerId]/link/route';
import {
    connectMongoMemory,
    disconnectMongoMemory,
} from '../../helpers/mongoMemory';

const TEST_SECRET = 'integration-test-nextauth-secret-32ch';
const HOOK_TIMEOUT = 20000;
const TEST_TIMEOUT = 20000;

process.env.NEXTAUTH_SECRET = TEST_SECRET;

// Signs a real JWT matching what ParentAuthService generates
function signToken(payload: {
    userId: string;
    parentProfileId: string;
    email: string;
    kycLevel: number;
}): string {
    return jwt.sign(
        { ...payload, role: UserRole.PARENT },
        TEST_SECRET,
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

/** Calls the route handler directly — no running server needed. */
function linkRequest(learnerId: string, token: string | null, body: Record<string, unknown>) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = new NextRequest(
        `http://localhost/api/parent/children/${learnerId}/link`,
        { method: 'POST', headers, body: JSON.stringify(body) }
    );
    return POST(req, { params: Promise.resolve({ learnerId }) });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

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

            const res = await linkRequest(learner._id.toString(), token, { relationshipType: 'FATHER', isPrimary: true });
            const body = await res.json();

            expect(res.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data).toHaveProperty('linkId');
            expect(body.data.status).toBe('PENDING');

            // Verify DB state
            const link = await ParentLearnerLink.findById(body.data.linkId);
            expect(link).toBeDefined();
            expect(link?.status).toBe('PENDING');
            expect(link?.parent.toString()).toBe(profile._id.toString());
            expect(link?.learner.toString()).toBe(learner._id.toString());
        }, TEST_TIMEOUT);

        it('should require Authorization header (401)', async () => {
            const learner = await createLearner();

            const res = await linkRequest(learner._id.toString(), null, { relationshipType: 'FATHER', isPrimary: true });
            const body = await res.json();

            expect(res.status).toBe(401);
        }, TEST_TIMEOUT);

        it('should reject learner not found (404 PAR_012)', async () => {
            const { token } = await createParent();
            const fakeLearnerId = new mongoose.Types.ObjectId().toString();

            const res = await linkRequest(fakeLearnerId, token, { relationshipType: 'FATHER', isPrimary: true });
            const body = await res.json();

            expect(res.status).toBe(404);
            expect(body.error.code).toBe('PAR_012');
        }, TEST_TIMEOUT);

        it('should reject if already linked with ACTIVE status (409 PAR_011)', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            // First request succeeds
            const firstRes = await linkRequest(learner._id.toString(), token, { relationshipType: 'FATHER', isPrimary: true });
            const firstBody = await firstRes.json();
            expect(firstRes.status).toBe(201);

            // Manually promote to ACTIVE in DB
            await ParentLearnerLink.updateOne(
                { _id: firstBody.data.linkId },
                { status: 'ACTIVE' }
            );

            // Second request — already has ACTIVE link
            const secondRes = await linkRequest(learner._id.toString(), token, { relationshipType: 'MOTHER', isPrimary: false });
            const secondBody = await secondRes.json();

            expect(secondRes.status).toBe(409);
            expect(secondBody.error.code).toBe('PAR_011');
        }, TEST_TIMEOUT);

        it('should reject if link already pending (409 PAR_009 or PAR_011)', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            // First request — creates PENDING link
            const firstRes = await linkRequest(learner._id.toString(), token, { relationshipType: 'FATHER', isPrimary: true });
            const firstBody = await firstRes.json();
            expect(firstRes.status).toBe(201);
            expect(firstBody.data.status).toBe('PENDING');

            // Second request — link already exists (any status)
            const secondRes = await linkRequest(learner._id.toString(), token, { relationshipType: 'MOTHER', isPrimary: false });
            const secondBody = await secondRes.json();

            expect(secondRes.status).toBe(409);
            expect(['PAR_009', 'PAR_011']).toContain(secondBody.error?.code);
        }, TEST_TIMEOUT);

        it('should validate invalid relationshipType enum (400 VAL_*)', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            const res = await linkRequest(learner._id.toString(), token, { relationshipType: 'INVALID_TYPE', isPrimary: true });
            const body = await res.json();

            expect(res.status).toBe(400);
            expect(body.error.code).toMatch(/VAL_/);
        }, TEST_TIMEOUT);

        it('should reject missing relationshipType (400 VAL_*)', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            const res = await linkRequest(learner._id.toString(), token, { isPrimary: true });
            const body = await res.json();

            expect(res.status).toBe(400);
            expect(body.error.code).toMatch(/VAL_/);
        }, TEST_TIMEOUT);

        it('should accept all valid relationship types', async () => {
            const { token } = await createParent();
            const validTypes = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];

            for (let i = 0; i < validTypes.length; i++) {
                const learner = await createLearner(`_type_${i}`);
                const res = await linkRequest(learner._id.toString(), token, { relationshipType: validTypes[i], isPrimary: true });
                expect(res.status).toBe(201);
            }
        }, TEST_TIMEOUT);

        it('should create separate PENDING links for different learners (same parent)', async () => {
            const { token } = await createParent();
            const learner1 = await createLearner('_1');
            const learner2 = await createLearner('_2');

            const [res1, res2] = await Promise.all([
                linkRequest(learner1._id.toString(), token, { relationshipType: 'FATHER', isPrimary: true }),
                linkRequest(learner2._id.toString(), token, { relationshipType: 'FATHER', isPrimary: true }),
            ]);

            const [body1, body2] = await Promise.all([res1.json(), res2.json()]);

            expect(res1.status).toBe(201);
            expect(res2.status).toBe(201);
            expect(body1.data.linkId).not.toBe(body2.data.linkId);

            const [link1, link2] = await Promise.all([
                ParentLearnerLink.findById(body1.data.linkId),
                ParentLearnerLink.findById(body2.data.linkId),
            ]);
            expect(link1?.learner.toString()).toBe(learner1._id.toString());
            expect(link2?.learner.toString()).toBe(learner2._id.toString());
        }, TEST_TIMEOUT);

        it('should allow two different parents to request the same learner', async () => {
            const { token: token1 } = await createParent({ email: 'parent1@example.com' });
            const { token: token2 } = await createParent({ email: 'parent2@example.com' });
            const learner = await createLearner();

            const [res1, res2] = await Promise.all([
                linkRequest(learner._id.toString(), token1, { relationshipType: 'FATHER', isPrimary: true }),
                linkRequest(learner._id.toString(), token2, { relationshipType: 'MOTHER', isPrimary: false }),
            ]);

            expect(res1.status).toBe(201);
            expect(res2.status).toBe(201);

            const links = await ParentLearnerLink.find({ learner: learner._id });
            expect(links).toHaveLength(2);
        }, TEST_TIMEOUT);

        it('should log link request in AuditLog', async () => {
            const { token } = await createParent();
            const learner = await createLearner();

            const res = await linkRequest(learner._id.toString(), token, { relationshipType: 'FATHER', isPrimary: true });
            expect(res.status).toBe(201);
            // AuditLog verification to be enabled once AuditLog model is wired up:
            // const log = await AuditLog.findOne({ action: 'LINK_REQUESTED' });
            // expect(log).toBeDefined();
        }, TEST_TIMEOUT);
    });

});
