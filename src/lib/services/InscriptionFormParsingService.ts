/**
 * InscriptionFormParsingService
 *
 * Parse un document d'inscription (PDF, DOCX, image) via Claude
 * pour extraire automatiquement les champs, domaines, documents requis et prix.
 *
 * Pattern identique a SyllabusParsingService :
 *   validation fichier -> extraction texte -> Claude parse -> Zod validation
 */

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { FileExtractionService } from '@/lib/services/FileExtractionService'

// ── Zod schema pour le resultat du parsing ─────────────────────────────────

const ParsedFormFieldSchema = z.object({
    id: z.string(),
    type: z.enum(['TEXT', 'SELECT', 'CHECKBOX_GROUP', 'FILE']),
    label: z.string().min(1),
    required: z.boolean(),
    options: z.array(z.string()).default([]),
    group: z.string().optional(),
})

const ParsedDomainGroupSchema = z.object({
    name: z.string().min(1),
    fields: z.array(z.string()).min(1),
})

const ParsedInscriptionFormSchema = z.object({
    title: z.string().optional(),
    formFields: z.array(ParsedFormFieldSchema).default([]),
    domainGroups: z.array(ParsedDomainGroupSchema).default([]),
    docsRequired: z.array(z.string()).default([]),
    price: z.number().optional(),
})

export type ParsedInscriptionForm = z.infer<typeof ParsedInscriptionFormSchema>

// ── Prompt Claude ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un assistant specialise dans l'extraction de donnees structurees depuis des fiches d'inscription scolaire camerounaises.

On te donne le contenu d'un document d'inscription ou de pre-inscription. Tu dois en extraire :

1. **title** : Le titre du document ou de la campagne d'inscription (optionnel)
2. **formFields** : Les champs que le candidat doit remplir. Pour chaque champ :
   - id : un identifiant snake_case unique (ex: "nom_prenoms", "telephone", "email")
   - type : TEXT (texte libre), SELECT (choix unique), CHECKBOX_GROUP (choix multiples), FILE (document)
   - label : le libelle en francais
   - required : true si le champ est obligatoire
   - options : liste des choix possibles (pour SELECT et CHECKBOX_GROUP)
   - group : "parent" si le champ concerne les informations du parent/tuteur, vide sinon
3. **domainGroups** : Les domaines et filieres proposes, groupes par secteur. Pour chaque groupe :
   - name : nom du domaine (ex: "Commerce, Gestion, Droit")
   - fields : liste des filieres/specialites disponibles
4. **docsRequired** : La liste des documents a fournir (ex: "Acte de naissance", "Dernier diplome obtenu")
5. **price** : Le montant des frais d'inscription en FCFA (juste le nombre, optionnel)

Reponds UNIQUEMENT en JSON valide, sans texte autour. Pas de commentaires, pas de markdown.`

const USER_PROMPT_PREFIX = `Extrais les informations structurees du document d'inscription suivant :\n\n`

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const MAX_TEXT_LENGTH = 30_000

// ── Service ────────────────────────────────────────────────────────────────

export class InscriptionFormParsingService {
    /**
     * Parse un fichier d'inscription via Claude.
     * Retourne les donnees structurees pour pre-remplir le formulaire admin.
     */
    static async parseDocument(file: File): Promise<ParsedInscriptionForm> {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY non configure')
        }

        // 1. Valider et extraire le texte
        FileExtractionService.validateFile(file)
        const extraction = await FileExtractionService.extractText(file)

        // 2. Construire le message Claude
        const model = process.env.AI_ANTHROPIC_MODEL || DEFAULT_MODEL
        const client = new Anthropic({ apiKey })

        let userContent: Anthropic.MessageCreateParams['messages'][0]['content']

        if (extraction.type === 'image') {
            const match = extraction.text.match(/^data:(image\/\w+);base64,(.+)$/)
            if (!match) throw new Error('Format image invalide')

            const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
            const base64Data = match[2]

            userContent = [
                {
                    type: 'image' as const,
                    source: { type: 'base64' as const, media_type: mediaType, data: base64Data },
                },
                {
                    type: 'text' as const,
                    text: USER_PROMPT_PREFIX + '(voir image ci-dessus)',
                },
            ]
        } else {
            const truncated = extraction.text.length > MAX_TEXT_LENGTH
                ? extraction.text.slice(0, MAX_TEXT_LENGTH) + '\n\n[Document tronque a 30 000 caracteres]'
                : extraction.text

            userContent = USER_PROMPT_PREFIX + truncated
        }

        // 3. Appeler Claude
        const response = await client.messages.create({
            model,
            max_tokens: 4000,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userContent }],
        })

        // 4. Extraire le JSON de la reponse
        const textBlock = response.content.find((b) => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            throw new Error('Reponse Claude vide')
        }

        const rawJson = InscriptionFormParsingService.extractJson(textBlock.text)
        if (!rawJson) {
            throw new Error('Impossible d\'extraire le JSON de la reponse Claude')
        }

        // 5. Valider avec Zod
        const parsed = ParsedInscriptionFormSchema.safeParse(rawJson)
        if (!parsed.success) {
            throw new Error(`Validation echouee : ${parsed.error.issues.map((i) => i.message).join(', ')}`)
        }

        return parsed.data
    }

    /**
     * Extrait un objet JSON depuis une chaine (avec fallback).
     */
    private static extractJson(text: string): unknown {
        const cleaned = text.trim()

        // Tentative 1 : JSON pur
        try {
            return JSON.parse(cleaned)
        } catch { /* continue */ }

        // Tentative 2 : extraire du markdown ```json ... ```
        const mdMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        if (mdMatch) {
            try {
                return JSON.parse(mdMatch[1].trim())
            } catch { /* continue */ }
        }

        // Tentative 3 : trouver les premieres accolades
        const braceStart = cleaned.indexOf('{')
        const braceEnd = cleaned.lastIndexOf('}')
        if (braceStart !== -1 && braceEnd > braceStart) {
            try {
                return JSON.parse(cleaned.slice(braceStart, braceEnd + 1))
            } catch { /* continue */ }
        }

        return null
    }
}
