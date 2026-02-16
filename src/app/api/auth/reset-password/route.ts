import { AuthController } from "@/lib/controllers/AuthController";

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
export async function POST(req: Request) {
    return AuthController.resetPassword(req);
}
