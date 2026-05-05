import { NextResponse } from "next/server"
import { swaggerSpec } from "@/lib/swagger/spec"

/**
 * GET /api/swagger
 * Serves the OpenAPI 3.0 specification as JSON
 */
export async function GET() {
    return NextResponse.json(swaggerSpec)
}
