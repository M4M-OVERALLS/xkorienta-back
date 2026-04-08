import connectDB from '@/lib/mongodb'
import { SchoolSearchService } from '@/lib/services/SchoolSearchService'
import { NextResponse } from 'next/server'

/**
 * GET /api/schools/search
 *
 * Recherche d'écoles validées avec fuzzy matching.
 * Utilisé par le formulaire d'inscription autonome pour suggérer des écoles.
 *
 * Query params:
 *   ?q=string       Terme de recherche (obligatoire)
 *   &city=string    Filtrer par ville (optionnel)
 *   &type=string    Filtrer par type (optionnel)
 *   &limit=number   Nombre de résultats (défaut: 10)
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)

        const q = searchParams.get('q') || ''
        const city = searchParams.get('city') || undefined
        const type = searchParams.get('type') || undefined
        const limit = parseInt(searchParams.get('limit') || '10', 10)

        if (!q || q.trim().length < 2) {
            return NextResponse.json(
                { schools: [], hasExactMatch: false },
                { status: 200 }
            )
        }

        await connectDB()

        const result = await SchoolSearchService.searchSchools({ q, city, type, limit })

        return NextResponse.json(result, { status: 200 })

    } catch (error: any) {
        console.error('[Schools Search] Error:', error)
        return NextResponse.json(
            { error: 'Erreur lors de la recherche d\'écoles' },
            { status: 500 }
        )
    }
}
