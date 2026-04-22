import { NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/SubscriptionService'
import { planRepository } from '@/lib/repositories/PlanRepository'
import { IPlan } from '@/models/Plan'

export class PlanController {
    /**
     * GET /api/plans
     * Get all available plans.
     */
    static async getAll() {
        const plans = await SubscriptionService.getAvailablePlans()

        return NextResponse.json({
            success: true,
            data: plans,
        })
    }

    /**
     * GET /api/plans/:code
     * Get plan details by code.
     */
    static async getByCode(code: string) {
        const plan = await SubscriptionService.getPlanByCode(code)

        if (!plan) {
            return NextResponse.json(
                { success: false, message: 'Plan not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: plan,
        })
    }

    /**
     * POST /api/admin/plans
     * Admin: Create a new plan.
     */
    static async create(req: Request) {
        const body = await req.json() as Partial<IPlan>

        if (!body.code || !body.name || !body.description) {
            return NextResponse.json(
                { success: false, message: 'Missing required fields: code, name, description' },
                { status: 400 }
            )
        }

        const existing = await planRepository.findByCode(body.code)
        if (existing) {
            return NextResponse.json(
                { success: false, message: 'Plan with this code already exists' },
                { status: 409 }
            )
        }

        const plan = await planRepository.create(body)

        return NextResponse.json({ success: true, data: plan }, { status: 201 })
    }

    /**
     * PUT /api/admin/plans/:id
     * Admin: Update a plan.
     */
    static async update(id: string, req: Request) {
        const body = await req.json() as Partial<IPlan>

        const plan = await planRepository.updateById(id, body)

        if (!plan) {
            return NextResponse.json(
                { success: false, message: 'Plan not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, data: plan })
    }

    /**
     * DELETE /api/admin/plans/:id
     * Admin: Deactivate a plan (soft delete).
     */
    static async deactivate(id: string) {
        const plan = await planRepository.updateById(id, { isActive: false })

        if (!plan) {
            return NextResponse.json(
                { success: false, message: 'Plan not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Plan deactivated',
            data: plan,
        })
    }
}
