import connectDB from "@/lib/mongodb";
import User from "@/models/User";

/**
 * Invalidation serveur des sessions JWT (A-SEC signout).
 * Incrémente tokenVersion sur l'utilisateur : tout JWT émis avant logout est rejeté.
 */
export class SessionInvalidationService {
  /**
   * Révoque toutes les sessions actives d'un utilisateur.
   */
  static async invalidateUserSessions(userId: string): Promise<void> {
    if (!userId) return;

    await connectDB();
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  }

  /**
   * Retourne la version courante du token pour un utilisateur.
   */
  static async getTokenVersion(userId: string): Promise<number> {
    await connectDB();
    const user = await User.findById(userId).select("tokenVersion").lean();
    return user?.tokenVersion ?? 0;
  }
}
