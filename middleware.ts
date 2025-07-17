import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting map (IP-based)
const ipRequestMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

// Security headers
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
};

export function middleware(request: NextRequest) {
  try {
    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown';
    
    // Rate limiting check
    const now = Date.now();
    const ipData = ipRequestMap.get(ip) ?? { count: 0, timestamp: now };
    
    if (now - ipData.timestamp > RATE_LIMIT_WINDOW) {
      // Reset if window expired
      ipData.count = 1;
      ipData.timestamp = now;
    } else {
      ipData.count++;
      if (ipData.count > RATE_LIMIT_MAX) {
        return new NextResponse(
          JSON.stringify({ message: 'Too Many Requests' }),
          { status: 429, headers: { 'Retry-After': '60' } }
        );
      }
    }
    ipRequestMap.set(ip, ipData);

    // Clean up old entries every 100 requests
    if (ipData.count % 100 === 0) {
      for (const [key, value] of ipRequestMap.entries()) {
        if (now - value.timestamp > RATE_LIMIT_WINDOW) {
          ipRequestMap.delete(key);
        }
      }
    }

    // Origin verification for non-GET requests
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin');
      const allowedOrigins = ['https://narimato.com', 'https://narimato-34lbix5b5-narimato.vercel.app'];
      
      if (origin && !allowedOrigins.includes(origin)) {
        return new NextResponse(
          JSON.stringify({ message: 'Invalid Origin' }),
          { status: 403 }
        );
      }
    }

    // Add security headers
    const response = NextResponse.next();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Middleware Error:', error);
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        message: 'Internal Server Error',
      }),
      { 
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/:path*'
  ]
};
