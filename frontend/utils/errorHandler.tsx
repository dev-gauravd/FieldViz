// ================================
// ERROR HANDLING SYSTEM
// ================================

// utils/errorHandler.ts
type ErrorType = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR' 
  | 'INVALID_IMAGE'
  | 'INSUFFICIENT_MEMORY'
  | 'TESSERACT_INIT_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'UNKNOWN_ERROR';

export class ErrorHandler {
  static handleOCRError(error: any, context: string = 'OCR Processing') {
    console.error(`${context} Error:`, error);
    
    const errorTypes: Record<ErrorType, string> = {
      'NETWORK_ERROR': 'Network connection failed. Please check your internet connection.',
      'TIMEOUT_ERROR': 'Processing timeout. The image may be too complex or large.',
      'INVALID_IMAGE': 'Invalid image format. Please use JPG, PNG, or GIF files.',
      'INSUFFICIENT_MEMORY': 'Not enough memory to process this image. Try a smaller file.',
      'TESSERACT_INIT_ERROR': 'OCR engine initialization failed. Please refresh and try again.',
      'VALIDATION_ERROR': 'Data validation failed. Please check the extracted values.',
      'DATABASE_ERROR': 'Database operation failed. Please try again later.',
      'AUTHENTICATION_ERROR': 'Authentication failed. Please log in again.',
      'PERMISSION_ERROR': 'You do not have permission to perform this action.',
      'RATE_LIMIT_ERROR': 'Too many requests. Please wait a moment and try again.',
      'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.'
    };

    // Determine error type
    let errorType: ErrorType = 'UNKNOWN_ERROR';
    let userMessage = 'An unexpected error occurred. Please try again.';

    if (error.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('fetch')) {
        errorType = 'NETWORK_ERROR';
      } else if (message.includes('timeout')) {
        errorType = 'TIMEOUT_ERROR';
      } else if (message.includes('image') || message.includes('format')) {
        errorType = 'INVALID_IMAGE';
      } else if (message.includes('memory')) {
        errorType = 'INSUFFICIENT_MEMORY';
      } else if (message.includes('tesseract') || message.includes('worker')) {
        errorType = 'TESSERACT_INIT_ERROR';
      } else if (message.includes('validation')) {
        errorType = 'VALIDATION_ERROR';
      } else if (message.includes('database') || message.includes('sql')) {
        errorType = 'DATABASE_ERROR';
      } else if (message.includes('auth') || message.includes('token')) {
        errorType = 'AUTHENTICATION_ERROR';
      } else if (message.includes('permission') || message.includes('forbidden')) {
        errorType = 'PERMISSION_ERROR';
      } else if (message.includes('rate limit') || message.includes('too many')) {
        errorType = 'RATE_LIMIT_ERROR';
      }
    }

    userMessage = errorTypes[errorType];

    // Log error details for debugging
    this.logError({
      type: errorType,
      context,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    });

    return {
      type: errorType,
      message: userMessage,
      technical: error.message,
      canRetry: !(['INVALID_IMAGE', 'PERMISSION_ERROR', 'AUTHENTICATION_ERROR'] as ErrorType[]).includes(errorType)
    };
  }

  static logError(errorDetails: any) {
    // Send error to logging service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorDetails)
      }).catch(err => console.error('Failed to log error:', err));
    }
    
    // Store in localStorage for debugging
    if (typeof window !== 'undefined') {
      const errors = JSON.parse(localStorage.getItem('fieldviz_errors') || '[]');
      errors.push(errorDetails);
      
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      
      localStorage.setItem('fieldviz_errors', JSON.stringify(errors));
    }
  }

  static clearErrors() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fieldviz_errors');
    }
  }

  static getStoredErrors() {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('fieldviz_errors') || '[]');
    }
    return [];
  }
}
