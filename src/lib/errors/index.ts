/**
 * Centralized Error Management System with Multilingual Support
 *
 * Usage with automatic language detection:
 * ```typescript
 * import { AuthenticationError, withErrorHandler } from '@/lib/errors'
 *
 * export async function POST(req: Request) {
 *   return withErrorHandler(async (lang) => {
 *     // Your code here - language is automatically detected from req
 *     const { email, password } = await req.json()
 *
 *     if (!user) {
 *       throw AuthenticationError.userNotFoundByEmail(email, lang)
 *     }
 *
 *     return NextResponse.json({ success: true })
 *   }, req)
 * }
 * ```
 *
 * Language detection sources (in order of priority):
 * 1. Query parameter: ?lang=en
 * 2. Header: X-Language
 * 3. Header: Accept-Language
 * 4. Default: fr
 */

export * from "./core/types"
export * from "./core/BaseError"
export * from "./core/AuthenticationError"
export * from "./core/errorHandler"
export * from "./core/languageHelper"
export { default as errorCatalog } from "./config/errorCatalog.json"
