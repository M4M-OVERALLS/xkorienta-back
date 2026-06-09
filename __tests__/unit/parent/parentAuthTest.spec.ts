/**
 * Unit Tests for ParentAuthService
 */

import { parentAuthService } from '@/lib/services/ParentAuthService';
import { parentProfileRepository } from '@/lib/repositories/ParentProfileRepository';
import { ParentError } from '@/lib/errors/core/ParentError';
import User from '@/models/User';
import Invitation from '@/models/Invitation';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/mongodb', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/lib/repositories/ParentProfileRepository');
jest.mock('@/models/User');
jest.mock('@/models/Invitation');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('ParentAuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // registerParent
    // ============================================================================

    describe('registerParent', () => {

        it('should register parent successfully with valid invitation', async () => {
            const mockInvitation = {
                token: 'valid-token',
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                save: jest.fn(),
            };
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                name: 'Test Parent',
                save: jest.fn(),
            };
            const mockParentProfile = {
                _id: 'profile123',
                kycLevel: 0,
                kycStatus: 'PENDING',
            };

            (Invitation.findOne as jest.Mock).mockResolvedValue(mockInvitation);
            (User.findOne as jest.Mock).mockResolvedValue(null);
            (User as unknown as jest.Mock).mockReturnValue(mockUser);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
            (parentProfileRepository.create as jest.Mock).mockResolvedValue(mockParentProfile);

            const result = await parentAuthService.registerParent({
                invitationToken: 'valid-token',
                name: 'Test Parent',
                email: 'test@example.com',
                phone: '+237691234567',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(result).toEqual({
                userId: 'user123',
                parentProfileId: 'profile123',
                email: 'test@example.com',
            });
            expect(mockUser.save).toHaveBeenCalled();
            // Invitation status must be flipped to ACCEPTED before save
            expect(mockInvitation.status).toBe('ACCEPTED');
            expect(mockInvitation.save).toHaveBeenCalled();
        });

        it('should throw PAR_005 when invitation token does not exist', async () => {
            (Invitation.findOne as jest.Mock).mockResolvedValue(null);

            await expect(
                parentAuthService.registerParent({
                    invitationToken: 'nonexistent-token',
                    name: 'Test Parent',
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                    language: 'fr',
                })
            ).rejects.toMatchObject({ code: 'PAR_005' });
        });

        it('should throw PAR_005 when invitation is expired', async () => {
            // Service query filters expiresAt > now, so expired → findOne returns null
            (Invitation.findOne as jest.Mock).mockResolvedValue(null);

            await expect(
                parentAuthService.registerParent({
                    invitationToken: 'expired-token',
                    name: 'Test Parent',
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                    language: 'fr',
                })
            ).rejects.toMatchObject({ code: 'PAR_005' });
        });

        it('should throw PAR_004 when email already exists', async () => {
            const mockInvitation = {
                token: 'valid-token',
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                save: jest.fn(),
            };

            (Invitation.findOne as jest.Mock).mockResolvedValue(mockInvitation);
            (User.findOne as jest.Mock).mockResolvedValue({ email: 'existing@example.com' });

            await expect(
                parentAuthService.registerParent({
                    invitationToken: 'valid-token',
                    name: 'Test Parent',
                    email: 'existing@example.com',
                    password: 'SecurePass123!',
                    language: 'fr',
                })
            ).rejects.toMatchObject({ code: 'PAR_004' });
        });

        it('should hash password with bcrypt salt 12', async () => {
            const mockInvitation = {
                token: 'valid-token',
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                save: jest.fn(),
            };
            const mockUser = { _id: 'user123', email: 'test@example.com', save: jest.fn() };

            (Invitation.findOne as jest.Mock).mockResolvedValue(mockInvitation);
            (User.findOne as jest.Mock).mockResolvedValue(null);
            (User as unknown as jest.Mock).mockReturnValue(mockUser);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
            (parentProfileRepository.create as jest.Mock).mockResolvedValue({ _id: 'profile123' });

            await parentAuthService.registerParent({
                invitationToken: 'valid-token',
                name: 'Test Parent',
                email: 'test@example.com',
                password: 'SecurePass123!',
                language: 'fr',
            });

            expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12);
        });
    });

    // ============================================================================
    // loginParent
    // ============================================================================

    describe('loginParent', () => {

        it('should login successfully with valid credentials', async () => {
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                name: 'Test Parent',
                password: 'hashed-password',
                isActive: true,
            };
            const mockParentProfile = {
                _id: 'profile123',
                user: 'user123',
                kycLevel: 0,
                isActive: true,
                accountDisabledAt: null,
            };

            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            (parentProfileRepository.findByUserId as jest.Mock).mockResolvedValue(mockParentProfile);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (jwt.sign as jest.Mock).mockReturnValue('mocked-token');

            const result = await parentAuthService.loginParent({
                email: 'test@example.com',
                password: 'SecurePass123!',
            });

            expect(result).toEqual(
                expect.objectContaining({
                    userId: 'user123',
                    parentProfileId: 'profile123',
                    email: 'test@example.com',
                    name: 'Test Parent',
                    accessToken: 'mocked-token',
                    kycLevel: 0,
                    expiresIn: 3600,
                })
            );
        });

        it('should throw PAR_001 when user does not exist', async () => {
            (User.findOne as jest.Mock).mockResolvedValue(null);

            await expect(
                parentAuthService.loginParent({
                    email: 'nonexistent@example.com',
                    password: 'SecurePass123!',
                })
            ).rejects.toMatchObject({ code: 'PAR_001' });
        });

        it('should throw PAR_001 when user exists but profile does not', async () => {
            // Edge case: user record exists but ParentProfile was never created
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                password: 'hashed-password',
                isActive: true,
            };

            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            // findByUserId returns null → service throws PAR_001
            (parentProfileRepository.findByUserId as jest.Mock).mockResolvedValue(null);

            await expect(
                parentAuthService.loginParent({
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                })
            ).rejects.toMatchObject({ code: 'PAR_001' });
        });

        it('should throw PAR_002 when password is incorrect', async () => {
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                password: 'hashed-password',
                isActive: true,
            };
            const mockParentProfile = {
                _id: 'profile123',
                isActive: true,
                accountDisabledAt: null,
            };

            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            (parentProfileRepository.findByUserId as jest.Mock).mockResolvedValue(mockParentProfile);
            // password mismatch
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                parentAuthService.loginParent({
                    email: 'test@example.com',
                    password: 'WrongPassword!',
                })
            ).rejects.toMatchObject({ code: 'PAR_002' });
        });

        it('should throw PAR_003 when user.isActive is false', async () => {
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                password: 'hashed-password',
                isActive: false, // disabled at user level
            };
            const mockParentProfile = {
                _id: 'profile123',
                accountDisabledAt: null,
                accountDisabledReason: 'Policy violation',
            };

            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            (parentProfileRepository.findByUserId as jest.Mock).mockResolvedValue(mockParentProfile);
            // password must match first — service checks status AFTER password
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            await expect(
                parentAuthService.loginParent({
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                })
            ).rejects.toMatchObject({ code: 'PAR_003' });
        });

        it('should throw PAR_003 when profile.accountDisabledAt is set', async () => {
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                password: 'hashed-password',
                isActive: true, // user active but profile disabled
            };
            const mockParentProfile = {
                _id: 'profile123',
                accountDisabledAt: new Date(), // disabled at profile level
                accountDisabledReason: 'KYC rejected',
            };

            (User.findOne as jest.Mock).mockResolvedValue(mockUser);
            (parentProfileRepository.findByUserId as jest.Mock).mockResolvedValue(mockParentProfile);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            await expect(
                parentAuthService.loginParent({
                    email: 'test@example.com',
                    password: 'SecurePass123!',
                })
            ).rejects.toMatchObject({ code: 'PAR_003' });
        });
    });

    // ============================================================================
    // verifyToken
    // ============================================================================

    describe('verifyToken', () => {

        it('should verify valid token and return payload', () => {
            const mockPayload = {
                userId: 'user123',
                parentProfileId: 'profile123',
                email: 'test@example.com',
                role: 'PARENT',
                kycLevel: 0,
            };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            const result = parentAuthService.verifyToken('valid-token');

            expect(result).toEqual(mockPayload);
            // verify is called with the token
            expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
        });

        it('should return null for invalid token', () => {
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            expect(parentAuthService.verifyToken('invalid-token')).toBeNull();
        });

        it('should return null for expired token', () => {
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Token expired');
            });

            expect(parentAuthService.verifyToken('expired-token')).toBeNull();
        });
    });
});