import connectDB from "@/lib/mongodb";
import { StudentController } from "@/lib/controllers/StudentController";

/**
 * GET /api/student/orientation/schools
 * Liste des écoles proposées (établissements partenaires VALIDATED).
 * - Optionnel: ?search=...
 * - Fallback: mocks si DB indisponible (dev)
 */
export async function GET(req: Request) {
    await connectDB();
    return StudentController.getOrientationSchools(req);
}

