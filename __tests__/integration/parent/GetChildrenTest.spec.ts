/**
 * Integration Tests for XKT-005: Get Children Endpoint
 *
 * Location: __tests__/integration/parent/GetChildrenTest.spec.ts
 *
 * Tests the complete flow from HTTP request to database query
 * Uses mongodb-memory-server + direct route handler calls (no running server needed).
 *
 * Scope:
 * - Authentication: JWT token validation and extraction
 * - Data retrieval: Getting active parent-child links from DB
 * - Response formatting: Correct structure and data types
 * - Sorting: Children sorted by isPrimary and createdAt
 * - Error handling: 401, 500 status codes
 * - Edge cases: Empty lists, invalid tokens, missing auth header
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
import { UserRole, KYCLevel, KYCStatus, LinkStatus, ParentRelationshipType } from '@/models/enums';
import { GET } from '@/app/api/parent/children/route';
import {
    connectMongoMemory,
    disconnectMongoMemory,
} from '../../helpers/mongoMemory';

const TEST_SECRET = 'integration-test-nextauth-secret-32ch';
const HOOK_TIMEOUT = 20000;
const TEST_TIMEOUT = 20000;

process.env.NEXTAUTH_SECRET = TEST_SECRET;

// ============================================================================
// JWT Token Helpers
// ============================================================================

/**
 * Signs a real JWT matching what ParentAuthService generates
 */
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

// ============================================================================
// Data Creation Helpers
// ============================================================================

/**
 * Creates a parent user and profile with JWT token
 */
async function createParent(overrides: {
    email?: string;
    kycLevel?: KYCLevel;
    kycStatus?: KYCStatus;
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

/**
 * Creates a student user
 */
async function createStudent(overrides: { name?: string; email?: string } = {}) {
    return User.create({
        name: overrides.name ?? 'Test Student',
        email: overrides.email ?? `student-${Date.now()}@school.cm`,
        password: 'hashed-password',
        role: UserRole.STUDENT,
        isActive: true,
    });
}

/**
 * Creates an active parent-child link in the database
 */
async function createActiveLink(
    parentId: mongoose.Types.ObjectId,
    learnerId: mongoose.Types.ObjectId,
    overrides: {
        relationshipType?: ParentRelationshipType;
        isPrimary?: boolean;
    } = {}
) {
    return ParentLearnerLink.create({
        parent: parentId,
        learner: learnerId,
        relationshipType: overrides.relationshipType ?? ParentRelationshipType.FATHER,
        isPrimary: overrides.isPrimary ?? false,
        status: LinkStatus.ACTIVE,
        createdAt: new Date(),
    });
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Calls the GET route handler directly with optional auth header
 */
function getChildrenRequest(token: string | null = null): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const req = new NextRequest('http://localhost/api/parent/children', {
        method: 'GET',
        headers,
    });

    return GET(req);
}

// ============================================================================
// Setup and Teardown
// ============================================================================

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
    ]);
}, HOOK_TIMEOUT);

// ============================================================================
// XKT-005: GET /api/parent/children Integration Tests
// ============================================================================

describe('XKT-005: Get Children Endpoint Integration Tests', () => {
    describe('GET /api/parent/children', () => {
        // ====================================================================
        // Success Cases
        // ====================================================================

        describe('Success Cases (200)', () => {
            it('should retrieve single child successfully', async () => {
                const { profile, token } = await createParent();
                const student = await createStudent({ name: 'Jean-Claude Kamga' });

                await createActiveLink(profile._id, student._id, {
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(res.status).toBe(200);
                expect(body.success).toBe(true);
                expect(body.data).toHaveLength(1);
                expect(body.data[0]).toMatchObject({
                    name: 'Jean-Claude Kamga',
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                });
                expect(body.data[0]).toHaveProperty('linkId');
                expect(body.data[0]).toHaveProperty('learnerId');
            }, TEST_TIMEOUT);

            it('should retrieve multiple children successfully', async () => {
                const { profile, token } = await createParent();
                const student1 = await createStudent({ name: 'Child One' });
                const student2 = await createStudent({ name: 'Child Two' });

                await createActiveLink(profile._id, student1._id, {
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: true,
                });
                await createActiveLink(profile._id, student2._id, {
                    relationshipType: ParentRelationshipType.MOTHER,
                    isPrimary: false,
                });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(res.status).toBe(200);
                expect(body.success).toBe(true);
                expect(body.data).toHaveLength(2);
                expect(body.data[0].name).toBe('Child One');
                expect(body.data[1].name).toBe('Child Two');
            }, TEST_TIMEOUT);

            it('should return empty array when parent has no children', async () => {
                const { token } = await createParent();

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(res.status).toBe(200);
                expect(body.success).toBe(true);
                expect(body.data).toEqual([]);
                expect(body.meta).toMatchObject({
                    total: 0,
                    page: 1,
                    limit: 100,
                });
            }, TEST_TIMEOUT);

            it('should include pagination metadata in response', async () => {
                const { profile, token } = await createParent();
                const student = await createStudent();

                await createActiveLink(profile._id, student._id);

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(res.status).toBe(200);
                expect(body).toHaveProperty('meta');
                expect(body.meta).toMatchObject({
                    total: 1,
                    page: 1,
                    limit: 100,
                });
            }, TEST_TIMEOUT);
        });

        // ====================================================================
        // Sorting and Ordering
        // ====================================================================

        describe('Sorting and Ordering', () => {
            it('should sort children by isPrimary first (primary contact first)', async () => {
                const { profile, token } = await createParent();
                const student1 = await createStudent({ name: 'Secondary' });
                const student2 = await createStudent({ name: 'Primary' });

                // Create secondary first (lower isPrimary priority)
                await createActiveLink(profile._id, student1._id, { isPrimary: false });
                // Create primary second
                await createActiveLink(profile._id, student2._id, { isPrimary: true });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                // Primary should come first regardless of creation order
                expect(body.data[0].name).toBe('Primary');
                expect(body.data[0].isPrimary).toBe(true);
                expect(body.data[1].name).toBe('Secondary');
                expect(body.data[1].isPrimary).toBe(false);
            }, TEST_TIMEOUT);

            it('should sort secondary children by createdAt DESC (newest first)', async () => {
                const { profile, token } = await createParent();
                const student1 = await createStudent({ name: 'Older' });
                const student2 = await createStudent({ name: 'Newer' });

                // Create older child first
                const link1 = await createActiveLink(profile._id, student1._id, { isPrimary: false });
                // Add delay and create newer child
                await new Promise(resolve => setTimeout(resolve, 100));
                const link2 = await createActiveLink(profile._id, student2._id, { isPrimary: false });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                // Newer should come first (higher createdAt)
                expect(body.data[0].name).toBe('Newer');
                expect(body.data[1].name).toBe('Older');
            }, TEST_TIMEOUT);

            it('should sort primary contacts before secondary regardless of date', async () => {
                const { profile, token } = await createParent();
                const student1 = await createStudent({ name: 'Old Primary' });
                const student2 = await createStudent({ name: 'New Secondary' });

                // Create primary (old)
                await createActiveLink(profile._id, student1._id, {
                    isPrimary: true,
                    relationshipType: ParentRelationshipType.FATHER,
                });
                // Add delay and create secondary (new)
                await new Promise(resolve => setTimeout(resolve, 100));
                await createActiveLink(profile._id, student2._id, {
                    isPrimary: false,
                    relationshipType: ParentRelationshipType.MOTHER,
                });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                // Primary should always come first
                expect(body.data[0].name).toBe('Old Primary');
                expect(body.data[0].isPrimary).toBe(true);
                expect(body.data[1].name).toBe('New Secondary');
                expect(body.data[1].isPrimary).toBe(false);
            }, TEST_TIMEOUT);
        });

        // ====================================================================
        // Response Structure and Data Types
        // ====================================================================

        describe('Response Structure and Data Types', () => {
            it('should have correct response structure', async () => {
                const { profile, token } = await createParent();
                const student = await createStudent();

                await createActiveLink(profile._id, student._id);

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(body).toHaveProperty('success');
                expect(body).toHaveProperty('data');
                expect(body).toHaveProperty('meta');
                expect(typeof body.success).toBe('boolean');
                expect(Array.isArray(body.data)).toBe(true);
            }, TEST_TIMEOUT);

            it('should have correct data structure for each child', async () => {
                const { profile, token } = await createParent();
                const student = await createStudent({ name: 'Test Child' });

                await createActiveLink(profile._id, student._id, {
                    relationshipType: ParentRelationshipType.GUARDIAN,
                    isPrimary: false,
                });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                const child = body.data[0];

                // Required fields
                expect(child).toHaveProperty('linkId');
                expect(child).toHaveProperty('learnerId');
                expect(child).toHaveProperty('name');
                expect(child).toHaveProperty('relationshipType');
                expect(child).toHaveProperty('isPrimary');

                // Correct types
                expect(typeof child.linkId).toBe('string');
                expect(typeof child.learnerId).toBe('string');
                expect(typeof child.name).toBe('string');
                expect(typeof child.relationshipType).toBe('string');
                expect(typeof child.isPrimary).toBe('boolean');
            }, TEST_TIMEOUT);

            it('should have valid ObjectId strings for linkId and learnerId', async () => {
                const { profile, token } = await createParent();
                const student = await createStudent();

                await createActiveLink(profile._id, student._id);

                const res = await getChildrenRequest(token);
                const body = await res.json();

                const child = body.data[0];

                // Valid MongoDB ObjectId format (24 hex chars)
                expect(child.linkId).toMatch(/^[a-f0-9]{24}$/i);
                expect(child.learnerId).toMatch(/^[a-f0-9]{24}$/i);
            }, TEST_TIMEOUT);

            it('should only return ACTIVE links', async () => {
                const { profile, token } = await createParent();
                const student1 = await createStudent({ name: 'Active Child' });
                const student2 = await createStudent({ name: 'Pending Child' });

                // Create active link
                await createActiveLink(profile._id, student1._id);

                // Create pending link (should not appear in response)
                await ParentLearnerLink.create({
                    parent: profile._id,
                    learner: student2._id,
                    relationshipType: ParentRelationshipType.FATHER,
                    isPrimary: false,
                    status: LinkStatus.PENDING,
                });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(body.data).toHaveLength(1);
                expect(body.data[0].name).toBe('Active Child');
            }, TEST_TIMEOUT);
        });

        // ====================================================================
        // Relationship Types
        // ====================================================================

        describe('Relationship Types', () => {
            it.each([
                ParentRelationshipType.FATHER,
                ParentRelationshipType.MOTHER,
                ParentRelationshipType.GUARDIAN,
                ParentRelationshipType.OTHER,
            ])('should correctly return relationshipType %s', async (relationshipType) => {
                const { profile, token } = await createParent();
                const student = await createStudent();

                await createActiveLink(profile._id, student._id, { relationshipType });

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(body.data[0].relationshipType).toBe(relationshipType);
            }, TEST_TIMEOUT);
        });

        // ====================================================================
        // Authentication Failures (401)
        // ====================================================================

        describe('Authentication Failures (401)', () => {
            it('should reject missing Authorization header', async () => {
                const res = await getChildrenRequest(null);
                const body = await res.json();

                expect(res.status).toBe(401);
                expect(body.error.message).toBeDefined();
                expect(body.error.message).toContain('Missing authentication token');
            }, TEST_TIMEOUT);

            it('should reject malformed Authorization header (no Bearer prefix)', async () => {
                const token = 'invalid-token-without-bearer';
                const headers: Record<string, string> = {
                    'Authorization': token,
                };

                const req = new NextRequest('http://localhost/api/parent/children', {
                    method: 'GET',
                    headers,
                });

                const res = await GET(req);
                const body = await res.json();

                expect(res.status).toBe(401);
                expect(body.error.message).toContain('Missing authentication token');
            }, TEST_TIMEOUT);

            it('should reject malformed JWT token', async () => {
                const malformedToken = 'malformed.jwt.token';
                const headers: Record<string, string> = {
                    'Authorization': `Bearer ${malformedToken}`,
                };

                const req = new NextRequest('http://localhost/api/parent/children', {
                    method: 'GET',
                    headers,
                });

                const res = await GET(req);
                const body = await res.json();

                expect(res.status).toBe(401);
                expect(body.error.message).toContain('Invalid token');
            }, TEST_TIMEOUT);

            it('should reject JWT with invalid signature', async () => {
                const invalidToken = jwt.sign(
                    { userId: 'test', parentProfileId: 'test123', email: 'test@test.com', kycLevel: 0 },
                    'wrong-secret',
                    { expiresIn: '1h' }
                );

                const headers: Record<string, string> = {
                    'Authorization': `Bearer ${invalidToken}`,
                };

                const req = new NextRequest('http://localhost/api/parent/children', {
                    method: 'GET',
                    headers,
                });

                const res = await GET(req);
                const body = await res.json();

                expect(res.status).toBe(401);
                expect(body.error.message).toContain('Invalid token');
            }, TEST_TIMEOUT);

            it('should reject JWT missing parentProfileId claim', async () => {
                const tokenWithoutParentId = jwt.sign(
                    { userId: 'test', email: 'test@test.com' }, // Missing parentProfileId
                    TEST_SECRET,
                    { expiresIn: '1h' }
                );

                const headers: Record<string, string> = {
                    'Authorization': `Bearer ${tokenWithoutParentId}`,
                };

                const req = new NextRequest('http://localhost/api/parent/children', {
                    method: 'GET',
                    headers,
                });

                const res = await GET(req);
                const body = await res.json();

                expect(res.status).toBe(401);
                expect(body.error.message).toContain('Invalid token');
            }, TEST_TIMEOUT);

            it('should reject JWT with invalid ObjectId format', async () => {
                const tokenWithInvalidId = jwt.sign(
                    {
                        userId: 'test',
                        parentProfileId: 'not-an-objectid',
                        email: 'test@test.com',
                        kycLevel: 0,
                    },
                    TEST_SECRET,
                    { expiresIn: '1h' }
                );

                const headers: Record<string, string> = {
                    'Authorization': `Bearer ${tokenWithInvalidId}`,
                };

                const req = new NextRequest('http://localhost/api/parent/children', {
                    method: 'GET',
                    headers,
                });

                const res = await GET(req);
                const body = await res.json();

                expect(res.status).toBe(401);
                expect(body.error.message).toContain('Invalid token');
            }, TEST_TIMEOUT);
        });

        // ====================================================================
        // Data Isolation — Parent Cannot See Other Parent's Children
        // ====================================================================

        describe('Data Isolation', () => {
            it('should not return children of other parents', async () => {
                const parent1 = await createParent({ email: 'parent1@example.com' });
                const parent2 = await createParent({ email: 'parent2@example.com' });

                const student1 = await createStudent({ name: 'Student 1' });
                const student2 = await createStudent({ name: 'Student 2' });

                // Parent 1 linked to Student 1
                await createActiveLink(parent1.profile._id, student1._id);

                // Parent 2 linked to Student 2
                await createActiveLink(parent2.profile._id, student2._id);

                // Parent 1 requests children
                const res = await getChildrenRequest(parent1.token);
                const body = await res.json();

                // Should only see Student 1
                expect(body.data).toHaveLength(1);
                expect(body.data[0].name).toBe('Student 1');
            }, TEST_TIMEOUT);
        });

        // ====================================================================
        // Edge Cases
        // ====================================================================

        describe('Edge Cases', () => {
            it('should handle parent with many children', async () => {
                const { profile, token } = await createParent();

                // Create 10 children
                for (let i = 0; i < 10; i++) {
                    const student = await createStudent({ name: `Child ${i}` });
                    await createActiveLink(profile._id, student._id);
                }

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(res.status).toBe(200);
                expect(body.data).toHaveLength(10);
                expect(body.meta.total).toBe(10);
            }, TEST_TIMEOUT);

            it('should handle special characters in child names', async () => {
                const { profile, token } = await createParent();
                const student = await createStudent({
                    name: 'François d\'Afrique & Co. (Ñoño)',
                });

                await createActiveLink(profile._id, student._id);

                const res = await getChildrenRequest(token);
                const body = await res.json();

                expect(body.data[0].name).toBe('François d\'Afrique & Co. (Ñoño)');
            }, TEST_TIMEOUT);
        });

        // ====================================================================
        // HTTP Headers and Content Type
        // ====================================================================

        describe('HTTP Response Headers', () => {
            it('should return JSON content type', async () => {
                const { token } = await createParent();

                const res = await getChildrenRequest(token);

                expect(res.headers.get('content-type')).toContain('application/json');
            }, TEST_TIMEOUT);

            it('should return 200 status for successful request', async () => {
                const { token } = await createParent();

                const res = await getChildrenRequest(token);

                expect(res.status).toBe(200);
                expect(res.ok).toBe(true);
            }, TEST_TIMEOUT);
        });
    });
});
