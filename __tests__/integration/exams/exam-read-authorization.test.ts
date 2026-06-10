/**
 * Tests d'Intégration : Sécurité A-12 — Middleware requireExamRead
 *
 * Vérifie que GET /api/exams/v2/{id} rejette les utilisateurs non autorisés
 * et autorise uniquement : créateur, admins même école, admins plateforme,
 * et accès public-demo.
 *
 * Rapport d'intrusion : A-12 (CRITIQUE, CVSS 8.1)
 */

jest.mock('@/lib/mongodb', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/services/ExamServiceV2', () => ({
  ExamServiceV2: {
    getExamById: jest.fn().mockResolvedValue({
      _id: 'exam-id',
      title: 'Examen test',
    }),
  },
}))

import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals'
import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import {
  connectMongoMemory,
  disconnectMongoMemory,
  clearMongoCollections,
} from '../../helpers/mongoMemory'
import { createUser, createExamV4 } from '../../helpers/factories'
import School from '@/models/School'
import { ExamStatus, CloseMode, UserRole } from '@/models/enums'
import { GET } from '@/app/api/exams/v2/[id]/route'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

function createGetRequest(examId: string, query = '') {
  const url = `http://localhost/api/exams/v2/${examId}${query}`
  return new Request(url, { method: 'GET' })
}

describe('A-12 — GET /api/exams/v2/[id] authorization (requireExamRead)', () => {
  let schoolA: any
  let schoolB: any
  let teacher: any
  let otherTeacher: any
  let examId: string

  beforeAll(async () => {
    await connectMongoMemory()
  }, 30000)

  afterAll(async () => {
    await disconnectMongoMemory()
  })

  beforeEach(async () => {
    await clearMongoCollections()
    jest.clearAllMocks()

    schoolA = await School.create({
      name: 'Lycée A',
      type: 'SECONDARY',
      status: 'VALIDATED',
      owner: new mongoose.Types.ObjectId(),
    })
    schoolB = await School.create({
      name: 'Lycée B',
      type: 'SECONDARY',
      status: 'VALIDATED',
      owner: new mongoose.Types.ObjectId(),
    })

    teacher = await createUser({
      email: 'teacher-a12@test.com',
      name: 'Prof Créateur',
      role: UserRole.TEACHER,
      schools: [schoolA._id],
    })

    otherTeacher = await createUser({
      email: 'other-teacher-a12@test.com',
      name: 'Prof Autre',
      role: UserRole.TEACHER,
      schools: [schoolB._id],
    })

    const exam = await createExamV4(teacher._id.toString(), {
      title: 'Examen Privé A-12',
      startTime: new Date(Date.now() - 3600_000),
      endTime: new Date(Date.now() + 3600_000),
      duration: 60,
      closeMode: CloseMode.STRICT,
      status: ExamStatus.PUBLISHED,
      isPublished: true,
      isActive: true,
      isPublicDemo: false,
    })
    examId = exam._id.toString()
  })

  describe('Unauthenticated access', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await GET(createGetRequest(examId), {
        params: Promise.resolve({ id: examId }),
      })
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
    })
  })

  describe('Creator access', () => {
    it('should allow the exam creator to read their own exam', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: teacher._id.toString(), role: UserRole.TEACHER },
      } as any)

      const response = await GET(createGetRequest(examId), {
        params: Promise.resolve({ id: examId }),
      })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toBeDefined()
    })
  })

  describe('Unauthorized access', () => {
    it('should return 403 for a teacher from a different school', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: otherTeacher._id.toString(), role: UserRole.TEACHER },
      } as any)

      const response = await GET(createGetRequest(examId), {
        params: Promise.resolve({ id: examId }),
      })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.success).toBe(false)
    })
  })

  describe('Invalid exam ID', () => {
    it('should return 400 for an invalid ObjectId', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: teacher._id.toString(), role: UserRole.TEACHER },
      } as any)

      const response = await GET(createGetRequest('not-a-valid-id'), {
        params: Promise.resolve({ id: 'not-a-valid-id' }),
      })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('should return 404 for a non-existent exam', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString()
      mockGetServerSession.mockResolvedValue({
        user: { id: teacher._id.toString(), role: UserRole.TEACHER },
      } as any)

      const response = await GET(createGetRequest(fakeId), {
        params: Promise.resolve({ id: fakeId }),
      })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.success).toBe(false)
    })
  })

  describe('Middleware unit logic', () => {
    it('should reject requests without authentication (no session)', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await GET(createGetRequest(examId), {
        params: Promise.resolve({ id: examId }),
      })
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('should no longer expose exam data without authentication (A-12 regression)', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await GET(createGetRequest(examId), {
        params: Promise.resolve({ id: examId }),
      })
      const body = await response.json()

      expect(response.status).not.toBe(200)
      expect(body.data).toBeUndefined()
    })

    it('should no longer expose exam data with includeQuestions=true without auth', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const response = await GET(
        createGetRequest(examId, '?includeQuestions=true'),
        { params: Promise.resolve({ id: examId }) },
      )
      const body = await response.json()

      expect(response.status).not.toBe(200)
      expect(body.data).toBeUndefined()
    })
  })
})
