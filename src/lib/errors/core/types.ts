/**
 * Error Types & Interfaces
 */

export type SupportedLanguage = "fr" | "en"

export type ErrorSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL"

export type ErrorCategory =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "DATABASE"
  | "EXTERNAL_SERVICE"
  | "CONFIGURATION"
  | "UNKNOWN"

export interface ErrorDefinition {
  code: string
  message: Record<SupportedLanguage, string>
  httpStatus: number
  severity: ErrorSeverity
  category: ErrorCategory
}

export interface ErrorCatalog {
  [domain: string]: {
    [errorCode: string]: ErrorDefinition
  }
}

export interface ErrorContext {
  [key: string]: unknown
  userId?: string
  requestId?: string
  timestamp?: string
  path?: string
  method?: string
}

export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    severity: ErrorSeverity
    category: ErrorCategory
    timestamp: string
    context?: ErrorContext
    stack?: string
  }
}
