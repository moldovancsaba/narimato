import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

// Standard error response format
interface ErrorResponse {
  success: false;
  message: string;
  errors?: any;
  code?: string;
}

// Common HTTP status codes
export const HttpStatus = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Error logging function
export function logError(context: string, error: Error | unknown) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${context}:`, error);

  // Here you could add additional logging logic, like sending to a logging service
}

// Base API error class
export class APIError extends Error {
  constructor(
    public message: string,
    public statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public code?: string,
    public errors?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Anonymous session errors
export class AnonymousSessionError extends APIError {
  constructor(message: string = 'Anonymous session error') {
    super(message, HttpStatus.UNAUTHORIZED, 'ANONYMOUS_SESSION_ERROR');
  }
}

// Anonymous project errors
export class AnonymousProjectError extends APIError {
  constructor(message: string = 'Anonymous project error') {
    super(message, HttpStatus.BAD_REQUEST, 'ANONYMOUS_PROJECT_ERROR');
  }
}

// Validation errors
export class ValidationError extends APIError {
  constructor(message: string, errors?: any) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', errors);
  }
}

// Project validation errors
export class ProjectValidationError extends ValidationError {
  constructor(message: string, errors?: any) {
    super(message, errors);
    this.code = 'PROJECT_VALIDATION_ERROR';
  }
}

// Session validation errors
export class SessionValidationError extends ValidationError {
  constructor(message: string, errors?: any) {
    super(message, errors);
    this.code = 'SESSION_VALIDATION_ERROR';
  }
}

// Authentication errors
export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED');
  }
}

// Database errors
export class DatabaseError extends APIError {
  constructor(message: string = 'Database operation failed', errors?: any) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, 'DATABASE_ERROR', errors);
  }
}

// Format error response
function formatErrorResponse(error: APIError): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    message: error.message,
  };

  if (error.code) {
    response.code = error.code;
  }

  if (error.errors) {
    response.errors = error.errors;
  }

  return response;
}

// Handle various types of errors and return standardized response
export function handleError(error: Error | unknown): NextResponse {
  let apiError: APIError;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    apiError = new ValidationError('Validation failed', error.errors);
  }
  // Handle anonymous session errors
  else if (error instanceof AnonymousSessionError) {
    apiError = error;
  }
  // Handle anonymous project errors
  else if (error instanceof AnonymousProjectError) {
    apiError = error;
  }
  // Handle project validation errors
  else if (error instanceof ProjectValidationError) {
    apiError = error;
  }
  // Handle session validation errors
  else if (error instanceof SessionValidationError) {
    apiError = error;
  }
  // Handle Mongoose errors
  else if (error instanceof mongoose.Error) {
    if (error instanceof mongoose.Error.ValidationError) {
      apiError = new ValidationError('Invalid data format', error.errors);
    } else if (error.name === 'MongoServerError' && (error as any).code === 11000) {
      apiError = new APIError(
        'Duplicate record found',
        HttpStatus.CONFLICT,
        'DUPLICATE_ERROR',
        (error as any).keyPattern
      );
    } else {
      apiError = new DatabaseError(error.message);
    }
  }
  // Handle authentication errors
  else if (error instanceof Error && error.message === 'Unauthorized - Authentication required') {
    apiError = new AuthenticationError();
  }
  // Handle custom API errors
  else if (error instanceof APIError) {
    apiError = error;
  }
  // Handle unknown errors
  else {
    apiError = new APIError(
      'An unexpected error occurred',
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR'
    );
  }

  // Log the error
  logError(apiError.name, error);

  // Return formatted response
  return NextResponse.json(
    formatErrorResponse(apiError),
    { status: apiError.statusCode }
  );
}

// Input validation helper
export function validateInput<T>(
  schema: { parse: (data: any) => T },
  data: any
): { success: true; data: T } | { success: false; error: ValidationError } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: new ValidationError('Validation failed', error.errors),
      };
    }
    throw error;
  }
}
