/**
 * Parent Authentication Service
 * Handles parent registration and login logic
 */

import { parentProfileRepository } from '@/lib/repositories/ParentProfileRepository';
import User from '@/models/User';
import Invitation from '@/models/Invitation';
import { ParentError } from "@/lib/errors/core/ParentError";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { env } from '@/lib/utils/env';
import { KYCLevel, UserRole } from '@/models/enums';
import mongoose from 'mongoose';
import connectDB from "@/lib/mongodb";

export class ParentAuthService {

    /**
     * Register a new parent
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

        await connectDB();

        // 1. Validate invitation
        const invitation = await Invitation.findOne({
            token: data.invitationToken,
            status: 'PENDING',
            expiresAt: { $gt: new Date() },
        });

        if (!invitation) {
            throw ParentError.invitationInvalidOrExpired(); // PAR_005
        }

        // 2. Check email exists
        const existingUser = await User.findOne({
            email: data.email.toLowerCase()
        });

        if (existingUser) {
            throw ParentError.emailAlreadyExists(); // PAR_004
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(data.password, 12);

        // 4. Create user
        const user = new User({
            name: data.name,
            email: data.email.toLowerCase(),
            phone: data.phone,
            password: hashedPassword,
            role: UserRole.PARENT,
            emailVerified: false,
            isActive: true,
        });

        await user.save();

        // 5. Create parent profile
        const parentProfile = await parentProfileRepository.create({
            user: user._id,
            preferredLanguage: data.language,
        });

        // 6. Mark invitation as used
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

        await connectDB();

        const email = data.email.toLowerCase();

        // 1. Find user
        const user = await User.findOne({
            email,
            role: UserRole.PARENT,
        });

        if (!user) {
            throw ParentError.parentNotFound(); // PAR_001
        }

        // 2. Get profile
        const parentProfile = await parentProfileRepository.findByUserId(user._id);

        if (!parentProfile) {
            throw ParentError.parentNotFound(); // PAR_001
        }

        // 3. Verify password
        const passwordValid = await bcrypt.compare(
            data.password,
            user.password || ''
        );

        if (!passwordValid) {
            throw ParentError.invalidCredentials(); // PAR_002
        }

        // 4. Account status check
        if (!user.isActive || parentProfile.accountDisabledAt) {
            throw ParentError.accountDisabled(
                parentProfile.accountDisabledReason
            ); // PAR_003
        }

        // 5. Tokens
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

        return {
            userId: user._id,
            parentProfileId: parentProfile._id,
            email: user.email!,
            name: user.name,
            accessToken,
            refreshToken,
            expiresIn: 3600,
            kycLevel: parentProfile.kycLevel,
        };
    }

    /**
     * JWT Access Token
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
     * JWT Refresh Token
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
     * Verify token
     */
    verifyToken(token: string) {
        try {
            return jwt.verify(token, env.NEXTAUTH_SECRET) as any;
        } catch {
            return null;
        }
    }
}

// Singleton
export const parentAuthService = new ParentAuthService();