import CredentialsProvider from "next-auth/providers/credentials"
import { Provider } from "next-auth/providers/index"
import { BaseAuthStrategy } from "./AuthStrategy"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import bcrypt from "bcryptjs"

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
                if (!credentials?.identifier || !credentials?.password) {
                    throw new Error("Identifiant et mot de passe requis")
                }

                await connectDB()

                const identifier = credentials.identifier.trim()
                const isPhone = /^\+?[0-9]{8,15}$/.test(identifier)

                const query = isPhone
                    ? { phone: identifier }
                    : { email: identifier.toLowerCase() }

                const user = await User.findOne(query)

                if (!user) {
                    throw new Error(
                        isPhone
                            ? "Aucun compte trouvé avec ce numéro de téléphone"
                            : "Aucun utilisateur trouvé avec cet email"
                    )
                }

                // Check if user has a password (OAuth users don't)
                if (!user.password) {
                    throw new Error("Ce compte utilise une autre méthode de connexion")
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                )

                if (!isPasswordValid) {
                    throw new Error("Mot de passe incorrect")
                }

                return {
                    id: user._id.toString(),
                    email: user.email || user.phone || "",
                    name: user.name,
                    role: user.role,
                    image: user.image || null,
                }
            },
        })
    }

    isEnabled(): boolean {
        // Credentials auth is always enabled
        return true
    }
}
