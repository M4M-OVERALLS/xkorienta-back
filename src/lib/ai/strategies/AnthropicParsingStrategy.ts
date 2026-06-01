/**
 * Anthropic (Claude) Parsing Strategy
 *
 * Utilise l'API Claude via @anthropic-ai/sdk pour parser du texte
 * brut en structure syllabus. Claude excelle dans la generation de
 * JSON structure et suit strictement les instructions.
 *
 * Modele par defaut : claude-haiku-4-5-20251001 (rapide et economique)
 * Override possible via AI_ANTHROPIC_MODEL dans le .env
 */

import Anthropic from '@anthropic-ai/sdk'
import { IAIParsingStrategy, ParsedSyllabusDTO } from './IAIParsingStrategy'
import { SYLLABUS_PARSING_PROMPTS } from '../prompts/syllabusParsingPrompt'
import { z } from 'zod'

/** Schema Zod identique a HuggingFaceParsingStrategy */
const ParsedSyllabusSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional().default(''),
    learningObjectives: z.array(z.string()).optional().default([]),
    structure: z.object({
        chapters: z.array(z.object({
            title: z.string().min(1),
            description: z.string().optional().default(''),
            topics: z.array(z.object({
                title: z.string().min(1),
                content: z.string().optional().default(''),
                concepts: z.array(z.object({
                    title: z.string().min(1),
                    description: z.string().optional().default(''),
                })).optional().default([]),
            })).optional().default([]),
        })).min(1),
    }),
})

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export class AnthropicParsingStrategy implements IAIParsingStrategy {
    readonly id = 'anthropic'
    readonly name = 'Anthropic Claude (Haiku)'

    /**
     * Verifie si la cle API Anthropic est configuree
     */
    isEnabled(): boolean {
        return !!process.env.ANTHROPIC_API_KEY
    }

    /**
     * Parse du texte brut (ou image base64) en structure syllabus via Claude
     */
    async parseToSyllabus(
        text: string,
        language: 'fr' | 'en' = 'fr',
        contentType: 'text' | 'image' = 'text'
    ): Promise<ParsedSyllabusDTO> {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not configured')
        }

        const model = process.env.AI_ANTHROPIC_MODEL || DEFAULT_MODEL
        const prompts = SYLLABUS_PARSING_PROMPTS[language]

        const client = new Anthropic({ apiKey })

        // Build user message — vision for images, text for documents
        let userContent: Anthropic.MessageCreateParams['messages'][0]['content']

        if (contentType === 'image') {
            // text contains a data URI like "data:image/jpeg;base64,/9j/4AA..."
            const match = text.match(/^data:(image\/\w+);base64,(.+)$/)
            if (!match) {
                throw new Error('Invalid image data URI')
            }
            const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
            const base64Data = match[2]

            userContent = [
                {
                    type: 'image' as const,
                    source: { type: 'base64' as const, media_type: mediaType, data: base64Data },
                },
                {
                    type: 'text' as const,
                    text: prompts.user('[Image du syllabus ci-dessus — extrais le contenu et structure-le]'),
                },
            ]
        } else {
            userContent = prompts.user(text)
        }

        const message = await client.messages.create({
            model,
            max_tokens: 4096,
            system: prompts.system,
            messages: [
                { role: 'user', content: userContent },
            ],
        })

        const rawContent = message.content
            .filter((block) => block.type === 'text')
            .map((block) => (block as { type: 'text'; text: string }).text)
            .join('')
            .trim()

        return this.parseAndValidate(rawContent)
    }

    /**
     * Extrait et valide le JSON retourne par Claude.
     * Claude respecte generalement les instructions JSON,
     * mais on garde les fallbacks par precaution.
     */
    private parseAndValidate(rawContent: string): ParsedSyllabusDTO {
        const parsed = this.extractJSON(rawContent)

        const result = ParsedSyllabusSchema.safeParse(parsed)
        if (!result.success) {
            throw new Error(
                `AI could not parse the document into a valid syllabus structure. Validation errors: ${result.error.message}`
            )
        }

        return result.data as ParsedSyllabusDTO
    }

    private extractJSON(rawContent: string): unknown {
        const content = rawContent.trim()

        // Strategie 1 : JSON pur
        try {
            return JSON.parse(content)
        } catch {
            // continue
        }

        // Strategie 2 : bloc markdown ```json ... ```
        const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (markdownMatch) {
            try {
                return JSON.parse(markdownMatch[1].trim())
            } catch {
                // continue
            }
        }

        // Strategie 3 : premier { ... } dans le texte
        const firstBrace = content.indexOf('{')
        const lastBrace = content.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                return JSON.parse(content.substring(firstBrace, lastBrace + 1))
            } catch {
                // continue
            }
        }

        throw new Error(
            'AI could not parse the document into a valid syllabus structure. Invalid JSON received.'
        )
    }
}
