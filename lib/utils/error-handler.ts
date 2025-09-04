import { NextResponse } from 'next/server';

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);
  
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }
  
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('auth')) {
      return NextResponse.json(
        {
          error: 'Authentication failed',
          code: ErrorCode.UNAUTHORIZED,
        },
        { status: 401 }
      );
    }
    
    if (error.message.includes('permission') || error.message.includes('access')) {
      return NextResponse.json(
        {
          error: 'Access denied',
          code: ErrorCode.FORBIDDEN,
        },
        { status: 403 }
      );
    }
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: 'Resource not found',
          code: ErrorCode.NOT_FOUND,
        },
        { status: 404 }
      );
    }
    
    // Log the full error for debugging
    console.error('Unhandled error:', error);
    
    // Return generic error to client
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        code: ErrorCode.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }
  
  // Unknown error type
  console.error('Unknown error type:', error);
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_ERROR,
    },
    { status: 500 }
  );
}

export function createApiResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function createErrorResponse(
  message: string,
  code: ErrorCode,
  status: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      details,
    },
    { status }
  );
}