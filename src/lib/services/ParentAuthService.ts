/**
 * Parent Authentication Service
 * Handles parent registration and login logic
 * Uses ParentProfileRepository and User model from existing system
 */

import { parentProfileRepository } from '@/lib/repositories/ParentProfileRepository';
import User, { IUser } from '@/models/User'; // Existing User model
import {ParentError} from "@/lib/errors/core/ParentError";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { env } from '@/lib/utils/env';
import {KYCLevel, UserRole} from '@/models/enums';
import Invitation from '@/models/Invitation'; // Existing Invitation model
import mongoose from 'mongoose';

export class ParentAuthService {
    /**
     * Register a new parent
     * Steps:
     * 1. Validate invitation token
     * 2. Check email doesn't exist
     * 3. Hash password
     * 4. Create User with role=PARENT
     * 5. Create ParentProfile
     * 6. Mark invitation as used
     */
    async registerParent(data: {
        invitationToken: string;
        name: string;
        email: string;
        phone?: string;
        password: string;
        language: 'fr' | 'en';
    }): Promise<{
        userId: mongoose.Types.ObjectId;
        parentProfileId: mongoose.Types.ObjectId;
        email: string;
    }> {
        // Step 1: Validate invitation token
        const invitation = await Invitation.findOne({
            token: data.invitationToken,
            status: 'PENDING',
            expiresAt: { $gt: new Date() },
        });

        if (!invitation) {
            throw ParentError.invalidInvitationToken();
        }

        // Step 2: Check email doesn't exist
        const existingUser = await User.findOne({ email: data.email.toLowerCase() });
        if (existingUser) {
            throw new ParentError({
                code: 'REG_001',
                message: 'This email is already registered. Please login or use a different email.',
                httpStatus: 409,
                severity: 'WARNING',
                category: 'CONFLICT',
            });
        }

        // Step 3: Hash password
        const hashedPassword = await bcrypt.hash(data.password, 12);

        // Step 4: Create User
        const user = new User({
            name: data.name,
            email: data.email.toLowerCase(),
            phone: data.phone,
            password: hashedPassword,
            role: UserRole.PARENT,
            emailVerified: false,
            isActive: true, // Can login, but dashboard blocked until KYC L2
        });

        await user.save();

        // Step 5: Create ParentProfile
        const parentProfile = await parentProfileRepository.create({
            user: user._id,
            preferredLanguage: data.language,
        });

        // Step 6: Mark invitation as used
        invitation.status = 'ACCEPTED';
        await invitation.save();

        return {
            userId: user._id,
            parentProfileId: parentProfile._id,
            email: user.email!,
        };
    }

    /**
     * Login parent
     * Steps:
     * 1. Find user by email with role=PARENT
     * 2. Verify password
     * 3. Generate JWT token
     * 4. Return token + user info
     */
    async loginParent(data: {
        email: string;
        password: string;
    }): Promise<{
        userId: mongoose.Types.ObjectId;
        parentProfileId: mongoose.Types.ObjectId;
        email: string;
        name: string;
        accessToken: string;
        refreshToken?: string;
        expiresIn: number;
        kycLevel: KYCLevel;
    }> {
        const email = data.email.toLowerCase();

        // Step 1: Find user by email with role=PARENT
        const user = await User.findOne({
            email,
            role: UserRole.PARENT,
        });

        if (!user) {
            throw ParentError.parentNotFound();
        }

        // Get parent profile
        const parentProfile = await parentProfileRepository.findById(user._id);
        if (!parentProfile) {
            throw ParentError.parentNotFound();
        }

        // Step 2: Verify password
        const passwordValid = await bcrypt.compare(data.password, user.password || '');

        if (!passwordValid) {

            throw new ParentError({
                code: 'AUTH_002',
                message: 'Invalid email or password',
                httpStatus: 401,
                severity: 'WARNING',
                category: 'AUTHENTICATION',
            });
        }

        // Check if account is disabled
        if (!user.isActive || parentProfile.accountDisabledAt) {
            throw new ParentError({
                code: 'AUTH_003',
                message: `Your account has been disabled. Reason: ${parentProfile.accountDisabledReason || 'contact support'}`,
                httpStatus: 403,
                severity: 'WARNING',
                category: 'AUTHORIZATION',
            });
        }

        // Step 4: Generate JWT token
        const accessToken = this.generateAccessToken({
            userId: user._id.toString(),
            parentProfileId: parentProfile._id.toString(),
            email: user.email!,
            role: UserRole.PARENT,
            kycLevel: parentProfile.kycLevel,
        });

        const refreshToken = this.generateRefreshToken({
            userId: user._id.toString(),
            parentProfileId: parentProfile._id.toString(),
        });

        // return User Token and Info
        return {
            userId: user._id,
            parentProfileId: parentProfile._id,
            email: user.email!,
            name: user.name,
            accessToken,
            refreshToken,
            expiresIn: 3600, // 1 hour
            kycLevel: parentProfile.kycLevel,
        };
    }

    /**
     * Generate JWT access token (short-lived, 1 hour)
     */
    private generateAccessToken(payload: {
        userId: string;
        parentProfileId: string;
        email: string;
        role: UserRole;
        kycLevel: KYCLevel;
    }): string {
        return jwt.sign(payload, env.NEXTAUTH_SECRET, {
            expiresIn: '1h',
            issuer: 'xkorienta-parent-module',
            subject: payload.userId,
        });
    }

    /**
     * Generate JWT refresh token (long-lived, 7 days)
     */
    private generateRefreshToken(payload: {
        userId: string;
        parentProfileId: string;
    }): string {
        return jwt.sign(payload, env.NEXTAUTH_SECRET, {
            expiresIn: '7d',
            issuer: 'xkorienta-parent-module',
            subject: payload.userId,
        });
    }

    /**
     * Verify and decode JWT token
     */
    verifyToken(token: string): {
        userId: string;
        parentProfileId: string;
        email: string;
        role: UserRole;
        kycLevel: number;
    } | null {
        try {
            const decoded = jwt.verify(token, env.NEXTAUTH_SECRET) as any;
            return {
                userId: decoded.userId,
                parentProfileId: decoded.parentProfileId,
                email: decoded.email,
                role: decoded.role,
                kycLevel: decoded.kycLevel,
            };
        } catch (error) {
            return null;
        }
    }
}

// Export singleton instance
export const parentAuthService = new ParentAuthService();