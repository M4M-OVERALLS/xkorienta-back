import { NextResponse } from "next/server"
import { BaseApplicationError } from "./BaseError"
import { ErrorResponse, SupportedLanguage } from "./types"
import { LanguageHelper } from "./languageHelper"

/**
 * Error Handler Utility
 * Handles errors consistently across the application
 */
export class ErrorHandler {
  /**
   * Handle error and return appropriate NextResponse
   */
  static handleError(error: unknown): NextResponse<ErrorResponse> {
    // If it's our custom error, use it directly
    if (error instanceof BaseApplicationError) {
      error.log()
      return NextResponse.json(error.toJSON(), { status: error.httpStatus })
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      console.error("❌ Unhandled Error:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNKNOWN_ERROR",
            message:
              process.env.NODE_ENV === "development"
                ? error.message
                : "Une erreur inattendue s'est produite",
            severity: "ERROR",
            category: "UNKNOWN",
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === "development" && {
              stack: error.stack,
            }),
          },
        },
        { status: 500 }
      )
    }

    // Handle unknown error types
    console.error("❌ Unknown Error Type:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: "Une erreur inattendue s'est produite",
          severity: "ERROR",
          category: "UNKNOWN",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }

  /**
   * Log non-operational errors
   * These might require developer attention
   */
  static logProgrammingError(error: Error) {
    console.error("🔴 PROGRAMMING ERROR - This should not happen:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })

    // In production, you might want to send this to an error tracking service
    // like Sentry, DataDog, etc.
    if (process.env.NODE_ENV === "production") {
      // Example: Sentry.captureException(error)
    }
  }

  /**
   * Async error wrapper for API routes
   * Automatically catches and handles errors
   */
  static async asyncHandler<T>(
    handler: () => Promise<NextResponse<T>>
  ): Promise<NextResponse<T | ErrorResponse>> {
    try {
      return await handler()
    } catch (error) {
      return ErrorHandler.handleError(error)
    }
  }
}

/**
 * Utility function to wrap async API handlers with automatic language detection
 */
export function withErrorHandler<T>(
  handler: (language: SupportedLanguage) => Promise<NextResponse<T>>,
  req: Request
): Promise<NextResponse<T | ErrorResponse>> {
  const language = LanguageHelper.getLanguageFromRequest(req)
  return ErrorHandler.asyncHandler(() => handler(language))
}

/**
 * Utility function for backwards compatibility (without language detection)
 * @deprecated Use withErrorHandler with req parameter for multilingual support
 */
export function withErrorHandlerSimple<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ErrorResponse>> {
  return ErrorHandler.asyncHandler(handler)
}
