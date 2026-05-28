/**
 * Strategy Pattern — Interface pour le parsing IA de syllabus
 *
 * Chaque implementation (HuggingFace, OpenAI, Anthropic, etc.)
 * doit respecter ce contrat. On change de provider via AI_PARSING_PROVIDER.
 */

export interface ParsedSyllabusDTO {
    title: string
    description: string
    learningObjectives: string[]
    structure: {
        chapters: Array<{
            title: string
            description: string
            topics: Array<{
                title: string
                content: string
                concepts: Array<{
                    title: string
                    description: string
                }>
            }>
        }>
    }
}

export interface IAIParsingStrategy {
    /** Identifiant unique (ex: "huggingface", "openai") */
    readonly id: string

    /** Nom affichable */
    readonly name: string

    /** Verifie si la strategie est configuree (cles API presentes) */
    isEnabled(): boolean

    /**
     * Parse du texte brut en structure syllabus.
     * @param text - Texte extrait du document (ou base64 pour images)
     * @param language - Langue du document
     * @param contentType - Type de contenu ("text" ou "image")
     */
    parseToSyllabus(
        text: string,
        language: 'fr' | 'en',
        contentType?: 'text' | 'image'
    ): Promise<ParsedSyllabusDTO>
}
