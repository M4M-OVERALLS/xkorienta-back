import GitHubProvider from "next-auth/providers/github"
import { Provider } from "next-auth/providers/index"
import { BaseAuthStrategy } from "./AuthStrategy"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { UserRole } from "@/models/enums"

/**
 * GitHub OAuth Authentication Strategy
 *
 * Allows users to sign in with their GitHub account
 * This demonstrates how easy it is to add new providers with the Strategy Pattern
 */
export class GitHubAuthStrategy extends BaseAuthStrategy {
    readonly id = "github"
    readonly name = "GitHub"
    readonly icon = "github"

    getProvider(): Provider {
        return GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        })
    }

    /**
     * Handle GitHub sign-in
     */
    async handleSignIn(profile: any, account: any): Promise<boolean> {
        try {
            await connectDB()

            let user = await User.findOne({ email: profile.email })

            if (user) {
                // Update existing user
                user.name = profile.name || user.name
                user.image = profile.avatar_url || user.image
                user.githubId = profile.id

                if (!user.role) {
                    user.role = UserRole.STUDENT
                }

                await user.save()
            } else {
                // Create new user
                user = await User.create({
                    name: profile.name || profile.login,
                    email: profile.email.toLowerCase(),
                    image: profile.avatar_url,
                    githubId: profile.id,
                    role:  UserRole.STUDENT,
                    studentCode: Math.random().toString(36).substring(2, 10).toUpperCase()
                })
            }

            return true
        } catch (error) {
            console.error("[GitHubStrategy] Error during sign-in:", error)
            return false
        }
    }

    isEnabled(): boolean {
        return this.checkEnvVars("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET")
    }
}
