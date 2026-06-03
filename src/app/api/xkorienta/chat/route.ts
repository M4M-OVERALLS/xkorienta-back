/**
 * POST /api/xkorienta/chat
 *
 * Endpoint de chat conversationnel pour l'agent IA Xkorienta.
 * Retourne une réponse en streaming (SSE) depuis Claude.
 *
 * Optimisations tokens :
 * - Context window trimming : ancre (2 premiers) + fenêtre glissante (10 derniers)
 * - Adaptive model : haiku pour les échanges, sonnet pour le rapport final
 * - Adaptive max_tokens : 800 (chat) → 2500 (rapport)
 * - System prompt filtré par langue : BTS (fr) ou HND (en) uniquement
 *
 * - Auth : aucune (endpoint public — orientation accessible à tous)
 * - Rate limit : 20 messages/min par IP
 * - Input  : { messages: {role, content}[], level: string, language: 'fr' | 'en' }
 * - Output : text/event-stream — événements { text: string } | [DONE] | { error: string }
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { rateLimit, getClientIdentifier, createRateLimitResponse } from '@/lib/security/rateLimiter'
import { XOrientationError, ErrorHandler, BaseApplicationError, LanguageHelper } from '@/lib/errors'
import {
    getXkorientaSystemPrompt,
    XKORIENTA_MODEL,
    XKORIENTA_CHAT_MODEL,
    XKORIENTA_MAX_TOKENS,
    XKORIENTA_CHAT_MAX_TOKENS,
    XKORIENTA_REPORT_THRESHOLD,
    XKORIENTA_CONTEXT_WINDOW,
    XKORIENTA_ANCHOR_SIZE,
} from '@/lib/ai/prompts/xkorientaSystemPrompt'

/** Rate limiter : 20 messages par minute par IP */
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 20,
})

const MessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(32000),
})

const ChatRequestSchema = z.object({
    messages: z.array(MessageSchema).min(1).max(50),
    level: z.string().min(1).max(50),
    language: z.enum(['fr', 'en']).default('fr'),
})

type ApiMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Réduit l'historique pour limiter les tokens d'entrée.
 * Conserve les ANCHOR_SIZE premiers messages (contexte initial)
 * plus les (CONTEXT_WINDOW - ANCHOR_SIZE) messages les plus récents.
 */
function trimMessages(messages: ApiMessage[]): ApiMessage[] {
    if (messages.length <= XKORIENTA_CONTEXT_WINDOW) return messages
    const anchor = messages.slice(0, XKORIENTA_ANCHOR_SIZE)
    const recent = messages.slice(-(XKORIENTA_CONTEXT_WINDOW - XKORIENTA_ANCHOR_SIZE))
    return [...anchor, ...recent]
}

/**
 * Détecte si on est en phase de génération du rapport final.
 * Bascule vers sonnet + max_tokens élevé quand :
 * - La conversation est longue (≥ seuil) — l'IA a collecté les 8 dimensions
 * - L'utilisateur demande explicitement un résumé / rapport
 */
function isReportPhase(messages: ApiMessage[]): boolean {
    if (messages.length >= XKORIENTA_REPORT_THRESHOLD) return true
    const reportKeywords = ['rapport', 'bilan', 'résumé', 'conclusion', 'report', 'summary', 'orientation finale', 'analyse complète']
    return messages.slice(-3).some((m) =>
        reportKeywords.some((kw) => m.content.toLowerCase().includes(kw))
    )
}

export async function POST(req: Request): Promise<Response> {
    // 1. Rate limiting (avant tout — réponse custom)
    const identifier = getClientIdentifier(req)
    const rateLimitResult = chatLimiter(`xkorienta:${identifier}`)
    if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult.resetTime)
    }

    const language = LanguageHelper.getLanguageFromRequest(req)

    try {
        // 2. Clé API Anthropic
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) throw XOrientationError.apiKeyMissing(language)

        // 3. Validation du body
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw XOrientationError.invalidJsonBody(language)
        }

        const parseResult = ChatRequestSchema.safeParse(body)
        if (!parseResult.success) {
            throw XOrientationError.invalidParameters(language, {
                errors: parseResult.error.flatten() as unknown as Record<string, unknown>,
            })
        }

        const { messages: rawMessages, language: lang } = parseResult.data

        // 4. Optimisations tokens
        const messages = trimMessages(rawMessages)
        const reportPhase = isReportPhase(messages)
        const model = reportPhase ? XKORIENTA_MODEL : XKORIENTA_CHAT_MODEL
        const maxTokens = reportPhase ? XKORIENTA_MAX_TOKENS : XKORIENTA_CHAT_MAX_TOKENS
        const systemPrompt = getXkorientaSystemPrompt(lang)

        // 5. Appel Anthropic en streaming
        const client = new Anthropic({ apiKey })

        let stream: Awaited<ReturnType<typeof client.messages.create>>
        try {
            stream = await client.messages.create({
                model,
                max_tokens: maxTokens,
                system: systemPrompt,
                stream: true,
                messages,
            })
        } catch (anthropicErr) {
            throw XOrientationError.anthropicError(
                anthropicErr instanceof Error ? anthropicErr.message : 'Unknown',
                language
            )
        }

        // 6. Pipe du stream Anthropic vers SSE
        const encoder = new TextEncoder()
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of stream) {
                        if (
                            event.type === 'content_block_delta' &&
                            event.delta.type === 'text_delta'
                        ) {
                            const chunk = JSON.stringify({ text: event.delta.text })
                            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
                        }
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                } catch (streamError) {
                    const err = XOrientationError.streamError(
                        streamError instanceof Error ? streamError.message : 'Stream error',
                        language
                    )
                    err.log() // capture Sentry via BaseError.log()
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
                    )
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        })
    } catch (error: unknown) {
        if (error instanceof BaseApplicationError) {
            error.log()
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }
        Sentry.captureException(error)
        return ErrorHandler.handleError(error)
    }
}
