/**
 * FileExtractionService
 *
 * Extraction de texte depuis des fichiers PDF, DOCX, DOC et images.
 * - PDF : via pdf-parse (couche texte)
 * - DOCX/DOC : via mammoth.js (texte brut avec structure paragraphes)
 * - Images : conversion en base64 data URI
 *
 * Aucun fichier n'est stocke sur disque. Tout se passe en memoire.
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIME_TYPES: Record<string, 'pdf' | 'docx' | 'image'> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'docx',
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/png': 'image',
}

export interface ExtractionResult {
    /** Texte extrait (ou data URI base64 pour les images) */
    text: string
    /** Type de fichier detecte */
    type: 'pdf' | 'docx' | 'image'
}

export class FileExtractionService {
    /**
     * Valide le fichier : type MIME et taille
     * @throws Error si le fichier est invalide
     */
    static validateFile(file: File): void {
        if (file.size === 0) {
            throw new Error('File is empty.')
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error('File exceeds the 20 MB limit.')
        }

        const mimeType = file.type.toLowerCase()
        if (!ALLOWED_MIME_TYPES[mimeType]) {
            throw new Error('Unsupported file type. Use PDF, DOCX, or image.')
        }
    }

    /**
     * Extrait le texte du fichier selon son type.
     * Valide les magic bytes pour empecher les fichiers forges.
     */
    static async extractText(file: File): Promise<ExtractionResult> {
        const mimeType = file.type.toLowerCase()
        const fileType = ALLOWED_MIME_TYPES[mimeType]

        if (!fileType) {
            throw new Error('Unsupported file type. Use PDF, DOCX, or image.')
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        // Validation magic bytes (securite : empeche les fichiers forges)
        await this.validateMagicBytes(buffer, fileType)

        switch (fileType) {
            case 'pdf':
                return this.extractFromPDF(buffer)
            case 'docx':
                return this.extractFromDOCX(buffer)
            case 'image':
                return this.convertToBase64(buffer, mimeType)
        }
    }

    /**
     * Verifie les magic bytes du fichier pour confirmer son type reel.
     * Empeche un .exe renomme en .pdf d'etre accepte.
     */
    private static async validateMagicBytes(buffer: Buffer, declaredType: 'pdf' | 'docx' | 'image'): Promise<void> {
        // PDF : commence par %PDF
        if (declaredType === 'pdf') {
            if (buffer.length < 4 || buffer.toString('ascii', 0, 4) !== '%PDF') {
                throw new Error('File content does not match declared type.')
            }
            return
        }

        // DOCX/DOC : ZIP signature (PK\x03\x04) ou compound document (\xD0\xCF)
        if (declaredType === 'docx') {
            if (buffer.length < 4) {
                throw new Error('File content does not match declared type.')
            }
            const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04
            const isCompound = buffer[0] === 0xD0 && buffer[1] === 0xCF
            if (!isZip && !isCompound) {
                throw new Error('File content does not match declared type.')
            }
            return
        }

        // Images : JPEG (\xFF\xD8\xFF) ou PNG (\x89PNG)
        if (declaredType === 'image') {
            if (buffer.length < 4) {
                throw new Error('File content does not match declared type.')
            }
            const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
            const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
            if (!isJpeg && !isPng) {
                throw new Error('File content does not match declared type.')
            }
            return
        }
    }

    /**
     * Extraction texte PDF via pdf-parse
     */
    private static async extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
        const pdfParse = (await import('pdf-parse')).default
        const result = await pdfParse(buffer)
        return {
            text: result.text || '',
            type: 'pdf',
        }
    }

    /**
     * Extraction texte DOCX/DOC via mammoth.js
     */
    private static async extractFromDOCX(buffer: Buffer): Promise<ExtractionResult> {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        return {
            text: result.value || '',
            type: 'docx',
        }
    }

    /**
     * Conversion image en base64 data URI
     */
    private static async convertToBase64(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
        const base64 = buffer.toString('base64')
        return {
            text: `data:${mimeType};base64,${base64}`,
            type: 'image',
        }
    }
}
