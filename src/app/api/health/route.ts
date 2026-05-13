import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Health check endpoint for Docker/Kubernetes health probes
 * A-03: No config, version, or service info exposed
 */
export async function GET() {
    return NextResponse.json(
        { status: 'ok' },
        { status: 200 }
    );
}
