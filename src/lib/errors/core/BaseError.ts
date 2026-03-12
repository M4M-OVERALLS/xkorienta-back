import { ErrorCategory, ErrorContext, ErrorSeverity, SupportedLanguage } from "./types"
import { LanguageHelper } from "./languageHelper"

/**
 * Base Application Error
 * All custom errors should extend this class
 */
export class BaseApplicationError extends Error {
  public readonly code: string
  public readonly httpStatus: number
  public readonly severity: ErrorSeverity
  public readonly category: ErrorCategory
  public readonly context?: ErrorContext
  public readonly timestamp: string
  public readonly isOperational: boolean
  public readonly language: SupportedLanguage

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    severity: ErrorSeverity,
    category: ErrorCategory,
    language?: SupportedLanguage,
    context?: ErrorContext,
    isOperational = true
  ) {
    super(message)

    this.code = code
    this.httpStatus = httpStatus
    this.severity = severity
    this.category = category
    this.language = language || LanguageHelper.getDefaultLanguage()
    this.context = context
    this.timestamp = new Date().toISOString()
    this.isOperational = isOperational

    // Maintains proper stack trace for where error was thrown (only available in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }

    // Set the prototype explicitly to enable instanceof checks
    Object.setPrototypeOf(this, BaseApplicationError.prototype)
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        severity: this.severity,
        category: this.category,
        timestamp: this.timestamp,
        context: this.context,
        ...(process.env.NODE_ENV === "development" && {
          stack: this.stack,
        }),
      },
    }
  }

  /**
   * Get a user-friendly message
   */
  getUserMessage(): string {
    // In production, we might want to return generic messages for certain error types
    if (this.severity === "CRITICAL" && process.env.NODE_ENV === "production") {
      return "Une erreur critique s'est produite. Veuillez réessayer plus tard."
    }
    return this.message
  }

  /**
   * Log the error with appropriate severity
   */
  log() {
    const logData = {
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    }

    switch (this.severity) {
      case "CRITICAL":
        console.error("🔴 CRITICAL ERROR:", logData)
        break
      case "ERROR":
        console.error("❌ ERROR:", logData)
        break
      case "WARNING":
        console.warn("⚠️  WARNING:", logData)
        break
      case "INFO":
        console.info("ℹ️  INFO:", logData)
        break
      default:
        console.log("📝 LOG:", logData)
    }
  }
}
