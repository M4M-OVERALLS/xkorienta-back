/**
 * HuggingFace Parsing Strategy
 *
 * Utilise les modeles open-source via router.huggingface.co
 * pour parser du texte brut en structure syllabus.
 *
 * Modeles supportes : Mistral-7B, Llama-3.2, Phi-3-mini
 * Cout : quasi gratuit via HuggingFace free tier
 */

import { IAIParsingStrategy, ParsedSyllabusDTO } from './IAIParsingStrategy'
import { SYLLABUS_PARSING_PROMPTS } from '../prompts/syllabusParsingPrompt'
import { z } from 'zod'

/** Schema Zod pour valider la reponse de l'IA */
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

const MODELS = [
    'Qwen/Qwen2.5-7B-Instruct',
    'HuggingFaceH4/zephyr-7b-beta',
    'google/gemma-2-2b-it',
]

/**
 * router.huggingface.co est l'endpoint accessible.
 * On force le provider "hf-inference" (serverless gratuit HF)
 * pour eviter l'erreur "not supported by any provider you have enabled".
 */
const BASE_URL = 'https://router.huggingface.co/v1/chat/completions'
const HF_PROVIDER = 'hf-inference'

export class HuggingFaceParsingStrategy implements IAIParsingStrategy {
    readonly id = 'huggingface'
    readonly name = 'HuggingFace (Mistral/Llama/Phi)'

    /**
     * Verifie si la cle API est configuree
     */
    isEnabled(): boolean {
        return !!process.env.HUGGINGFACE_API_KEY
    }

    /**
     * Parse du texte brut en structure syllabus via HuggingFace
     */
    async parseToSyllabus(
        text: string,
        language: 'fr' | 'en' = 'fr',
        contentType: 'text' | 'image' = 'text'
    ): Promise<ParsedSyllabusDTO> {
        const apiKey = process.env.HUGGINGFACE_API_KEY
        if (!apiKey) {
            throw new Error('HUGGINGFACE_API_KEY is not configured')
        }

        const prompts = SYLLABUS_PARSING_PROMPTS[language]
        const systemPrompt = prompts.system
        const userPrompt = prompts.user(text)

        // Essayer chaque modele jusqu'a ce qu'un fonctionne
        let lastError: Error | null = null
        for (const model of MODELS) {
            try {
                const rawJson = await this.callAPI(model, systemPrompt, userPrompt, apiKey)
                return this.parseAndValidate(rawJson)
            } catch (error) {
                lastError = error as Error
                console.warn(`[HuggingFaceParsing] Model ${model} failed:`, (error as Error).message)
                continue
            }
        }

        // Ne pas leaker les details internes de l'API dans le message client
        throw new Error(
            'AI could not parse the document into a valid syllabus structure.'
        )
    }

    /**
     * Appel a l'API HuggingFace (format OpenAI-compatible)
     */
    private async callAPI(
        model: string,
        systemPrompt: string,
        userPrompt: string,
        apiKey: string
    ): Promise<string> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000)

        let response: Response
        try {
            response = await fetch(BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    provider: HF_PROVIDER,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    max_tokens: 2048,
                    temperature: 0.3,
                }),
                signal: controller.signal,
            })
        } finally {
            clearTimeout(timeout)
        }

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`HuggingFace API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()

        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Empty response from HuggingFace API')
        }

        return data.choices[0].message.content.trim()
    }

    /**
     * Parse le JSON brut retourne par l'IA et valide avec Zod.
     *
     * Strategies d'extraction (dans l'ordre) :
     *  1. JSON direct (le modele a respecte la consigne)
     *  2. Bloc markdown ```json ... ``` ou ``` ... ```
     *  3. Premier objet { ... } trouve dans le texte brut
     */
    private parseAndValidate(rawContent: string): ParsedSyllabusDTO {
        const parsed = this.extractJSON(rawContent)

        // Valider avec Zod
        const result = ParsedSyllabusSchema.safeParse(parsed)
        if (!result.success) {
            throw new Error(
                `AI could not parse the document into a valid syllabus structure. Validation errors: ${result.error.message}`
            )
        }

        return result.data as ParsedSyllabusDTO
    }

    /**
     * Tente d'extraire un objet JSON depuis une reponse IA brute.
     * Les petits modeles (7B) incluent souvent du texte autour du JSON.
     */
    private extractJSON(rawContent: string): unknown {
        const content = rawContent.trim()

        // Strategie 1 : JSON pur (le modele a bien suivi les instructions)
        try {
            return JSON.parse(content)
        } catch {
            // continue
        }

        // Strategie 2 : bloc markdown ```json ... ``` ou ``` ... ```
        const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (markdownMatch) {
            try {
                return JSON.parse(markdownMatch[1].trim())
            } catch {
                // continue
            }
        }

        // Strategie 3 : extraire le premier { ... } du texte brut
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
