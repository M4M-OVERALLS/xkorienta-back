import { PlanController } from '@/lib/controllers/PlanController'

/** GET /api/plans — Get all available plans */
export async function GET() {
    return PlanController.getAll()
}
