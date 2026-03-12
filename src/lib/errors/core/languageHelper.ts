import { SupportedLanguage } from "./types"

/**
 * Language Helper
 * Détecte et gère la langue des requêtes
 */
export class LanguageHelper {
  private static readonly DEFAULT_LANGUAGE: SupportedLanguage = "fr"
  private static readonly SUPPORTED_LANGUAGES: SupportedLanguage[] = ["fr", "en"]

  /**
   * Extrait la langue de la requête
   * Sources:
   * 1. Query parameter: ?lang=en
   * 2. Header: Accept-Language
   * 3. Header: X-Language
   * 4. Default: fr
   */
  static getLanguageFromRequest(req: Request): SupportedLanguage {
    try {
      const url = new URL(req.url)

      // 1. Check query parameter
      const langParam = url.searchParams.get("lang")
      if (langParam && this.isSupported(langParam)) {
        return langParam as SupportedLanguage
      }

      // 2. Check custom header X-Language
      const xLanguageHeader = req.headers.get("x-language")
      if (xLanguageHeader && this.isSupported(xLanguageHeader)) {
        return xLanguageHeader as SupportedLanguage
      }

      // 3. Check Accept-Language header
      const acceptLanguage = req.headers.get("accept-language")
      if (acceptLanguage) {
        const primaryLang = this.parseAcceptLanguage(acceptLanguage)
        if (primaryLang && this.isSupported(primaryLang)) {
          return primaryLang as SupportedLanguage
        }
      }

      // 4. Default language
      return this.DEFAULT_LANGUAGE
    } catch (error) {
      return this.DEFAULT_LANGUAGE
    }
  }

  /**
   * Parse Accept-Language header
   * Example: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7" => "fr"
   */
  private static parseAcceptLanguage(header: string): string | null {
    const languages = header.split(",")
    if (languages.length === 0) return null

    // Get the first language (highest priority)
    const firstLang = languages[0].split(";")[0].trim()

    // Extract language code (fr-FR => fr, en-US => en)
    const langCode = firstLang.split("-")[0].toLowerCase()

    return langCode
  }

  /**
   * Vérifie si une langue est supportée
   */
  private static isSupported(lang: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
  }

  /**
   * Normalise une langue
   */
  static normalize(lang: string | undefined | null): SupportedLanguage {
    if (!lang) return this.DEFAULT_LANGUAGE

    const normalized = lang.toLowerCase().split("-")[0]
    return this.isSupported(normalized)
      ? (normalized as SupportedLanguage)
      : this.DEFAULT_LANGUAGE
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): SupportedLanguage[] {
    return [...this.SUPPORTED_LANGUAGES]
  }

  /**
   * Get default language
   */
  static getDefaultLanguage(): SupportedLanguage {
    return this.DEFAULT_LANGUAGE
  }
}
