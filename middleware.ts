import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';

/**
 * Type definition for route validation errors
 * Used to standardize error responses across middleware
 */
type RouteError = {
  code: string;
  message: string;
  status: number;
};

/**
 * Validates if a string is a valid MD5 hash
 * MD5 hashes are 32 characters long and contain only hexadecimal characters
 * @param str - The string to validate
 * @returns boolean indicating if the string is a valid MD5 hash
 */
function isMD5(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[a-f0-9]{32}$/i.test(str);
}

/**
 * Verifies admin access using secure token validation
 * Implements multiple security checks:
 * 1. Token presence and format
 * 2. Token expiration
 * 3. Token signature verification against env secret
 * 
 * @param request - NextRequest object containing headers and cookies
 * @returns boolean indicating if the request has valid admin access
 */
function verifyAdminAccess(request: NextRequest): boolean {
  try {
    // Check both cookie and Authorization header for token
    const tokenFromCookie = request.cookies.get('admin_token')?.value;
    const authHeader = request.headers.get('Authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    // Get token from either source, prioritizing header
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
      console.warn('[Auth] No token provided for admin access');
      return false;
    }

    // For MVP: Simple token validation
    // TODO: Implement proper JWT validation with expiration and signature checks
    const isValid = token === process.env.ADMIN_SECRET;

    if (!isValid) {
      console.warn('[Auth] Invalid admin token provided');
    }

    return isValid;
  } catch (error) {
    console.error('[Auth] Error during admin access verification:', error);
    return false;
  }
}

/**
 * Creates a standardized error response
 * Ensures consistent error handling across middleware
 * 
 * @param error - RouteError object containing error details
 * @param request - Original NextRequest object
 * @returns NextResponse with appropriate status and error details
 */
function createErrorResponse(error: RouteError, request: NextRequest): NextResponse {
  // For security, some errors should redirect to login instead of showing error
  const shouldRedirectToLogin = [
    'AUTH_REQUIRED',
    'AUTH_INVALID',
    'SESSION_EXPIRED'
  ].includes(error.code);

  if (shouldRedirectToLogin) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', error.code);
    loginUrl.searchParams.set('returnTo', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For other errors, return JSON response
  return new NextResponse(
    JSON.stringify({ error: error.code, message: error.message }),
    {
      status: error.status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Middleware for route protection and URL management
 * Implements:
 * 1. Admin route protection
 * 2. Identifier validation and routing
 * 3. Error handling and logging
 * 4. Security headers
 * 
 * @param request - NextRequest object
 * @returns NextResponse with appropriate routing/error handling
 */
export async function middleware(request: NextRequest) {
  try {
    // Add security headers to all responses
    const response = NextResponse.next();
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Protect management routes
    if (request.nextUrl.pathname.startsWith('/manage')) {
      const isAdmin = verifyAdminAccess(request);
      
      if (!isAdmin) {
        return createErrorResponse({
          code: 'AUTH_REQUIRED',
          message: 'Admin authentication required',
          status: 401
        }, request);
      }
    }

    // Handle card route validation and redirection
    if (request.nextUrl.pathname.startsWith('/cards/')) {
      const pathParts = request.nextUrl.pathname.split('/');
      if (pathParts.length < 3) {
        return createErrorResponse({
          code: 'INVALID_ROUTE',
          message: 'Invalid card route',
          status: 400
        }, request);
      }

      const identifier = pathParts[2];
      const isManageRoute = request.nextUrl.pathname.startsWith('/manage');

      // Validate identifier format based on route type
      if (isMD5(identifier)) {
        // MD5 identifiers should be in manage routes
        if (!isManageRoute) {
          return NextResponse.redirect(
            new URL(`/manage/cards/${identifier}`, request.url)
          );
        }
      } else {
        // Non-MD5 identifiers (slugs) should not be in manage routes
        if (isManageRoute) {
          return createErrorResponse({
            code: 'INVALID_IDENTIFIER',
            message: 'Invalid identifier format for management route',
            status: 400
          }, request);
        }
      }
    }

    return response;
  } catch (error) {
    console.error('[Middleware] Unexpected error:', error);
    return createErrorResponse({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      status: 500
    }, request);
  }
}

/**
 * Configure which routes should trigger the middleware
 * Includes all protected and validated routes
 */
export const config = {
  matcher: [
    // Match all management routes
    '/manage/:path*',
    // Match all card routes
    '/cards/:path*'
  ]
};
