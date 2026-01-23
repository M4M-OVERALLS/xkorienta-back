import connectDB from "@/lib/mongodb";
import { registrationLimiter, getClientIdentifier, createRateLimitResponse } from "@/lib/security/rateLimiter";
import { RegistrationController } from "@/lib/controllers/RegistrationController";

/**
 * POST /api/register
 * Register user without role (for onboarding flow)
 */
export async function POST(req: Request) {
    // Apply rate limiting
    const identifier = getClientIdentifier(req);
    const rateLimitResult = registrationLimiter(identifier);

    if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult.resetTime);
    }

    await connectDB();
    return RegistrationController.registerWithoutRole(req);
}
