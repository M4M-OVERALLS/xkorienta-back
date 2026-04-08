import { NextResponse } from 'next/server'
import { ExamServiceV4 } from '@/lib/services/ExamServiceV4'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const category = searchParams.get('category') as any

        const templates = await ExamServiceV4.listTemplates(category ? { category } : undefined)

        return NextResponse.json({
            success: true,
            data: templates,
            count: templates.length
        })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
