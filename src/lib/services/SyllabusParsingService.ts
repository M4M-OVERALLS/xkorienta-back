/**
 * SyllabusParsingService
 *
 * Orchestrateur : validation fichier → extraction texte → parsing IA → validation Zod
 * Ce service ne connait pas les details de l'IA utilisee (Strategy Pattern).
 */

import { FileExtractionService } from './FileExtractionService'
import { AIParsingStrategyManager } from '../ai/strategies/AIParsingStrategyManager'
import { ParsedSyllabusDTO } from '../ai/strategies/IAIParsingStrategy'

export interface SyllabusParseResult extends ParsedSyllabusDTO {
    /** Texte brut extrait du document (pour affichage/debug) */
    rawText: string
}

/** Limite de caracteres envoyes a l'IA (environ 8K tokens) */
const MAX_TEXT_LENGTH = 30_000

export class SyllabusParsingService {
    /**
     * Parse un fichier uploade en structure syllabus.
     *
     * Flux : validation → extraction texte → truncation → envoi a l'IA → retour structure
     *
     * @param file - Fichier uploade (File object)
     * @returns Structure syllabus parsee + apercu du texte brut
     * @throws Error avec messages specifiques selon le type d'erreur
     */
    static async parseFile(file: File): Promise<SyllabusParseResult> {
        // 1. Validation du fichier (type, taille)
        FileExtractionService.validateFile(file)

        // 2. Extraction du texte
        const extraction = await FileExtractionService.extractText(file)

        // 3. Images : les modeles texte HuggingFace ne supportent pas la vision
        if (extraction.type === 'image') {
            throw new Error(
                'AI could not parse the document into a valid syllabus structure. Image parsing requires a vision-capable model. Please upload a PDF or DOCX.'
            )
        }

        // 4. Truncation du texte pour respecter la fenetre de contexte IA
        const textForAI = extraction.text.length > MAX_TEXT_LENGTH
            ? extraction.text.substring(0, MAX_TEXT_LENGTH)
            : extraction.text

        // 5. Parsing IA via la strategie active
        const manager = AIParsingStrategyManager.getInstance()
        const strategy = manager.getActiveStrategy()

        const parsed = await strategy.parseToSyllabus(textForAI, 'fr', 'text')

        // 6. Retourner le resultat avec un apercu du texte (pas le texte complet)
        return {
            ...parsed,
            rawText: extraction.text.substring(0, 500),
        }
    }
}
