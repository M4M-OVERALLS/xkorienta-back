import { NextAuthOptions } from "next-auth"
import { authStrategyManager } from "./auth/strategies/AuthStrategyManager"
import User from "@/models/User"
import connectDB from "@/lib/mongodb"

/**
 * NextAuth Configuration with Strategy Pattern
 *
 * This configuration uses the Strategy Pattern to manage authentication providers.
 * All providers are managed through AuthStrategyManager.
 *
 * To add a new authentication provider:
 * 1. Create a new strategy class in lib/auth/strategies/
 * 2. Register it in AuthStrategyManager
 * 3. Add required environment variables
 * 4. That's it! The provider will automatically appear in the UI
 */
export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: "/login",
        error: "/login", // Redirect to login page on error
    },
    debug: process.env.NODE_ENV === "development",

    // Get all enabled providers from Strategy Manager
    providers: authStrategyManager.getEnabledProviders(),

    callbacks: {
        /**
         * Handle sign-in
         * Delegates to the appropriate strategy
         */
        async signIn({ user, account, profile }) {
            if (!account || !profile) return true

            // For OAuth providers, handle user creation/update
            if (account.provider !== "credentials") {
                const success = await authStrategyManager.handleSignIn(
                    account.provider,
                    profile,
                    account
                )
                return success
            }

            return true
        },

        /**
         * Redirect after authentication
         */
        async redirect({ url, baseUrl }) {
            // Allows relative callback URLs
            if (url.startsWith("/")) return `${baseUrl}${url}`
            // Allows callback URLs on the same origin
            else if (new URL(url).origin === baseUrl) return url
            return baseUrl
        },

        /**
         * Session callback - add user data to session
         */
        async session({ session, token }) {
            try {
                if (token && session.user) {
                    session.user.id = token.id as string
                    session.user.role = token.role
                    session.user.name = token.name as string
                    session.user.image = token.picture as string
                    session.user.schools = token.schools || []
                }
            } catch (error) {
                console.error("Error in session callback:", error)
            }
            return session
        },

        /**
         * JWT callback - add user data to token
         */
        async jwt({ token, user, account, profile }) {
            try {
                // Initial sign in
                if (user) {
                    // Fetch user from DB to get the role
                    // We need to do this because we're not using a database adapter
                    // so the 'user' object here doesn't have our DB fields
                    try {
                        await connectDB()
                        // user.email may contain a phone number for phone-only users
                        const identifier = (user.email || "") as string
                        const isPhone = /^\+?[0-9]{8,15}$/.test(identifier)
                        const dbUser = isPhone
                            ? await User.findOne({ phone: identifier }).lean()
                            : await User.findOne({ email: identifier }).lean()
                        if (dbUser) {
                            token.id = dbUser._id.toString()
                            token.role = dbUser.role
                            token.name = dbUser.name
                            token.picture = dbUser.image || dbUser.metadata?.avatar
                            token.schools = dbUser.schools?.map((id: any) => id.toString()) || []
                            // Store the real phone in token if phone-only user
                            if (isPhone) token.phone = identifier
                        } else {
                            console.warn(`[Auth] User not found in DB: ${identifier}`)
                        }
                    } catch (error) {
                        console.error("Error fetching user in JWT callback:", error)
                        // Continue with existing token data
                    }
                } else if (token.email || token.phone) {
                    // On subsequent calls, check if role has been updated (e.g. after onboarding)
                    // This ensures the session updates immediately after role selection
                    try {
                        await connectDB()
                        const identifier = (token.email || token.phone) as string
                        const isPhone = !token.email && !!token.phone
                        const dbUser = isPhone
                            ? await User.findOne({ phone: identifier }).lean()
                            : await User.findOne({ email: identifier }).lean()
                        if (dbUser) {
                            if (dbUser.role !== token.role) {
                                console.log(`[Auth] Role updated for ${identifier}: ${token.role} -> ${dbUser.role}`)
                                token.role = dbUser.role
                            }
                            // Always refresh schools
                            token.schools = dbUser.schools?.map((id: any) => id.toString()) || []
                        }
                    } catch (error) {
                        console.error("Error refreshing user role:", error)
                        // Continue with existing token data
                    }
                }
            } catch (error) {
                console.error("Critical error in JWT callback:", error)
                // Return token as-is to avoid breaking authentication
            }

            return token
        },
    },

    // Events for logging and debugging
    events: {
        async signIn({ user, account, profile, isNewUser }) {
            console.log(`[Auth] User signed in: ${user.email} via ${account?.provider}`)
            if (isNewUser) {
                console.log(`[Auth] New user created: ${user.email}`)
            }
        },
        async signOut({ token }) {
            console.log(`[Auth] User signed out: ${token.email}`)
        },
    },
}

/**
 * Export Strategy Manager for use in other parts of the app
 */
export { authStrategyManager }
