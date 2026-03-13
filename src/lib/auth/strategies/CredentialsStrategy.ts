import CredentialsProvider from "next-auth/providers/credentials"
import { Provider } from "next-auth/providers/index"
import { BaseAuthStrategy } from "./AuthStrategy"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import bcrypt from "bcryptjs"
import { AuthenticationError } from "@/lib/errors"

/**
 * Credentials (Email/Password/Phone) Authentication Strategy
 *
 * Supports login via email OR phone number + password
 */
export class CredentialsAuthStrategy extends BaseAuthStrategy {
    readonly id = "credentials"
    readonly name = "Email, Téléphone & Mot de passe"
    readonly icon = "mail"

    getProvider(): Provider {
        return CredentialsProvider({
            id: this.id,
            name: this.name,
            credentials: {
                identifier: {
                    label: "Email ou Téléphone",
                    type: "text",
                    placeholder: "email@exemple.com ou 6XXXXXXXX"
                },
                password: {
                    label: "Mot de passe",
                    type: "password"
                },
            },
            async authorize(credentials) {
                try {
                    if (!credentials?.identifier || !credentials?.password) {
                        throw AuthenticationError.missingCredentials()
                    }

                    await connectDB()

                    const identifier = credentials.identifier.trim()
                    const isPhone = /^\+?[0-9]{8,15}$/.test(identifier)

                    const query = isPhone
                        ? { phone: identifier }
                        : { email: identifier.toLowerCase() }

                    const user = await User.findOne(query)

                    if (!user) {
                        throw isPhone
                            ? AuthenticationError.userNotFoundByPhone(identifier)
                            : AuthenticationError.userNotFoundByEmail(identifier)
                    }

                    // Check if user has a password (OAuth users don't)
                    if (!user.password) {
                        throw AuthenticationError.differentAuthMethod(undefined, {
                            userId: user._id.toString(),
                        })
                    }

                    const isPasswordValid = await bcrypt.compare(
                        credentials.password,
                        user.password
                    )

                    if (!isPasswordValid) {
                        throw AuthenticationError.invalidPassword(undefined, {
                            userId: user._id.toString(),
                            identifier,
                        })
                    }

                    return {
                        id: user._id.toString(),
                        email: user.email || user.phone || "",
                        name: user.name,
                        role: user.role,
                        image: user.image || null,
                    }
                } catch (error) {
                    // Log the error before re-throwing
                    if (error instanceof AuthenticationError) {
                        error.log()
                    }
                    throw error
                }
            },
        })
    }

    isEnabled(): boolean {
        // Credentials auth is always enabled
        return true
    }
}
