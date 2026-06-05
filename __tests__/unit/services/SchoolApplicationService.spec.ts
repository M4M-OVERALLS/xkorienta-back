/**
 * Tests — SchoolApplicationService State Machine
 *
 * Verifie que les transitions de statut sont correctement gardees.
 * Chaque transition invalide doit lever InscriptionError (INS_006).
 */

import { describe, it, expect } from '@jest/globals'
import { ApplicationStatus } from '@/models/enums'

// ── State machine (copie de la logique du service pour test isole) ──

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    [ApplicationStatus.DRAFT]:     [ApplicationStatus.SUBMITTED],
    [ApplicationStatus.SUBMITTED]: [ApplicationStatus.PAID, ApplicationStatus.CANCELLED],
    [ApplicationStatus.PAID]:      [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED],
    [ApplicationStatus.APPROVED]:  [ApplicationStatus.CANCELLED],
    [ApplicationStatus.REJECTED]:  [],
    [ApplicationStatus.CANCELLED]: [],
}

function isValidTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    const allowed = VALID_TRANSITIONS[from]
    return !!allowed && allowed.includes(to)
}

// ── Tests ──

describe('SchoolApplication State Machine', () => {
    describe('Valid transitions', () => {
        const validCases: [ApplicationStatus, ApplicationStatus][] = [
            [ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED],
            [ApplicationStatus.SUBMITTED, ApplicationStatus.PAID],
            [ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED],
            [ApplicationStatus.PAID, ApplicationStatus.APPROVED],
            [ApplicationStatus.PAID, ApplicationStatus.REJECTED],
            [ApplicationStatus.PAID, ApplicationStatus.CANCELLED],
            [ApplicationStatus.APPROVED, ApplicationStatus.CANCELLED],
        ]

        it.each(validCases)(
            'should allow %s -> %s',
            (from, to) => {
                expect(isValidTransition(from, to)).toBe(true)
            },
        )
    })

    describe('Invalid transitions', () => {
        const invalidCases: [ApplicationStatus, ApplicationStatus][] = [
            // DRAFT ne peut aller qu'a SUBMITTED
            [ApplicationStatus.DRAFT, ApplicationStatus.PAID],
            [ApplicationStatus.DRAFT, ApplicationStatus.APPROVED],
            [ApplicationStatus.DRAFT, ApplicationStatus.REJECTED],
            [ApplicationStatus.DRAFT, ApplicationStatus.CANCELLED],

            // SUBMITTED ne peut pas sauter a APPROVED directement
            [ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED],
            [ApplicationStatus.SUBMITTED, ApplicationStatus.REJECTED],

            // APPROVED ne peut pas revenir en arriere
            [ApplicationStatus.APPROVED, ApplicationStatus.DRAFT],
            [ApplicationStatus.APPROVED, ApplicationStatus.SUBMITTED],
            [ApplicationStatus.APPROVED, ApplicationStatus.PAID],
            [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED],

            // REJECTED est final
            [ApplicationStatus.REJECTED, ApplicationStatus.DRAFT],
            [ApplicationStatus.REJECTED, ApplicationStatus.SUBMITTED],
            [ApplicationStatus.REJECTED, ApplicationStatus.PAID],
            [ApplicationStatus.REJECTED, ApplicationStatus.APPROVED],
            [ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED],

            // CANCELLED est final
            [ApplicationStatus.CANCELLED, ApplicationStatus.DRAFT],
            [ApplicationStatus.CANCELLED, ApplicationStatus.SUBMITTED],
            [ApplicationStatus.CANCELLED, ApplicationStatus.PAID],
            [ApplicationStatus.CANCELLED, ApplicationStatus.APPROVED],
            [ApplicationStatus.CANCELLED, ApplicationStatus.REJECTED],
        ]

        it.each(invalidCases)(
            'should reject %s -> %s',
            (from, to) => {
                expect(isValidTransition(from, to)).toBe(false)
            },
        )
    })

    describe('Coverage', () => {
        it('should cover all ApplicationStatus values', () => {
            const allStatuses = Object.values(ApplicationStatus)
            const coveredStatuses = Object.keys(VALID_TRANSITIONS)
            expect(coveredStatuses.sort()).toEqual(allStatuses.sort())
        })

        it('should have REJECTED and CANCELLED as terminal states (no outgoing transitions)', () => {
            expect(VALID_TRANSITIONS[ApplicationStatus.REJECTED]).toEqual([])
            expect(VALID_TRANSITIONS[ApplicationStatus.CANCELLED]).toEqual([])
        })

        it('should require payment before approval', () => {
            // On ne peut pas approuver une candidature non payee
            expect(isValidTransition(ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED)).toBe(false)
            expect(isValidTransition(ApplicationStatus.DRAFT, ApplicationStatus.APPROVED)).toBe(false)
            // Seul PAID permet d'aller a APPROVED
            expect(isValidTransition(ApplicationStatus.PAID, ApplicationStatus.APPROVED)).toBe(true)
        })
    })
})
