import { AuthRepository } from "@/lib/repositories/AuthRepository";
import { authStrategyManager } from "@/lib/auth/strategies/AuthStrategyManager";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { sendPasswordResetEmail } from "@/lib/mail";

type GoogleUserPayload = {
    email?: string;
    name?: string;
    image?: string;
    id?: string;
};

export class AuthService {
    private authRepository: AuthRepository;
    private readonly MAX_LOGIN_ATTEMPTS = 5;
    private readonly LOCK_TIME_MINUTES = 15;
    private readonly RESET_TOKEN_EXPIRY_MINUTES = 60; // 1 hour

    constructor() {
        this.authRepository = new AuthRepository();
    }

    async verifyCredentials(email: string, password: string) {
        if (!email || !password) {
            throw new Error("Email and password are required");
        }

        const user = await this.authRepository.findByEmailWithPassword(email);

        if (!user) {
            return null;
        }

        // 1. Check if account is locked
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remaining = Math.ceil((new Date(user.lockedUntil).getTime() - new Date().getTime()) / 60000);
            throw new Error(`Account is locked. Try again in ${remaining} minutes.`);
        }

        // 2. Verify password
        const isMatch = await bcrypt.compare(password, user.password || "");
        const isPlainMatch = user.password === password; // Legacy fallback

        if (!isMatch && !isPlainMatch) {
            let lockUntil: Date | undefined;
            if ((user.loginAttempts || 0) + 1 >= this.MAX_LOGIN_ATTEMPTS) {
                lockUntil = new Date(Date.now() + this.LOCK_TIME_MINUTES * 60000);
            }

            await this.authRepository.incrementLoginAttempts(user._id.toString(), lockUntil);

            if (lockUntil) {
                throw new Error(`Account locked due to too many failed attempts. Try again in ${this.LOCK_TIME_MINUTES} minutes.`);
            }

            return null;
        }

        // 3. Success: Reset attempts
        await this.authRepository.resetLoginAttempts(user._id.toString());

        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image || user.metadata?.avatar,
            schools: user.schools,
            schoolId: user.schools && user.schools.length > 0 ? user.schools[0].toString() : undefined
        };
    }

    getAuthProviders() {
        return {
            providers: authStrategyManager.getUIStrategies(),
            status: authStrategyManager.getConfigStatus()
        };
    }

    /**
     * Request a password reset
     * Generates a token, hashes it, stores it, and sends the email
     */
    async requestPasswordReset(email: string) {
        if (!email) {
            throw new Error("Email is required");
        }

        await connectDB();

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal whether the email exists
            console.log(`[Auth] Password reset requested for non-existent email: ${email}`);
            return { success: true };
        }

        // Generate a random token
        const rawToken = crypto.randomBytes(32).toString('hex');

        // Hash for storage (never store raw tokens)
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Set expiry
        const expires = new Date(Date.now() + this.RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        // Save to DB
        await this.authRepository.saveResetToken(user._id.toString(), hashedToken, expires);

        // Build the reset URL with raw token
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

        // Send the email
        await sendPasswordResetEmail(email, user.name || 'Utilisateur', resetUrl);

        console.log(`[Auth] Password reset email sent to: ${email}`);
        return { success: true };
    }

    /**
     * Reset the password using the token
     */
    async resetPassword(token: string, newPassword: string) {
        if (!token || !newPassword) {
            throw new Error("Token and new password are required");
        }

        if (newPassword.length < 6) {
            throw new Error("Le mot de passe doit contenir au moins 6 caractères");
        }

        // Hash the provided token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        console.log(`[Auth] Attempting password reset with hashed token: ${hashedToken.substring(0, 12)}...`);

        // Find user with this token that hasn't expired
        const user = await this.authRepository.findByResetToken(hashedToken);

        if (!user) {
            throw new Error("Lien de réinitialisation invalide ou expiré");
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear token
        await this.authRepository.updatePassword(user._id.toString(), hashedPassword);

        console.log(`[Auth] Password reset successful for: ${user.email}`);
        return { success: true };
    }

    async verifyGoogle(idToken?: string, userPayload?: GoogleUserPayload) {
        const profile = await this.getGoogleProfile(idToken, userPayload);

        await connectDB();

        const email = profile.email.toLowerCase();
        let user = await User.findOne({ email });

        if (user) {
            user.name = profile.name || user.name;
            user.image = profile.picture || user.image;
            user.googleId = profile.sub || user.googleId;
            if (typeof profile.email_verified === "boolean") {
                user.emailVerified = profile.email_verified;
            }
            user.lastLogin = new Date();
            await user.save();
        } else {
            user = await User.create({
                name: profile.name,
                email,
                image: profile.picture,
                googleId: profile.sub,
                emailVerified: profile.email_verified,
                lastLogin: new Date()
            });
        }

        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image || user.metadata?.avatar,
            schools: user.schools,
            schoolId: user.schools && user.schools.length > 0 ? user.schools[0].toString() : undefined
        };
    }

    private async getGoogleProfile(idToken?: string, userPayload?: GoogleUserPayload) {
        if (!idToken) {
            if (process.env.NODE_ENV === "development" && userPayload?.email) {
                return {
                    email: userPayload.email,
                    name: userPayload.name,
                    picture: userPayload.image,
                    sub: userPayload.id
                };
            }
            const error: any = new Error("Google idToken is required");
            error.status = 400;
            throw error;
        }

        const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
        const response = await fetch(tokenInfoUrl);
        if (!response.ok) {
            const error: any = new Error("Invalid Google token");
            error.status = 401;
            throw error;
        }

        const data = await response.json();
        if (!data?.email) {
            const error: any = new Error("Invalid Google token payload");
            error.status = 401;
            throw error;
        }

        if (process.env.GOOGLE_CLIENT_ID && data.aud !== process.env.GOOGLE_CLIENT_ID) {
            const error: any = new Error("Google token audience mismatch");
            error.status = 401;
            throw error;
        }

        return {
            email: data.email,
            email_verified: data.email_verified === true || data.email_verified === "true",
            name: data.name,
            picture: data.picture,
            sub: data.sub
        };
    }
}
