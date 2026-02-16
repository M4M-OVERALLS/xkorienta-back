import { AuthController } from "@/lib/controllers/AuthController";

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 */
export async function POST(req: Request) {
    return AuthController.forgotPassword(req);
}
